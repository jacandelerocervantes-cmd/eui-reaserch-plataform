// deno-lint-ignore-file no-import-prefix
/**
 * Autenticación OAuth2 por cuenta de servicio de Google Cloud (JWT bearer
 * flow, RFC 7523) — necesaria para Vertex AI Search / Discovery Engine API,
 * que a diferencia de la API de Gemini (Developer API / AI Studio, una sola
 * API key) exige un access token de OAuth2 respaldado por una cuenta de
 * servicio de GCP.
 *
 * CONTEXTO: esto es exclusivo del caso de estudio "GraphRAG casero vs.
 * Vertex AI Search" (crédito de prueba "GenAI App Builder", ~$1,000 USD/1
 * año) — no lo usa ninguna otra función de la plataforma. El resto de la
 * plataforma sigue con API keys simples de Gemini (GEMINI_API_KEY), sin
 * tocar esto.
 *
 * Implementado con Web Crypto API nativa de Deno (crypto.subtle) — sin
 * librería npm de Google Auth, mismo principio de "un solo fetch, sin
 * dependencias" que ya usa _shared/cache.ts para Upstash.
 */

interface ServiceAccountKey {
  client_email: string
  private_key: string
  token_uri?: string
}

interface CachedToken { accessToken: string; expiresAt: number }
let cachedToken: CachedToken | null = null

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlEncodeString(input: string): string {
  return base64UrlEncode(new TextEncoder().encode(input))
}

/** PEM (con cabeceras -----BEGIN/END PRIVATE KEY-----) -> ArrayBuffer DER, para crypto.subtle.importKey. */
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "")
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function signJwt(serviceAccount: ServiceAccountKey, scopes: string[]): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" }
  const nowSeconds = Math.floor(Date.now() / 1000)
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: scopes.join(" "),
    aud: serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600, // máximo permitido por Google para este flujo
  }

  const unsignedToken = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(JSON.stringify(claimSet))}`

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  )

  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`
}

/**
 * Devuelve un access token OAuth2 válido para los `scopes` pedidos, cacheado
 * en memoria de la instancia hasta ~5 min antes de su expiración real (los
 * tokens de Google duran 1h). Igual que el resto de la plataforma, esto es
 * caché por instancia (no distribuido) — aceptable aquí porque el volumen de
 * este caso de estudio es bajo (no es tráfico de producción).
 */
export async function getGoogleAccessToken(scopes: string[] = ["https://www.googleapis.com/auth/cloud-platform"]): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60_000) {
    return cachedToken.accessToken
  }

  const raw = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY_JSON")
  if (!raw) throw new Error("GCP_SERVICE_ACCOUNT_KEY_JSON no configurado — requerido para Vertex AI Search.")

  const serviceAccount = JSON.parse(raw) as ServiceAccountKey
  const jwt = await signJwt(serviceAccount, scopes)

  const res = await fetch(serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Google OAuth2 token exchange falló (${res.status}): ${body}`)
  }

  const json = await res.json() as { access_token: string; expires_in: number }
  cachedToken = { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return cachedToken.accessToken
}
