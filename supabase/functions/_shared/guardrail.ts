// deno-lint-ignore-file no-import-prefix
/**
 * Guardrail compartido para las funciones que hablan con Gemini.
 *
 * Hoy ninguna función filtra PII, detecta inyección de prompt ni revisa la
 * salida del modelo antes de persistirla o devolverla (confirmado por
 * auditoría — ver docs/04_Multi_Agente_MCP.md). Esto centraliza las tres
 * comprobaciones en un solo punto para no repetir regex distintas por
 * función, y para que subir el nivel de defensa sea cambiar un archivo, no 17.
 *
 * No bloquea agresivamente: la plataforma sirve a docentes autenticados
 * generando material educativo, no es un chat público. El objetivo es
 * *degradar con evidencia* (loguear, marcar para revisión) en vez de romper
 * flujos legítimos por falsos positivos — mismo principio que el resto del
 * repo ("degradar, no fallar", traspaso/CONTRATOS-COMPARTIDOS.md §8).
 */

// ── 1. PII ───────────────────────────────────────────────────────────────
// Los patrones cubren lo que puede colarse en un prompt de docente (pegar un
// listado de alumnos con matrícula/correo) o en un archivo subido por un
// estudiante (evaluate-submissions-ia). No pretende ser DLP exhaustivo: es
// una malla de bajo costo antes de que el texto salga hacia Gemini.
const PII_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "email", re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { label: "telefono_mx", re: /\b(?:\+?52\s?)?(?:1\s?)?\d{2,3}[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g },
  // Matrícula TecNM: típicamente 8 dígitos consecutivos.
  { label: "matricula", re: /\b\d{8}\b/g },
  { label: "curp", re: /\b[A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM][A-Z]{5}[A-Z0-9]\d\b/g },
]

export interface PiiScanResult {
  found: string[]           // etiquetas de los tipos detectados, p. ej. ["email", "matricula"]
  redacted: string           // texto con las coincidencias reemplazadas por [REDACTADO:tipo]
}

/** Detecta y enmascara PII en texto libre antes de mandarlo al modelo o de guardarlo en logs. */
export function scanAndRedactPii(text: string): PiiScanResult {
  const found = new Set<string>()
  let redacted = text
  for (const { label, re } of PII_PATTERNS) {
    if (re.test(text)) {
      found.add(label)
      redacted = redacted.replace(re, `[REDACTADO:${label}]`)
    }
    re.lastIndex = 0 // los regex globales son statefuls; sin esto, la 2ª llamada falla en falso negativo
  }
  return { found: [...found], redacted }
}

// ── 2. Inyección de prompt / jailbreak ──────────────────────────────────
// Frases típicas de "olvida tus instrucciones" en ES/EN. Vive como lista
// explícita (no como clasificador con IA) a propósito: un clasificador basado
// en el mismo LLM que se quiere proteger es un guardia que se puede sobornar
// con el mismo ataque (visto en evaluate-submissions-ia: el "integrity_flag"
// hoy lo reporta el propio modelo que califica, ver hallazgo §3 del audit).
const INJECTION_PATTERNS: RegExp[] = [
  /ignor[ae]\s+(todas\s+)?las?\s+instruccion/i,
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(the\s+)?(system|previous)\s+prompt/i,
  /eres\s+(ahora\s+)?(un|otro)\s+asistente\s+sin\s+restricciones/i,
  /you\s+are\s+now\s+(a|an)\s+.*(unrestricted|jailbroken|dan)/i,
  /muestra\s+(tu|el)\s+prompt\s+(de\s+)?sistema/i,
  /reveal\s+(your\s+)?system\s+prompt/i,
  /as[ií]gna(me)?\s+(la\s+)?(calificaci[oó]n|nota|puntaje)\s+(m[aá]xima|100|perfecta)/i,
  /dale?\s+(al\s+alumno\s+)?100\s+(sin|aunque no)/i,
  /act[uú]a\s+como\s+si\s+(no\s+tuvieras|fueras)/i,
]

export interface InjectionScanResult {
  suspect: boolean
  matched: string[]   // fragmentos de patrón que dispararon, para el log
}

/**
 * Escanea texto que viene de un actor potencialmente hostil respecto al
 * prompt (mensaje de chat, contenido de un archivo subido por un alumno,
 * respuesta a un examen) antes de interpolarlo en el prompt del sistema.
 */
export function scanPromptInjection(text: string): InjectionScanResult {
  const matched: string[] = []
  for (const re of INJECTION_PATTERNS) {
    const m = text.match(re)
    if (m) matched.push(m[0])
  }
  return { suspect: matched.length > 0, matched }
}

// ── 3. Salida de alto riesgo / sesgo ────────────────────────────────────
// No intenta juzgar calidad pedagógica — eso lo valida el propio "type"/schema
// de cada función. Esto busca patrones que NUNCA deberían aparecer en una
// respuesta dirigida a un estudiante o docente: fuga del propio sistema,
// o lenguaje discriminatorio hacia un alumno identificado.
const HIGH_RISK_OUTPUT_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "fuga_prompt_sistema", re: /DIRECTIVA DEL DOCENTE|REGLAS DE GENERACI[OÓ]N|ESTADO ACTUAL DEL EXAMEN/i },
  { label: "lenguaje_discriminatorio", re: /\b(por ser|porque es)\s+(mujer|hombre|indígena|extranjero|discapacitad[oa])\b/i },
]

export interface OutputScanResult {
  flagged: string[]
  requiresHumanReview: boolean
}

/** Revisa la salida cruda del modelo antes de persistirla o devolverla al cliente. */
export function scanOutput(text: string): OutputScanResult {
  const flagged: string[] = []
  for (const { label, re } of HIGH_RISK_OUTPUT_PATTERNS) {
    if (re.test(text)) flagged.push(label)
  }
  return { flagged, requiresHumanReview: flagged.length > 0 }
}

// ── 4. Punto de entrada único ───────────────────────────────────────────
export interface GuardrailInputResult {
  safeText: string          // texto ya redactado de PII, listo para interpolar en el prompt
  block: boolean            // true solo ante inyección de alta confianza en INPUT de un actor no-docente
  reasons: string[]         // para logging en ai_action_log
}

/**
 * Aplica el guardrail de entrada. `trustedActor` distingue al docente
 * autenticado (que ya pasó verifyDocente) de contenido de terceros dentro de
 * su request (mensaje de alumno, archivo subido) — solo el segundo se
 * bloquea ante inyección; al docente se le redacta PII pero no se le corta,
 * porque bloquear a quien ya tiene rol verificado degrada el producto sin
 * ganar seguridad real.
 */
export function applyInputGuardrail(text: string, trustedActor: boolean): GuardrailInputResult {
  const pii = scanAndRedactPii(text)
  const injection = scanPromptInjection(text)
  const reasons = [...pii.found.map((f) => `pii:${f}`), ...injection.matched.map((m) => `injection:${m}`)]

  return {
    safeText: pii.redacted,
    block: injection.suspect && !trustedActor,
    reasons,
  }
}

export interface GuardrailOutputResult {
  allow: boolean
  requiresHumanReview: boolean
  reasons: string[]
}

/** Aplica el guardrail de salida sobre el texto crudo devuelto por Gemini. */
export function applyOutputGuardrail(text: string): GuardrailOutputResult {
  const scan = scanOutput(text)
  return {
    allow: !scan.flagged.includes("fuga_prompt_sistema"), // fuga de prompt sí se bloquea siempre
    requiresHumanReview: scan.requiresHumanReview,
    reasons: scan.flagged,
  }
}

// ── 5. Wiring de una sola línea por función ─────────────────────────────
// Las ~27 Edge Functions que llaman a Gemini tienen 27 formas distintas de
// dar forma a su Response de error ({error}, {success:false,error}, etc.) —
// en vez de forzar un contrato de respuesta único (rompería a los clientes
// que ya parsean cada forma), este helper deja que cada función pase su
// propio cuerpo de error y solo centraliza lo que SÍ debe ser idéntico en
// las 27: correr el scan, loguear en ai_action_log (mismo patrón que
// admin-revert-action/admin-overview, no una tabla nueva) y construir la
// Response de bloqueo.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

export interface GuardOutputOptions {
  serviceClient: SupabaseClient
  teacherId: string
  toolName: string
  cors: HeadersInit
  errorBody: Record<string, unknown>
  blockStatus?: number
}

export type GuardOutputResult =
  | { blocked: true; response: Response }
  | { blocked: false; requiresHumanReview: boolean; reasons: string[] }

/**
 * Corre `applyOutputGuardrail` sobre `text`, deja constancia en
 * `ai_action_log` si hubo cualquier hallazgo, y devuelve ya armada la
 * Response de bloqueo si corresponde — para que cada función solo tenga que
 * hacer `if (guard.blocked) return guard.response`.
 */
export async function guardOutputOrBlock(text: string, opts: GuardOutputOptions): Promise<GuardOutputResult> {
  const scan = applyOutputGuardrail(text)

  if (!scan.allow) {
    await opts.serviceClient.from("ai_action_log").insert({
      teacher_id: opts.teacherId, tool_name: opts.toolName,
      success: false, metadata: { guardrail_block_output: true, reasons: scan.reasons },
    }).then(() => {}, () => {})
    return {
      blocked: true,
      response: new Response(JSON.stringify(opts.errorBody), {
        status: opts.blockStatus ?? 422,
        headers: { ...opts.cors, "Content-Type": "application/json" },
      }),
    }
  }

  if (scan.reasons.length) {
    await opts.serviceClient.from("ai_action_log").insert({
      teacher_id: opts.teacherId, tool_name: opts.toolName,
      success: true, metadata: { guardrail_reasons: scan.reasons.map((r) => `output:${r}`) },
    }).then(() => {}, () => {})
  }

  return { blocked: false, requiresHumanReview: scan.requiresHumanReview, reasons: scan.reasons }
}
