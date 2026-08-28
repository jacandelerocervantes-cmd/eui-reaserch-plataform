// deno-lint-ignore-file no-import-prefix
/**
 * Caché y rate-limit compartidos por las Edge Functions sobre Upstash Redis
 * (REST, sin dependencias npm — un solo `fetch`, corre igual de bien en
 * Deno Edge Runtime). Mismo patrón que lib/server/cache.ts del lado
 * Next.js, pero usando `Deno.env` en vez de `process.env`.
 *
 * Si UPSTASH_REDIS_REST_URL/TOKEN no están configurados en los secrets del
 * proyecto Supabase, degrada a no-cache / sin límite de tasa — nunca rompe
 * el flujo real por falta de configuración de caché.
 */

const UPSTASH_URL = Deno.env.get("UPSTASH_REDIS_REST_URL")
const UPSTASH_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN")

export const cacheAvailable = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

async function upstashCommand(command: (string | number)[]): Promise<unknown> {
  if (!cacheAvailable) return null
  try {
    const res = await fetch(UPSTASH_URL as string, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    })
    if (!res.ok) return null
    const json = (await res.json().catch(() => null)) as { result?: unknown } | null
    return json?.result ?? null
  } catch {
    return null
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await upstashCommand(["GET", key])
  if (typeof raw !== "string") return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await upstashCommand(["SET", key, JSON.stringify(value), "EX", ttlSeconds])
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Ventana fija: `INCR` + `EXPIRE` (solo la primera vez que la key aparece
 * en la ventana). Sin credenciales de Upstash, `allowed` siempre es `true`
 * (no hay forma de contar sin backend — se documenta como degradación, no
 * como bloqueo silencioso de la función).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number }> {
  if (!cacheAvailable) return { allowed: true, count: 0 }

  const count = await upstashCommand(["INCR", key])
  const n = typeof count === "number" ? count : Number(count) || 0
  if (n === 1) {
    await upstashCommand(["EXPIRE", key, windowSeconds])
  }
  return { allowed: n <= limit, count: n }
}
