// deno-lint-ignore-file no-import-prefix
/**
 * Cliente para el servicio OCR autohospedado (`baidu/Unlimited-OCR`,
 * https://github.com/baidu/Unlimited-OCR, MIT — servido vía vLLM con API
 * OpenAI-compatible, ver docs/05_OCR_Unlimited_Integracion.md). Extrae texto
 * plano de un PDF ANTES de mandarlo a Gemini, para poder aplicar
 * `applyInputGuardrail` (_shared/guardrail.ts) sobre ese texto — algo
 * imposible hoy en `evaluate-submissions-ia`/`detect-cross-plagiarism`/
 * `intelligent-file-parser` porque el archivo viaja como PDF binario
 * (`inline_data`) directo a Gemini (ver docs/04_Multi_Agente_MCP.md §4.6).
 *
 * DISEÑO — "nunca lanza, siempre degrada" (mismo principio que gemini.ts):
 * este cliente NUNCA lanza una excepción no controlada. Cualquier problema
 * (no configurado, archivo inválido/demasiado grande, límite diario
 * alcanzado, breaker abierto, el servicio no responde) se traduce en
 * `{ available: false, reason }` — el caller (las 3 Edge Functions) revisa
 * ese flag y, si es `false`, preserva EXACTAMENTE el comportamiento actual
 * (PDF binario directo a Gemini multimodal). El OCR es una mejora de
 * seguridad opcional, nunca un punto único de fallo nuevo.
 *
 * ── Rate limiting diario ────────────────────────────────────────────────
 * Mismo patrón que `bulk-evaluate-exams` (`_shared/cache.ts` →
 * `checkRateLimit`, `INCR`+`EXPIRE` sobre Upstash Redis vía REST). A
 * diferencia de Gemini (cuota grande, de pago por token), el servicio OCR
 * corre sobre una GPU autohospedada con `min-instances=0` — cada request
 * "despierta" la instancia y cuesta cómputo GPU real, así que el límite es
 * DIARIO y agresivo (`OCR_MAX_REQUESTS_PER_DAY`, default 200) y GLOBAL (una
 * sola key para todo el proyecto, no por docente) para topar el gasto total
 * de GPU/día sin importar cuántos docentes disparen evaluaciones en
 * paralelo. Sin credenciales de Upstash configuradas, `checkRateLimit`
 * degrada a `allowed:true` siempre (ver cache.ts) — eso sería peligroso
 * para un recurso de GPU de pago, así que aquí, a diferencia de
 * `bulk-evaluate-exams`, la AUSENCIA de backend de rate limit se trata como
 * "no disponible" (fail-closed hacia el fallback), no como "sin límite".
 *
 * ── Circuit breaker + backoff ───────────────────────────────────────────
 * Mismo patrón que `_shared/gemini.ts`: contador de fallos consecutivos en
 * memoria de la instancia (`consecutiveFailures`/`circuitOpenUntil`); tras
 * `FAILURE_THRESHOLD` fallos seguidos, el circuito se abre por
 * `COOLDOWN_MS` y toda llamada durante ese periodo se resuelve como
 * `{available:false}` sin intentar red. No hay backend distribuido (Redis)
 * para el breaker en sí (a diferencia de gemini.ts/distributedGeminiState.ts)
 * porque el rate limit diario ya es la defensa dura contra sobrecosto —el
 * breaker aquí solo evita seguir golpeando un servicio caído.
 */
import { cacheAvailable, checkRateLimit } from "./cache.ts"
import { validateFileBytes } from "./fileValidation.ts"

// ── Configuración (env vars) ────────────────────────────────────────────
const OCR_SERVICE_URL = Deno.env.get("OCR_SERVICE_URL") // ej. https://unlimited-ocr-xxxx-uc.a.run.app/v1/chat/completions
const OCR_SERVICE_TOKEN = Deno.env.get("OCR_SERVICE_TOKEN") // identity token / service-account token, SIEMPRE por header, nunca en la URL
const OCR_MODEL = Deno.env.get("OCR_MODEL") || "unlimited-ocr"

// `|| default`, no `??`: cubre env var ausente (undefined -> NaN) y presente
// pero vacía/no-numérica (Number("") === 0) — mismo criterio que gemini.ts.
const OCR_MAX_REQUESTS_PER_DAY = Number(Deno.env.get("OCR_MAX_REQUESTS_PER_DAY")) || 200
const OCR_MAX_FILE_SIZE_BYTES = Number(Deno.env.get("OCR_MAX_FILE_SIZE_BYTES")) || 15_000_000 // 15MB
const OCR_TIMEOUT_MS = Number(Deno.env.get("OCR_TIMEOUT_MS")) || 20_000

const RATE_LIMIT_KEY = "ocr:unlimited-ocr:daily" // global a propósito, ver comentario de arriba
const RATE_LIMIT_WINDOW_SECONDS = 86_400 // 24h

const FAILURE_THRESHOLD = 5
const COOLDOWN_MS = 30_000

let consecutiveFailures = 0
let circuitOpenUntil = 0

export type OcrUnavailableReason =
  | "not_configured"   // OCR_SERVICE_URL/OCR_SERVICE_TOKEN no configurados — feature apagada por defecto
  | "invalid_file"     // los magic bytes no coinciden con PDF (fileValidation.ts)
  | "file_too_large"   // excede OCR_MAX_FILE_SIZE_BYTES
  | "rate_limited"      // límite diario alcanzado (o sin backend de rate limit — fail-closed)
  | "circuit_open"     // breaker abierto tras fallos consecutivos
  | "timeout"          // el servicio no respondió dentro de OCR_TIMEOUT_MS
  | "service_error"    // el servicio respondió error / cuerpo inesperado

export interface OcrSuccess {
  available: true
  text: string
}

export interface OcrUnavailable {
  available: false
  reason: OcrUnavailableReason
  detail?: string
}

export type OcrResult = OcrSuccess | OcrUnavailable

/** true si hay endpoint + token configurados — la feature está apagada por defecto sin esto. */
export function isOcrConfigured(): boolean {
  return Boolean(OCR_SERVICE_URL && OCR_SERVICE_TOKEN)
}

function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil
}

function recordOutcome(isFailure: boolean): void {
  if (!isFailure) {
    consecutiveFailures = 0
    return
  }
  consecutiveFailures++
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + COOLDOWN_MS
    consecutiveFailures = 0 // arranca fresco cuando el cooldown termine (mismo criterio que gemini.ts)
  }
}

/** Solo para tests: resetea el estado del breaker en memoria del módulo. */
export function __resetOcrCircuitForTests(): void {
  consecutiveFailures = 0
  circuitOpenUntil = 0
}

/**
 * Extrae texto plano de un PDF vía el servicio OCR autohospedado (vLLM,
 * API OpenAI-compatible `/v1/chat/completions` con `image_url` en base64 —
 * mismo contrato que usa `_shared/localSlmFallback.ts` para su servidor).
 * NUNCA lanza — cualquier problema resuelve `{available:false, reason}`.
 */
export async function extractTextWithOcr(
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<OcrResult> {
  // ── 1. Feature apagada por defecto ───────────────────────────────────
  if (!isOcrConfigured()) return { available: false, reason: "not_configured" }

  // ── 2. Circuit breaker ───────────────────────────────────────────────
  if (isCircuitOpen()) return { available: false, reason: "circuit_open" }

  // ── 3. Validación de archivo ANTES de gastar GPU (magic bytes + tamaño) ─
  // Reutiliza el mismo patrón de magic-bytes que intelligent-file-parser/
  // import-ia-students (_shared/fileValidation.ts) — no confiar en que el
  // caller ya validó, este cliente es el último punto antes de pagar GPU.
  const fileCheck = validateFileBytes(bytes, "pdf")
  if (!fileCheck.ok) return { available: false, reason: "invalid_file", detail: fileCheck.reason }
  if (bytes.byteLength > OCR_MAX_FILE_SIZE_BYTES) {
    return { available: false, reason: "file_too_large", detail: `${bytes.byteLength} bytes > límite de ${OCR_MAX_FILE_SIZE_BYTES}` }
  }

  // ── 4. Rate limit diario (fail-closed sin backend, ver comentario arriba) ─
  // A diferencia de bulk-evaluate-exams, sin Upstash configurado NO se trata
  // como "sin límite" — checkRateLimit() degradaría a allowed:true siempre,
  // que para una GPU de pago sería justo lo peligroso que se quiere evitar.
  if (!cacheAvailable) return { available: false, reason: "rate_limited", detail: "Sin backend de rate limit (Upstash) configurado — fail-closed por costo de GPU." }
  const rateLimit = await checkRateLimit(RATE_LIMIT_KEY, OCR_MAX_REQUESTS_PER_DAY, RATE_LIMIT_WINDOW_SECONDS)
  if (!rateLimit.allowed) return { available: false, reason: "rate_limited" }

  // ── 5. Llamada real al servicio (auth por header, nunca URL abierta) ───
  const base64 = btoa(String.fromCharCode(...bytes))
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), OCR_TIMEOUT_MS)
  // Aborta si el caller cancela (signal) O si se cumple el timeout propio.
  const onCallerAbort = () => timeoutController.abort()
  signal.addEventListener("abort", onCallerAbort)

  try {
    let res: Response
    try {
      res = await fetch(OCR_SERVICE_URL as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OCR_SERVICE_TOKEN}`, // service-account/identity token — nunca en query string
        },
        body: JSON.stringify({
          model: OCR_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extrae TODO el texto visible de este documento, preservando el orden de lectura natural. Responde ÚNICAMENTE con el texto extraído, sin comentarios ni markdown." },
                { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
              ],
            },
          ],
          temperature: 0,
        }),
        signal: timeoutController.signal,
      })
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError"
      recordOutcome(true)
      return { available: false, reason: isTimeout ? "timeout" : "service_error", detail: err instanceof Error ? err.message : String(err) }
    }

    if (!res.ok) {
      recordOutcome(true)
      return { available: false, reason: "service_error", detail: `HTTP ${res.status}` }
    }

    let json: { choices?: { message?: { content?: string } }[] }
    try {
      json = await res.json()
    } catch {
      recordOutcome(true)
      return { available: false, reason: "service_error", detail: "Respuesta no es JSON válido." }
    }

    const text = json.choices?.[0]?.message?.content
    if (!text || !text.trim()) {
      recordOutcome(true)
      return { available: false, reason: "service_error", detail: "El servicio OCR devolvió texto vacío." }
    }

    recordOutcome(false)
    return { available: true, text }
  } finally {
    clearTimeout(timeoutId)
    signal.removeEventListener("abort", onCallerAbort)
  }
}
