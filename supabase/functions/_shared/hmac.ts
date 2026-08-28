// HMAC-SHA256 sobre Web Crypto (crypto.subtle) — sin imports específicos de
// runtime, así que el mismo archivo corre igual en Deno (Edge Functions,
// register-attendance) y en Node (tests con vitest). Antes esto vivía
// duplicado inline dentro de register-attendance/index.ts; se extrae aquí
// para tener una sola implementación y poder probarla con un test real que
// ejecute exactamente el mismo código que corre en producción.

export async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Comparación en tiempo constante — evita filtrar la firma correcta por
// diferencias de timing entre intentos.
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Predicado real que usa register-attendance/index.ts para aceptar/rechazar
// el hash de un QR firmado server-side. Se expone acá (en vez de dejarlo
// inline en el handler) para que el test de aceptación/rechazo ejecute la
// lógica de producción tal cual, sin reimplementarla por separado.
export async function isValidQrSignature(secret: string, hash: string, sig: string): Promise<boolean> {
  if (!secret || !sig) return false
  const expectedSig = await hmacHex(secret, hash ?? '')
  return timingSafeEqualHex(sig, expectedSig)
}
