/**
 * Cliente resiliente para la API de Gemini: reintentos con backoff exponencial
 * ante 429 (rate limit) / 503 (sobrecarga), un circuit breaker, y un límite
 * de concurrencia (ver "Control de concurrencia" abajo) para no disparar
 * llamadas a la IA externa (Gemini o el fallback SLM local) sin control ni
 * límite de sobrecosto.
 *
 * ── Backend en memoria (default) vs. distribuido (Redis/Upstash, opcional) ──
 * Por defecto, el estado del breaker y el semáforo de concurrencia viven en
 * memoria de la instancia Deno — cada Edge Function aislada tiene el suyo;
 * es protección de mejor esfuerzo por instancia, no coordinada globalmente.
 * Si `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` están configuradas
 * (ver `_shared/distributedGeminiState.ts` para la justificación de por qué
 * REST y no `ioredis`), el mismo breaker/semáforo se vuelve real y
 * compartido entre TODAS las instancias — un fallo detectado por una
 * instancia abre el circuito para todas, y el límite de concurrencia es un
 * tope duro de verdad a nivel de todo el despliegue, no por instancia.
 * SIN esas env vars (el caso por defecto, y el único disponible mientras no
 * exista una cuenta de Upstash configurada — ver 03-ROADMAP-DESPLIEGUE.md,
 * es un paso que solo el usuario puede hacer) el comportamiento es
 * exactamente el de antes: 100% en memoria, sin ninguna llamada de red
 * adicional ni dependencia de un servicio externo.
 *
 * Fallback a SLM local (ver localSlmFallback.ts): cuando el circuit breaker
 * está abierto, o se agotan los reintentos sin respuesta válida de Gemini,
 * y hay un LOCAL_SLM_URL configurado, la petición se reintenta contra ese
 * servidor local en vez de fallarle al caller. Sin esa env var (el caso por
 * defecto) el comportamiento es exactamente el mismo de siempre: lanza el
 * error tal cual.
 *
 * ── Control de concurrencia (mds/03 tarea 5) ────────────────────────────
 * Semáforo (en memoria o distribuido, ver arriba) con cola de espera
 * (backpressure) delante de TODA llamada real a IA externa (Gemini o su
 * fallback SLM): como máximo `GEMINI_MAX_CONCURRENCY` (env var, default 4)
 * llamadas en vuelo a la vez. Una petición que llega estando el límite
 * lleno espera en cola (FIFO en memoria; reintentos acotados con backoff
 * corto en el backend distribuido, ver ese archivo) — no se rechaza de
 * inmediato: la mayoría de callers de este cliente son Edge Functions bajo
 * demanda de un docente, no tráfico masivo, así que colas cortas son
 * preferibles a fallar una acción que el usuario disparó a propósito. Si
 * la cola/los reintentos se agotan — señal de que algo está generando
 * muchísimas llamadas simultáneas, no un pico normal — se rechaza con
 * `GeminiConcurrencyLimitError` en vez de esperar indefinidamente.
 */
import { callLocalSlmAsGeminiShape, isLocalSlmConfigured, type GeminiRequestBody } from "./localSlmFallback.ts"
import {
  acquireDistributedSlot, getDistributedCircuitOpenUntil, isDistributedStateConfigured, recordDistributedOutcome,
} from "./distributedGeminiState.ts"

const MAX_RETRIES = 2
const BASE_DELAY_MS = 1000
const RETRYABLE_STATUS = new Set([429, 503])

const FAILURE_THRESHOLD = 5
const COOLDOWN_MS = 30_000

let consecutiveFailures = 0
let circuitOpenUntil = 0

export class GeminiCircuitOpenError extends Error {
  constructor() {
    super("Gemini no disponible temporalmente tras fallos repetidos (circuit breaker abierto). Reintenta en unos segundos.")
    this.name = "GeminiCircuitOpenError"
  }
}

export class GeminiConcurrencyLimitError extends Error {
  constructor() {
    super("Demasiadas llamadas a IA en vuelo a la vez. Reintenta en unos segundos.")
    this.name = "GeminiConcurrencyLimitError"
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// `|| default` (no `??`) a propósito: cubre tanto env var ausente (undefined
// -> NaN) como env var presente pero vacía/no-numérica (Number("") === 0),
// ambos casos deben caer al default en vez de dejar la concurrencia en 0.
const MAX_CONCURRENCY = Number(Deno.env.get("GEMINI_MAX_CONCURRENCY")) || 4
const MAX_QUEUE = Number(Deno.env.get("GEMINI_MAX_QUEUE")) || 20

// ── Semáforo en memoria (fallback cuando no hay backend distribuido) ──────
let inFlight = 0
const waiters: Array<() => void> = []

function acquireGeminiSlotInMemory(): Promise<() => void> {
  if (inFlight < MAX_CONCURRENCY) {
    inFlight++
    return Promise.resolve(releaseGeminiSlotInMemory)
  }
  if (waiters.length >= MAX_QUEUE) {
    throw new GeminiConcurrencyLimitError()
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      inFlight++
      resolve(releaseGeminiSlotInMemory)
    })
  })
}

function releaseGeminiSlotInMemory(): void {
  inFlight--
  const next = waiters.shift()
  if (next) next()
}

/**
 * Reserva un permiso del semáforo — distribuido (Redis/Upstash) si está
 * configurado, en memoria si no. Devuelve una función `release()` que
 * SIEMPRE debe llamarse (típicamente en un `finally`).
 */
async function acquireGeminiSlot(): Promise<() => void | Promise<void>> {
  if (isDistributedStateConfigured()) {
    const release = await acquireDistributedSlot(MAX_CONCURRENCY)
    if (!release) throw new GeminiConcurrencyLimitError()
    return release
  }
  return acquireGeminiSlotInMemory()
}

async function isCircuitOpen(): Promise<boolean> {
  if (isDistributedStateConfigured()) return Date.now() < (await getDistributedCircuitOpenUntil())
  return Date.now() < circuitOpenUntil
}

async function recordOutcome(isFailure: boolean): Promise<void> {
  if (isDistributedStateConfigured()) {
    await recordDistributedOutcome(isFailure, FAILURE_THRESHOLD, COOLDOWN_MS)
    return
  }
  if (!isFailure) {
    consecutiveFailures = 0
    return
  }
  consecutiveFailures++
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + COOLDOWN_MS
    consecutiveFailures = 0 // arranca fresco cuando el cooldown termine
  }
}

/**
 * POST a un endpoint de Gemini con reintentos automáticos ante status
 * reintentables (429/503 por defecto). Devuelve la Response cruda (igual que
 * fetch) para que el caller decida qué hacer con `.ok`/status — solo los
 * status reintentables se reintentan, cualquier otro (incluyendo 4xx de
 * validación) se devuelve tal cual en el primer intento.
 *
 * @param maxRetries reintentos adicionales tras el primer intento (default 2).
 * @param retryableStatuses status codes que disparan reintento (default [429, 503]).
 *
 * Envuelta por el semáforo de concurrencia (`acquireGeminiSlot`, ver
 * arriba): el permiso se reserva ANTES del check del circuit breaker y se
 * libera siempre en `finally`, así que también limita cuántas veces se
 * llama al SLM local en paralelo (el fallback pasa por el mismo permiso que
 * la llamada a Gemini que reemplaza).
 */
const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]

export async function fetchGeminiWithRetry(
  url: string,
  body: unknown,
  signal: AbortSignal,
  maxRetries: number = MAX_RETRIES,
  retryableStatuses: number[] = [...RETRYABLE_STATUS],
): Promise<Response> {
  const release = await acquireGeminiSlot()
  try {
    // Si la URL apunta a generativelanguage y contiene uno de los modelos conocidos,
    // preparamos la lista de fallback de modelos en caso de rate-limit 429 persistente.
    const isGoogleGemini = url.includes("generativelanguage.googleapis.com")
    let modelsToTry: string[] = []

    if (isGoogleGemini) {
      const match = url.match(/models\/([^:]+):generateContent/)
      const currentModel = match ? match[1] : ""
      if (currentModel) {
        modelsToTry = [currentModel, ...FALLBACK_MODELS.filter((m) => m !== currentModel)]
      }
    }

    if (modelsToTry.length === 0) {
      return await fetchGeminiWithRetryInner(url, body, signal, maxRetries, retryableStatuses)
    }

    let lastRes: Response | undefined
    for (const model of modelsToTry) {
      const modelUrl = url.replace(/models\/([^:]+):generateContent/, `models/${model}:generateContent`)
      const res = await fetchGeminiWithRetryInner(modelUrl, body, signal, maxRetries, retryableStatuses)
      if (res.ok) return res

      lastRes = res
      if (res.status === 429 || res.status === 503) {
        console.warn(`[GEMINI_CLIENT] Modelo ${model} respondió ${res.status}. Probando fallback al siguiente modelo...`)
        continue
      }
      // Si fue otro error (ej: 400 bad request), no tiene sentido probar otro modelo
      return res
    }

    return lastRes ?? new Response(JSON.stringify({ error: "Todos los modelos de Gemini devolvieron 429/503." }), { status: 429 })
  } finally {
    await release()
  }
}

async function fetchGeminiWithRetryInner(
  url: string,
  body: unknown,
  signal: AbortSignal,
  maxRetries: number,
  retryableStatuses: number[],
): Promise<Response> {
  if (await isCircuitOpen()) {
    if (isLocalSlmConfigured()) return await callLocalSlmAsGeminiShape(body as GeminiRequestBody, signal)
    throw new GeminiCircuitOpenError()
  }
  const retryable = new Set(retryableStatuses)

  let res: Response | undefined
  let networkErr: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    networkErr = undefined
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err // timeout del caller: no reintentar
      networkErr = err
      res = undefined
    }

    const shouldRetry = networkErr !== undefined || (res !== undefined && retryable.has(res.status))
    if (!shouldRetry || attempt === maxRetries) break
    const isTestEnv = (typeof process !== "undefined" && process?.env?.NODE_ENV === "test") ||
      (typeof Deno !== "undefined" && Deno?.env?.get("NODE_ENV") === "test")
    const jitter = isTestEnv ? 0 : Math.random() * 400
    await sleep(BASE_DELAY_MS * (2 ** attempt) + jitter)
  }

  if (!res) {
    await recordOutcome(true) // fallo de red: cuenta como fallo para el breaker
    if (isLocalSlmConfigured()) return await callLocalSlmAsGeminiShape(body as GeminiRequestBody, signal)
    throw networkErr instanceof Error ? networkErr : new Error("Gemini no respondió.")
  }

  await recordOutcome(retryable.has(res.status))
  if (retryable.has(res.status) && isLocalSlmConfigured()) {
    return await callLocalSlmAsGeminiShape(body as GeminiRequestBody, signal)
  }
  return res
}
