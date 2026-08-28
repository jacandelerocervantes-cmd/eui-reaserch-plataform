// deno-lint-ignore-file no-import-prefix
/**
 * generate-docente-briefing
 * Brief narrativo del estado de un curso, integrando TODAS las señales que
 * ya existen por separado — Kalman de riesgo (compute-student-risk-signals),
 * calibración de IA de calificación (ai_calibration_state), y agregado de
 * patrones de trabajo de las actividades recientes
 * (compute-activity-work-patterns) — en un solo resumen en lenguaje natural.
 * Ningún número se inventa: todo lo que menciona el LLM viene de esos tres
 * endpoints, pasados como contexto fijo (mismo patrón de anclaje que
 * graphrag-query/summarize-risk-signals).
 *
 * Origen: qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md, punto 15.
 *
 * DISPARO: este repo NO tiene infraestructura de cron/jobs periódicos (sin
 * pg_cron, sin Supabase Scheduled Functions configuradas, confirmado por
 * grep sobre supabase/ — cero coincidencias). Este endpoint es invocable
 * bajo demanda desde el panel del docente (un botón "Generar briefing"),
 * IGUAL que el resto de la IA de esta plataforma (bulk-evaluate-exams,
 * analyze-exam-group-results, etc. — todos bajo demanda, no automáticos).
 * Si en el futuro se decide automatizarlo periódicamente, la opción nativa
 * de Supabase es una Scheduled Function
 * (https://supabase.com/docs/guides/functions/schedule-functions, usa
 * pg_cron + pg_net para invocar este mismo endpoint por HTTP en un
 * horario) — no requiere cambiar nada de este archivo, solo agregar la
 * entrada de cron en Supabase (paso de configuración humana, no de código,
 * documentado en 03-ROADMAP-DESPLIEGUE.md).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

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
    const { course_id } = await req.json()
    if (!course_id) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'course_id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )
    const owns = await verifyCourseOwnership(serviceClient, course_id, userId)
    if (!owns) return new Response(
      JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const baseUrl = Deno.env.get("SUPABASE_URL")
    const authHeader = req.headers.get("Authorization")
    if (!baseUrl) throw new Error("SUPABASE_URL no configurado.")

    // ── 1. Señales de riesgo (Kalman: asistencia/puntualidad/notas/exámenes/esfuerzo) ─
    const riskRes = await fetch(`${baseUrl}/functions/v1/compute-student-risk-signals`, {
      method: "POST", headers: { Authorization: authHeader ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({ course_id }), signal: controller.signal,
    })
    const riskJson = riskRes.ok ? await riskRes.json() : null
    const students = (riskJson?.data?.students ?? []) as { nombre: string; en_riesgo: boolean; motivo_riesgo: string[] }[]
    const enRiesgo = students.filter((s) => s.en_riesgo)

    // ── 2. Calibración de IA vigente (global — segmentación por curso es
    //      opcional, ver 04-RECOMENDACIONES-IA-DOCENTE.md punto 3.2) ────────
    const { data: calibraciones } = await serviceClient
      .from("ai_calibration_state")
      .select("domain, r2, rmse, confidence_threshold, course_id")
      .in("domain", ["exam_grading", "submission_grading"])
      .order("calibrated_at", { ascending: false })
      .limit(10)

    // ── 3. Actividades recientes del curso con agregado de patrones de trabajo ─
    const { data: recentAssignments } = await serviceClient
      .from("assignments")
      .select("id, title")
      .eq("course_id", course_id)
      .order("soft_deadline", { ascending: false })
      .limit(3)

    const workPatterns: unknown[] = []
    for (const a of recentAssignments ?? []) {
      try {
        const wpRes = await fetch(`${baseUrl}/functions/v1/compute-activity-work-patterns`, {
          method: "POST", headers: { Authorization: authHeader ?? "", "Content-Type": "application/json" },
          body: JSON.stringify({ assignment_id: a.id }), signal: controller.signal,
        })
        if (wpRes.ok) {
          const wpJson = await wpRes.json()
          if (wpJson?.data?.agregado !== null) workPatterns.push({ actividad: a.title, ...wpJson.data })
        }
      } catch (err) {
        console.error(`[GENERATE_DOCENTE_BRIEFING] work-patterns ${a.id}:`, err instanceof Error ? err.message : err)
      }
    }

    const contexto = {
      alumnos_en_riesgo: enRiesgo.map((s) => ({ nombre: s.nombre, motivos: s.motivo_riesgo })),
      n_alumnos_en_riesgo: enRiesgo.length,
      n_alumnos_total: students.length,
      calibracion_ia: calibraciones ?? [],
      patrones_de_trabajo_actividades_recientes: workPatterns,
    }

    // ── 4. Redacción — anclada estrictamente a `contexto`, no inventa cifras ─
    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts: [{ text:
          `Eres un asistente que redacta un briefing breve para un docente del TecNM sobre el estado actual de su curso.

          DATOS YA CALCULADOS (no los inventes, no recalcules nada, solo redacta sobre ellos):
          ${JSON.stringify(contexto)}

          Escribe un briefing de 100-180 palabras, en español, con esta estructura (sin markdown, sin asteriscos):
          RIESGO ACADÉMICO: cuántos alumnos en riesgo y de qué tipo (si hay varios con el mismo motivo, agrúpalos).
          CALIBRACIÓN DE IA: si la confiabilidad de la IA calificando es alta/media/baja según el R² más reciente.
          PATRONES DE TRABAJO: si hay señales de procrastinación (% cerca del deadline) u otro patrón notable en las
          actividades recientes — omite esta sección si no hay datos suficientes (agregado null por menos de 5 entregas).
          Si alguna sección no tiene datos, dilo explícitamente en 1 frase en vez de omitirla en silencio.`
        }] }],
        generationConfig: { temperature: 0.2 },
      },
      controller.signal,
    )

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson = await aiRes.json()
    const briefing = aiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "Sin briefing disponible."

    const guard = await guardOutputOrBlock(briefing, {
      serviceClient, teacherId: userId, toolName: "generate_docente_briefing", cors,
      errorBody: { success: false, error: "El briefing no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({ success: true, data: { briefing, contexto } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (28s) generando el briefing." : err instanceof Error ? err.message : "Error interno."
    console.error("[GENERATE_DOCENTE_BRIEFING]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
