// deno-lint-ignore-file no-import-prefix
/**
 * summarize-risk-signals
 * Traduce a lenguaje natural, para el docente, la salida YA CALCULADA de
 * compute-student-risk-signals — no recalcula nada ni deja que el LLM
 * invente cifras: recibe los números como contexto fijo en el prompt (mismo
 * patrón de anclaje estricto que ya usa graphrag-query) y solo redacta.
 *
 * Origen: qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md, punto 1.5.
 *
 * Alcance: SOLO alumnos en riesgo (en_riesgo=true) del propio curso del
 * docente — nunca compara alumnos entre sí en el texto generado, cada
 * resumen es independiente y visible solo al docente dueño del curso.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

const MAX_STUDENTS_PER_CALL = 15 // tope de costo — mismo espíritu que MAX_FILES en detect-cross-plagiarism

interface RiskStudent {
  student_id: string
  nombre: string
  asistencia_suavizada: number | null
  puntualidad_suavizada: number | null
  promedio_actividades_suavizado: number | null
  promedio_examenes_suavizado: number | null
  esfuerzo_suavizado: number | null
  correlacion_asistencia_calificaciones: number | null
  motivo_riesgo: string[]
  confianza_insuficiente: string[]
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 28_000)

  try {
    const { course_id, students } = await req.json() as { course_id?: string; students?: RiskStudent[] }
    if (!course_id) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'course_id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )
    const owns = await verifyCourseOwnership(serviceClient, course_id, userId)
    if (!owns) return new Response(
      JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // El caller (panel del docente) ya corrió compute-student-risk-signals y
    // filtró en_riesgo=true — este endpoint NO vuelve a calcular Kalman, solo
    // redacta sobre lo que ya se le pasa. Evita una segunda pasada costosa y
    // mantiene la separación "estimación numérica" vs. "redacción" clara.
    const riskStudents = (students ?? []).slice(0, MAX_STUDENTS_PER_CALL)
    if (riskStudents.length === 0) return new Response(
      JSON.stringify({ success: true, data: { resumenes: [] } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

    const contexto = riskStudents.map((s) => ({
      id: s.student_id,
      nombre: s.nombre,
      asistencia_0_a_1: s.asistencia_suavizada,
      puntualidad_0_a_1: s.puntualidad_suavizada, // 0=puntual, 1=al límite
      promedio_actividades_0_a_100: s.promedio_actividades_suavizado,
      promedio_examenes_0_a_100: s.promedio_examenes_suavizado,
      esfuerzo_0_a_5: s.esfuerzo_suavizado,
      correlacion_asistencia_calificaciones: s.correlacion_asistencia_calificaciones,
      motivos_de_riesgo_ya_detectados: s.motivo_riesgo,
      senales_con_pocas_observaciones: s.confianza_insuficiente,
    }))

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts: [{ text:
          `Eres un asistente que redacta briefs breves para un docente del TecNM sobre alumnos en riesgo académico.

          DATOS YA CALCULADOS (no los inventes, no los recalcules, solo redacta sobre ellos — cada campo ya
          viene de un filtro de Kalman/estadística real, no es tu trabajo generarlos):
          ${JSON.stringify(contexto)}

          Para cada alumno, escribe 1-2 frases en español, factuales, basadas ÚNICAMENTE en los números y
          motivos ya dados (no agregues diagnósticos que no estén soportados por los datos, no sugieras
          causas médicas/personales sin evidencia). Si "correlacion_asistencia_calificaciones" es baja
          (cercana a 0) pese a un motivo de riesgo de calificaciones, menciónalo explícitamente porque
          sugiere que la causa no es la asistencia.

          JSON puro sin markdown:
          {"resumenes":[{"student_id":"...","resumen":"..."}]}`
        }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
      },
      controller.signal,
    )

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson = await aiRes.json()
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error("Gemini devolvió respuesta vacía.")

    const parsed: { resumenes: { student_id: string; resumen: string }[] } = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(parsed), {
      serviceClient, teacherId: userId, toolName: "summarize_risk_signals", cors,
      errorBody: { success: false, error: "El resumen no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({ success: true, data: { resumenes: parsed.resumenes ?? [] } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (28s) generando resumen." : err instanceof Error ? err.message : "Error interno."
    console.error("[SUMMARIZE_RISK_SIGNALS]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
