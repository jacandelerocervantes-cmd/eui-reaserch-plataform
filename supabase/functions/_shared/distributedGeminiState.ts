/**
 * Backend distribuido OPCIONAL para el circuit breaker + semáforo de
 * concurrencia de _shared/gemini.ts — punto 16 de
 * qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md.
 *
 * ── Elección de cliente: REST sobre HTTP, no `ioredis` ─────────────────────
 * `ioredis` habla el protocolo RESP nativo de Redis sobre un socket TCP
 * persistente — Supabase Edge Functions corre sobre Deno Deploy, un runtime
 * de edge computing sin soporte confiable para sockets TCP salientes de
 * larga duración fuera del propio fetch/HTTP (y aunque `Deno.connect`
 * existiera, mantener un socket persistente por invocación aislada de Edge
 * Function no encaja con el modelo "una instancia por request" del runtime).
 * Upstash Redis expone además de RESP un endpoint REST HTTP diseñado
 * explícitamente para este tipo de entorno (Cloudflare Workers, Vercel
 * Edge, Deno Deploy) — cada comando es un POST autenticado con Bearer
 * token, sin conexión persistente que mantener. Es la opción correcta para
 * este runtime, no una preferencia arbitraria.
 *
 * En vez de importar el paquete `@upstash/redis` (un wrapper delgado sobre
 * ese mismo REST API), este archivo habla el REST API directo con `fetch`
 * nativo — el protocolo es lo bastante simple (un POST con la lista de
 * argumentos del comando) que envolverlo aquí evita una dependencia externa
 * más, coherente con cómo el resto de `supabase/functions/_shared/` ya evita
 * SDKs pesados cuando `fetch` alcanza (ver `_shared/embeddings.ts`,
 * `_shared/gemini.ts` mismos). Si en el futuro se prefiere el SDK oficial
 * por conveniencia, es un cambio acotado a este único archivo.
 *
 * ── Activación ───────────────────────────────────────────────────────────
 * Env vars `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (nombres
 * estándar del producto Upstash — se generan solos al crear una base desde
 * su consola). SIN esas dos variables configuradas, `isDistributedStateConfigured()`
 * devuelve false y _shared/gemini.ts sigue usando el semáforo/breaker en
 * memoria de siempre — cero cambio de comportamiento en dev/CI/cualquier
 * entorno sin Redis. Ver 03-ROADMAP-DESPLIEGUE.md: crear la base de Upstash
 * y generar esas credenciales es una acción que requiere que el usuario lo
 * haga (cuenta propia, no se puede crear por esta sesión) — no bloquea nada
 * mientras tanto.
 */

const REST_URL = Deno.env.get("UPSTASH_REDIS_REST_URL")
const REST_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN")

export function isDistributedStateConfigured(): boolean {
  return !!REST_URL && !!REST_TOKEN
}

async function redisCommand<T>(args: (string | number)[]): Promise<T> {
  const res = await fetch(REST_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`Upstash REST respondió ${res.status}`)
  const json = await res.json()
  return json.result as T
}

const CIRCUIT_OPEN_UNTIL_KEY = "gemini:circuit:open_until"
const CONSECUTIVE_FAILURES_KEY = "gemini:circuit:consecutive_failures"
const INFLIGHT_KEY = "gemini:concurrency:inflight"

/** Lee hasta cuándo está abierto el circuito (0 si está cerrado). */
export async function getDistributedCircuitOpenUntil(): Promise<number> {
  const value = await redisCommand<string | null>(["GET", CIRCUIT_OPEN_UNTIL_KEY])
  return value ? Number(value) : 0
}

/**
 * Registra el resultado de una llamada real a Gemini (distribuido entre
 * TODAS las instancias, a diferencia de `consecutiveFailures` en memoria).
 * Misma regla que la versión en memoria: FAILURE_THRESHOLD fallos
 * consecutivos abren el circuito por COOLDOWN_MS.
 */
export async function recordDistributedOutcome(isFailure: boolean, failureThreshold: number, cooldownMs: number): Promise<void> {
  if (!isFailure) {
    await redisCommand(["SET", CONSECUTIVE_FAILURES_KEY, "0"])
    return
  }
  const count = await redisCommand<number>(["INCR", CONSECUTIVE_FAILURES_KEY])
  if (count >= failureThreshold) {
    await redisCommand(["SET", CIRCUIT_OPEN_UNTIL_KEY, String(Date.now() + cooldownMs)])
    await redisCommand(["SET", CONSECUTIVE_FAILURES_KEY, "0"])
  }
}

/**
 * Semáforo distribuido vía INCR/DECR atómico — sin cola real (Upstash REST
 * no soporta operaciones bloqueantes tipo BLPOP), así que un cupo lleno
 * reintenta con backoff corto un número acotado de veces antes de rendirse.
 * Es una aproximación honesta de "límite estricto compartido entre
 * instancias", no una cola FIFO perfecta como la versión en memoria — el
 * límite duro (nunca más de maxConcurrency en vuelo, aunque haya N
 * instancias) sí se cumple, que es la garantía que importa para controlar
 * sobrecosto.
 */
export async function acquireDistributedSlot(maxConcurrency: number, maxWaitAttempts = 8, retryDelayMs = 250): Promise<(() => Promise<void>) | null> {
  for (let attempt = 0; attempt < maxWaitAttempts; attempt++) {
    const current = await redisCommand<number>(["INCR", INFLIGHT_KEY])
    if (current <= maxConcurrency) {
      // TTL de seguridad: si una instancia muere sin liberar (crash/timeout
      // no capturado), el contador no queda inflado para siempre.
      await redisCommand(["EXPIRE", INFLIGHT_KEY, "120"])
      return async () => { await redisCommand(["DECR", INFLIGHT_KEY]) }
    }
    await redisCommand(["DECR", INFLIGHT_KEY])
    if (attempt < maxWaitAttempts - 1) await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
  }
  return null // cupo lleno tras agotar reintentos — el caller decide (rechazar)
}
