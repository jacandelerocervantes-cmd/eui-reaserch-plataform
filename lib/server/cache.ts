/**
 * Caché de sesión/perfil sobre Upstash Redis (API REST, sin socket TCP —
 * compatible con Edge Runtime, donde corre `proxy.ts`). Zero-cost mientras
 * el uso quepa en el free tier de Upstash (10k comandos/día, de sobra para
 * 1000 usuarios con TTL de 90s).
 *
 * Si no hay credenciales configuradas (UPSTASH_REDIS_REST_URL/TOKEN),
 * degrada a no-cache: get() siempre devuelve null y set() es un no-op —
 * el código que llama a este módulo sigue funcionando exactamente igual
 * que antes de introducir la caché, solo sin el ahorro de latencia/tráfico.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

export const cacheAvailable = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

async function upstashCommand(command: (string | number)[]): Promise<unknown> {
  if (!cacheAvailable) return null
  try {
    const res = await fetch(UPSTASH_URL as string, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    })
    if (!res.ok) return null
    const json = (await res.json().catch(() => null)) as { result?: unknown } | null
    return json?.result ?? null
  } catch {
    // Upstash caído/timeout no debe tumbar el request real — degrada a cache miss.
    return null
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await upstashCommand(['GET', key])
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await upstashCommand(['SET', key, JSON.stringify(value), 'EX', ttlSeconds])
}

/** SHA-256 hex vía Web Crypto — disponible tanto en Edge Runtime como en Node ≥20. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
