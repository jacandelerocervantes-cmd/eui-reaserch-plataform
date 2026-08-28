// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { checkRateLimit } from "../_shared/cache.ts"
import { applyInputGuardrail, guardOutputOrBlock } from "../_shared/guardrail.ts"

// 1.3 de docs/01_ARQUITECTURA_DEVOPS_FRUGAL.md: evita que una ráfaga de
// llamadas (el cliente reintenta automáticamente mientras `remaining > 0`)
// agote de un solo golpe la cuota de la API de IA comercial en época de
// cierre de semestre. Por docente, no global — no penaliza a un docente
// por la carga de otro.
const RATE_LIMIT_MAX_CALLS = 20
const RATE_LIMIT_WINDOW_SECONDS = 60

type EvalQuestion = {
  id: string;
  q_type: string;
  content: string;
  correct_answer: string | null;
  points: number | null;
  options: unknown;
};

// Respuestas de texto: 8 × ~2s ≈ 16s dentro del budget de 30s por llamada.
// El cliente llama de nuevo si remaining > 0 (patrón cursor-DB).
const BATCH_SIZE = 8

// Solo "open" requiere juicio semántico — el resto de los tipos tiene una
// respuesta correcta objetiva y se califica determinísticamente en JS, sin
// gastar llamadas a Gemini ni introducir no-determinismo donde no aplica.
const DETERMINISTIC_TYPES = ['multiple_choice', 'true_false', 'matching', 'short_answer', 'fill_blank', 'ordering', 'multi_select']

const normalize = (s: unknown): string =>
  (s ?? "").toString().trim().toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "")

function scoreDeterministic(q: EvalQuestion, studentAnswer: unknown): number {
  const points = q.points ?? 10
  switch (q.q_type) {
    case 'multiple_choice':
    case 'true_false':
      return normalize(studentAnswer) === normalize(q.correct_answer) ? points : 0

    case 'matching': {
      let correctIdxs: number[] = []
      try { correctIdxs = JSON.parse(q.correct_answer ?? "[]") } catch { /* deja vacío */ }
      const alumnoMap = (studentAnswer ?? {}) as Record<number, unknown>
      const total = correctIdxs.length || 1
      let aciertos = 0
      correctIdxs.forEach((correctIdx, leftIdx) => { if (Number(alumnoMap[leftIdx]) === correctIdx) aciertos++ })
      return Number(((aciertos / total) * points).toFixed(2))
    }

    case 'short_answer': {
      let accepted: string[] = []
      try { accepted = JSON.parse(q.correct_answer ?? "[]") } catch { /* deja vacío */ }
      const norm = normalize(studentAnswer)
      return accepted.some((a) => normalize(a) === norm) ? points : 0
    }

    case 'fill_blank': {
      let expected: string[] = []
      try { expected = JSON.parse(q.correct_answer ?? "[]") } catch { /* deja vacío */ }
      const given: unknown[] = Array.isArray(studentAnswer) ? studentAnswer : []
      const total = expected.length || 1
      let aciertos = 0
      expected.forEach((exp, i) => { if (normalize(given[i]) === normalize(exp)) aciertos++ })
      return Number(((aciertos / total) * points).toFixed(2))
    }

    case 'ordering': {
      let expected: string[] = []
      try { expected = JSON.parse(q.correct_answer ?? "[]") } catch { /* deja vacío */ }
      const given: unknown[] = Array.isArray(studentAnswer) ? studentAnswer : []
      const total = expected.length || 1
      let aciertos = 0
      expected.forEach((exp, i) => { if (normalize(given[i]) === normalize(exp)) aciertos++ })
      return Number(((aciertos / total) * points).toFixed(2))
    }

    case 'multi_select': {
      let correct: string[] = []
      try { correct = JSON.parse(q.correct_answer ?? "[]") } catch { /* deja vacío */ }
      const given: unknown[] = Array.isArray(studentAnswer) ? studentAnswer : []
      const correctSet = new Set(correct.map(normalize))
      const givenSet = new Set(given.map(normalize))
      let hits = 0, misses = 0
      givenSet.forEach((g) => { if (correctSet.has(g)) hits++; else misses++ })
      const total = correctSet.size || 1
      // Penaliza sobre-selección: (aciertos - errores) / correctas_totales, sin bajar de 0.
      return Number((Math.max(0, (hits - misses) / total) * points).toFixed(2))
    }

    default:
      return 0
  }
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  // ── 1.b Rate limit por docente ──────────────────────────────────────────
  const rateLimit = await checkRateLimit(`ratelimit:bulk-evaluate-exams:${userId}`, RATE_LIMIT_MAX_CALLS, RATE_LIMIT_WINDOW_SECONDS)
  if (!rateLimit.allowed) return new Response(
    JSON.stringify({ error: `Límite de ${RATE_LIMIT_MAX_CALLS} llamadas/min alcanzado. Intenta de nuevo en unos segundos.` }),
    { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) } }
  )

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  try {
    const { examId, studentIds } = await req.json()
    if (!examId || !studentIds?.length) return new Response(
      JSON.stringify({ error: "Se requieren 'examId' y 'studentIds'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── 2. Examen y ownership ─────────────────────────────────────────────
    const { data: exam } = await serviceClient
      .from("exams")
      .select("id, course_id, title")
      .eq("id", examId)
      .single()

    if (!exam) return new Response(
      JSON.stringify({ error: "Examen no encontrado." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    if (exam.course_id) {
      const owns = await verifyCourseOwnership(serviceClient, exam.course_id, userId)
      if (!owns) return new Response(
        JSON.stringify({ error: "No tienes permiso sobre este examen." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // Umbral calibrado empíricamente (validate-ai-grading + calibrate-ai-thresholds)
    // — una sola lectura por lote, no por alumno. Segmentado por curso
    // (04-RECOMENDACIONES-IA-DOCENTE.md punto 3.2): intenta primero la
    // calibración específica de ESTE curso; si no existe (curso nuevo, sin
    // historial propio todavía), cae a la calibración global agregada; si
    // tampoco hay ninguna, usa el default de la tabla (0.3) en vez de fallar.
    let confidenceThreshold = 0.3
    if (exam.course_id) {
      const { data: courseCalibration } = await serviceClient
        .from("ai_calibration_state")
        .select("confidence_threshold")
        .eq("domain", "exam_grading").eq("course_id", exam.course_id)
        .order("calibrated_at", { ascending: false }).limit(1).maybeSingle()
      if (courseCalibration) confidenceThreshold = courseCalibration.confidence_threshold
      else {
        const { data: globalCalibration } = await serviceClient
          .from("ai_calibration_state")
          .select("confidence_threshold")
          .eq("domain", "exam_grading").is("course_id", null)
          .order("calibrated_at", { ascending: false }).limit(1).maybeSingle()
        if (globalCalibration) confidenceThreshold = globalCalibration.confidence_threshold
      }
    }

    // ── 3. Reactivos del examen ────────────────────────────────────────────
    const { data: questionsRaw } = await serviceClient
      .from("questions")
      .select("id, q_type, content, correct_answer, points, options")
      .eq("exam_id", examId)
    const questions = questionsRaw as EvalQuestion[] | null

    if (!questions?.length) return new Response(
      JSON.stringify({ error: "El examen no tiene reactivos." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── 4. Checkpoint de entrada: marcar elegibles → ai_queued ───────────
    // Idempotente: no sobreescribe ai_queued/ai_draft/completed existentes.
    await serviceClient
      .from("evaluation_responses")
      .update({ status: "ai_queued" })
      .eq("exam_id", examId)
      .in("student_id", studentIds)
      .not("status", "in", '("ai_queued","ai_draft","completed")')

    // ── 5. Tomar el siguiente lote pendiente ──────────────────────────────
    const { data: batch } = await serviceClient
      .from("evaluation_responses")
      .select("id, student_id, answers, metadata")
      .eq("exam_id", examId)
      .in("student_id", studentIds)
      .eq("status", "ai_queued")
      .limit(BATCH_SIZE)

    if (!batch?.length) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, remaining: 0, done: true }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 6. Evaluar cada alumno del lote ───────────────────────────────────
    let processed = 0

    for (const resp of batch) {
      if (!resp.answers) {
        await serviceClient
          .from("evaluation_responses")
          .update({ status: "sin_respuestas" })
          .eq("id", resp.id)
        continue
      }

      const controller = new AbortController()
      const timeout    = setTimeout(() => controller.abort(), 22_000)

      try {
        // Todo lo que tiene una respuesta objetivamente correcta se califica
        // determinísticamente en JS — solo "open" requiere juicio semántico
        // y se manda a Gemini.
        const deterministicQuestions = questions.filter((q) => DETERMINISTIC_TYPES.includes(q.q_type))
        const aiQuestions            = questions.filter((q) => q.q_type === 'open')
        const answers = resp.answers as Record<string, unknown> | null

        const deterministicScores: Record<string, number> = {}
        for (const q of deterministicQuestions) {
          deterministicScores[q.id] = scoreDeterministic(q, answers?.[q.id])
        }
        const deterministicTotal = Object.values(deterministicScores).reduce((a, b) => a + b, 0)

        // Guardrail de entrada: la respuesta abierta la escribe el alumno,
        // no el docente que llama este endpoint — trustedActor=false, mismo
        // criterio que evaluate-submissions-ia. A diferencia de esa función,
        // aquí SÍ hay texto (no un PDF binario), así que sí se puede escanear.
        let inputBlocked = false
        const inputGuardReasons: string[] = []
        const pares = aiQuestions.map((q) => {
          const raw = answers?.[q.id]
          let respuestaAlumno = raw
          if (typeof raw === "string") {
            const scan = applyInputGuardrail(raw, false)
            if (scan.block) inputBlocked = true
            if (scan.reasons.length) inputGuardReasons.push(...scan.reasons)
            respuestaAlumno = scan.safeText
          }
          return {
            id:                  q.id,
            tipo:                q.q_type,
            pregunta:            q.content,
            respuesta_correcta:  q.correct_answer,
            puntos_maximos:      q.points ?? 10,
            respuesta_alumno:    respuestaAlumno ?? null,
          }
        })

        let aiScore = 0
        let aiFeedback = ""
        let aiQuestionScores: Record<string, number> = {}
        let requiereRevisionPorGuardrail = false

        if (inputBlocked) {
          // No se manda a Gemini: se deja en 0 y marcado para que el docente
          // revise manualmente la respuesta sospechosa antes de calificar.
          await serviceClient.from("ai_action_log").insert({
            teacher_id: userId, tool_name: "bulk_evaluate_exams",
            success: false, metadata: { guardrail_block_input: true, reasons: inputGuardReasons, evaluation_response_id: resp.id },
          }).then(() => {}, () => {})
          aiFeedback = "Respuesta abierta bloqueada por el guardrail (posible inyección de instrucciones). Revisión manual requerida."
          requiereRevisionPorGuardrail = true
        } else if (pares.length > 0) {
          const aiRes = await fetchGeminiWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
                contents: [{
                  parts: [{ text:
                    `Eres evaluador académico del TecNM. Califica este examen objetivamente.

EXAMEN: "${exam.title ?? "Evaluación"}"
PUNTUACIÓN MÁXIMA TOTAL (solo estos reactivos): ${pares.reduce((s, p) => s + p.puntos_maximos, 0)} puntos

REACTIVOS Y RESPUESTAS:
${JSON.stringify(pares, null, 2)}

REGLAS DE CALIFICACIÓN — APLICA SIN EXCEPCIÓN. Todos los reactivos de esta
lista son tipo "open" (los demás tipos ya se calificaron de forma
determinística aparte):
1. Evalúa la corrección conceptual y completitud de forma semántica contra
   respuesta_correcta (guía de evaluación del docente).
   - Asigna entre 0 y puntos_maximos de forma gradual y justificada.
   - Una respuesta en blanco o irrelevante → 0 puntos.
2. respuesta_alumno null o vacía → 0 puntos.
3. score: SUMA de puntos obtenidos en todos los reactivos de esta lista (número, no porcentaje).
4. feedback: español, 80-120 palabras. Menciona exactamente 1 fortaleza conceptual
   y 1 área de mejora con referencia a un reactivo específico. Sin saludos.
5. question_scores: clave = id del reactivo (string), valor = puntos obtenidos (número).

JSON puro sin markdown:
{"score":0,"feedback":"...","question_scores":{"id_reactivo":0}}`
                  }]
                }],
                generationConfig: { response_mime_type: "application/json", temperature: 0.05 },
            },
            controller.signal,
          )

          if (!aiRes.ok) throw new Error(`Gemini ${aiRes.status}`)
          const aiJson   = await aiRes.json()
          const content  = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
          if (!content)  throw new Error("Gemini devolvió respuesta vacía.")
          const evaluation = JSON.parse(content)
          aiScore = evaluation.score ?? 0
          aiFeedback = evaluation.feedback ?? ""
          aiQuestionScores = evaluation.question_scores ?? {}

          // Guardrail de salida sobre el feedback antes de persistirlo.
          const outputGuard = await guardOutputOrBlock(aiFeedback, {
            serviceClient, teacherId: userId, toolName: "bulk_evaluate_exams", cors,
            errorBody: { error: "El feedback no pudo mostrarse por una regla de seguridad interna." },
          })
          if (outputGuard.blocked) {
            aiFeedback = "Feedback bloqueado por el guardrail de salida. Revisión manual requerida."
            requiereRevisionPorGuardrail = true
          } else if (outputGuard.requiresHumanReview) {
            requiereRevisionPorGuardrail = true
          }
        }

        // Muestreo proporcional al umbral calibrado: cuanto peor validó la
        // IA históricamente (R²/RMSE bajos), mayor la fracción marcada para
        // revisión obligatoria — ver VALIDACION_Y_CALIBRACION.md. No cambia
        // el status (sigue "ai_draft", el docente siempre revisa el borrador
        // antes de publicar) — solo prioriza cuáles NO deberían aprobarse
        // en bloque sin mirarlos uno por uno.
        const requierePrioridad = Math.random() < confidenceThreshold || requiereRevisionPorGuardrail

        await serviceClient
          .from("evaluation_responses")
          .update({
            score_ia:    Number((aiScore + deterministicTotal).toFixed(2)),
            feedback_ia: aiFeedback || "Reactivos de opción objetiva calificados automáticamente; sin retroalimentación semántica adicional.",
            metadata:    { ...(resp.metadata ?? {}), question_scores: { ...aiQuestionScores, ...deterministicScores }, requiere_revision_prioritaria: requierePrioridad },
            status:      "ai_draft",
          })
          .eq("id", resp.id)

        processed++
      } catch (err) {
        // Item queda en ai_queued — el próximo call lo retoma automáticamente.
        console.error(`[BULK_EVAL] alumno ${resp.student_id}:`, err instanceof Error ? err.message : err)
      } finally {
        clearTimeout(timeout)
      }
    }

    // ── 7. Contar pendientes para que el cliente decida si llama de nuevo ─
    const { count: remaining } = await serviceClient
      .from("evaluation_responses")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId)
      .in("student_id", studentIds)
      .eq("status", "ai_queued")

    return new Response(
      JSON.stringify({
        success:   true,
        processed,
        remaining: remaining ?? 0,
        done:      (remaining ?? 0) === 0,
        message:   `Lote: ${processed}/${batch.length} evaluados. Pendientes: ${remaining ?? 0}.`,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[BULK_EVALUATE_EXAMS]", msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
