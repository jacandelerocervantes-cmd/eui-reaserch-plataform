// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * sync-form-responses
 * Sincroniza bajo demanda las respuestas enviadas a un Google Form vinculado
 * con una evaluación de la plataforma EUI Research.
 *
 * 1. Extrae todas las respuestas directamente de Google Forms vía Apps Script
 *    (obtenerRespuestasGoogleForm).
 * 2. Asocia cada respuesta a un estudiante del curso (por correo o matrícula).
 * 3. Traduce los ítems del Form a reactivos internos usando `exam_form_items`.
 * 4. Califica automáticamente todos los reactivos determinísticos (opción múltiple,
 *    falso/verdadero, relacionar, ordenar, opción múltiple compuesta, etc.).
 * 5. Persiste el resultado en `public.evaluation_responses`, dejándolo listo
 *    para consulta en /panel/materias/[id]/evaluaciones/[examId]/resultados.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"

const normalize = (s: unknown): string =>
  (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

function stripOptionPrefix(text: string): string {
  return text.replace(/^[a-zA-Z][\)\.\-]\s*/, "").trim()
}

function matchesChoice(studentAns: unknown, correctAns: unknown): boolean {
  const normStudent = normalize(studentAns)
  const normCorrect = normalize(correctAns)
  if (!normStudent || !normCorrect) return false
  if (normStudent === normCorrect) return true

  // Si uno tiene prefijo tipo "B) " y el otro no
  const strippedStudent = normalize(stripOptionPrefix(String(studentAns ?? "")))
  const strippedCorrect = normalize(stripOptionPrefix(String(correctAns ?? "")))
  if (strippedStudent && strippedCorrect && strippedStudent === strippedCorrect) return true

  // Comparar solo la letra de opción si viene "B" vs "B) Lignina"
  const letterStudent = String(studentAns ?? "").trim().match(/^([a-zA-Z])[\)\.]?/)?.[1]?.toLowerCase()
  const letterCorrect = String(correctAns ?? "").trim().match(/^([a-zA-Z])[\)\.]?/)?.[1]?.toLowerCase()
  if (letterStudent && letterCorrect && letterStudent === letterCorrect) return true

  return false
}

function scoreQuestion(q: any, studentAnswer: unknown): number {
  const points = Number(q.points) || 1
  const t = q.q_type

  switch (t) {
    case 'multiple_choice':
    case 'true_false': {
      return matchesChoice(studentAnswer, q.correct_answer) ? points : 0
    }

    case 'matching': {
      let correctArr: number[] = []
      try {
        correctArr = typeof q.correct_answer === "string" ? JSON.parse(q.correct_answer) : (q.correct_answer || [])
      } catch {
        correctArr = []
      }
      const right: string[] = q.options?.right || []
      const left: string[] = q.options?.left || []
      const total = left.length || correctArr.length || 1
      const studentMap = (studentAnswer || {}) as Record<string | number, unknown>
      let aciertos = 0

      for (let i = 0; i < total; i++) {
        const givenVal = studentMap[i]
        const expectedRightIdx = correctArr[i]
        const expectedRightText = right[expectedRightIdx]

        if (typeof givenVal === "number" && givenVal === expectedRightIdx) {
          aciertos++
        } else if (typeof givenVal === "string" && expectedRightText) {
          if (normalize(givenVal) === normalize(expectedRightText) || matchesChoice(givenVal, expectedRightText)) {
            aciertos++
          }
        }
      }
      return Number(((aciertos / total) * points).toFixed(2))
    }

    case 'short_answer': {
      let accepted: string[] = []
      try {
        accepted = typeof q.correct_answer === "string" ? JSON.parse(q.correct_answer) : [q.correct_answer]
      } catch {
        accepted = [String(q.correct_answer || "")]
      }
      if (!Array.isArray(accepted)) accepted = [String(accepted || "")]
      const norm = normalize(studentAnswer)
      return accepted.some((a) => normalize(a) === norm) ? points : 0
    }

    case 'fill_blank':
    case 'ordering': {
      let expected: string[] = []
      try {
        expected = typeof q.correct_answer === "string" ? JSON.parse(q.correct_answer) : (q.correct_answer || [])
      } catch {
        expected = []
      }
      const given: unknown[] = Array.isArray(studentAnswer) ? studentAnswer : []
      const total = expected.length || 1
      let aciertos = 0
      expected.forEach((exp, i) => {
        if (normalize(given[i]) === normalize(exp)) aciertos++
      })
      return Number(((aciertos / total) * points).toFixed(2))
    }

    case 'multi_select': {
      let correct: string[] = []
      try {
        correct = typeof q.correct_answer === "string" ? JSON.parse(q.correct_answer) : (q.correct_answer || [])
      } catch {
        correct = []
      }
      const given: unknown[] = Array.isArray(studentAnswer) ? studentAnswer : []
      const correctSet = new Set(correct.map(normalize))
      const givenSet = new Set(given.map(normalize))
      let hits = 0, misses = 0
      givenSet.forEach((g) => {
        if (correctSet.has(g)) hits++
        else misses++
      })
      const total = correctSet.size || 1
      return Number((Math.max(0, (hits - misses) / total) * points).toFixed(2))
    }

    case 'open':
    default:
      return 0
  }
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim()
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!

  let isServiceRole = Boolean(serviceRoleKey && token === serviceRoleKey)
  if (!isServiceRole && token.includes(".")) {
    try {
      const parts = token.split(".")
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        if (payload.role === "service_role") isServiceRole = true
      }
    } catch {}
  }

  let serviceClient: any
  let userId: string | null = null

  if (isServiceRole) {
    serviceClient = createClient(SUPABASE_URL, serviceRoleKey)
  } else {
    const auth = await verifyDocente(req)
    if (!auth.ok) return errorResponse(auth.err, cors)
    userId = auth.ctx.userId
    serviceClient = auth.ctx.serviceClient
  }

  try {
    const body = await req.json()
    const { examId, responses: directResponses, forceSync } = body

    if (!examId) {
      return new Response(
        JSON.stringify({ success: false, error: "Se requiere 'examId'." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 1. Obtener información del examen ─────────────────────────────────
    const { data: exam, error: examErr } = await serviceClient
      .from("exams")
      .select("id, title, google_form_id, google_form_url, deployment_method, course_units(course_id, courses(id, teacher_id))")
      .eq("id", examId)
      .single()

    if (examErr || !exam) {
      return new Response(
        JSON.stringify({ success: false, error: "Examen no encontrado." }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const courseId = (exam as any).course_units?.course_id
    if (userId && (!courseId || !(await verifyCourseOwnership(serviceClient, courseId, userId)))) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre este examen." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    if (!exam.google_form_id && !Array.isArray(directResponses)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Este examen no tiene un Google Form vinculado ni se proporcionaron respuestas directas.",
        }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 2. Obtener respuestas de Google Forms (o usar directResponses) ─────
    let formResponses: any[] = []

    if (Array.isArray(directResponses) && directResponses.length > 0) {
      formResponses = directResponses
    } else {
      const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
      const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")
      if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no está configurado en Supabase Secrets.")

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60_000)

      try {
        const res = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: WEBHOOK_SECRET,
            action: "obtenerRespuestasGoogleForm",
            payload: { formId: exam.google_form_id },
          }),
          signal: controller.signal,
        })
        const json = await res.json()
        const scriptData = json.success ? (json.data ?? {}) : { success: false, error: json.error }

        if (!scriptData.success) {
          throw new Error(scriptData.error || "Error al leer respuestas desde Google Forms.")
        }
        formResponses = scriptData.responses || []
      } finally {
        clearTimeout(timeout)
      }
    }

    if (!formResponses.length) {
      return new Response(
        JSON.stringify({
          success: true,
          totalFormResponses: 0,
          syncedCount: 0,
          unmappedResponses: [],
          message: "Google Forms no tiene respuestas registradas todavía.",
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 3. Cargar Alumnos, Mapeo de Reactivos y Preguntas ──────────────────
    const { data: students } = await serviceClient
      .from("students")
      .select("id, matricula, correo, nombres, apellido_paterno, apellido_materno, student_profile_id")
      .eq("course_id", courseId)

    const { data: formItems } = await serviceClient
      .from("exam_form_items")
      .select("question_id, form_item_id, sub_index, id, created_at")
      .eq("exam_id", examId)
      .order("created_at", { ascending: true })

    const { data: questions } = await serviceClient
      .from("questions")
      .select("id, q_type, content, options, correct_answer, points, order_index")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true })

    if (!questions || !questions.length) {
      throw new Error("El examen no tiene reactivos en la base de datos.")
    }

    const questionById = new Map<string, any>((questions || []).map((q: any) => [q.id, q]))
    const itemMap = new Map<string, any>((formItems || []).map((fi: any) => [String(fi.form_item_id), fi]))

    // Para preguntas matching / ordering donde sub_index pudo ser null,
    // ordenamos los form_item_id por orden de inserción dentro de cada question_id
    const formItemsByQuestion = new Map<string, any[]>()
    for (const fi of (formItems || [])) {
      const qList = formItemsByQuestion.get(fi.question_id) || []
      qList.push(fi)
      formItemsByQuestion.set(fi.question_id, qList)
    }

    // Mapeo auxiliar de alumnos por correo normalizado y matrícula
    const studentByEmail = new Map<string, any>()
    const studentByMatricula = new Map<string, any>()
    for (const s of (students || [])) {
      if (s.correo) studentByEmail.set(normalize(s.correo), s)
      if (s.matricula) studentByMatricula.set(s.matricula.trim(), s)
    }

    // ── 4. Procesar cada respuesta de Google Forms ────────────────────────
    let syncedCount = 0
    const unmappedResponses: Array<{ email: string; timestamp: string | null }> = []
    const hasOpenQuestions = questions.some((q: any) => q.q_type === "open")

    for (const fr of formResponses) {
      const rawEmail = (fr.respondentEmail || "").trim()
      const normEmail = normalize(rawEmail)
      let student = studentByEmail.get(normEmail)

      // Fallback 1: Buscar dígitos de matrícula en el correo (ej: 25890008@...)
      if (!student && rawEmail) {
        const digits = rawEmail.match(/\d{6,10}/)?.[0]
        if (digits && studentByMatricula.has(digits)) {
          student = studentByMatricula.get(digits)
        }
      }

      // Fallback 2: Buscar en perfiles institucionales si no se encontró directo
      if (!student && rawEmail) {
        const { data: profileStudent } = await serviceClient
          .from("students")
          .select("id, matricula, correo, nombres, apellido_paterno")
          .eq("course_id", courseId)
          .ilike("correo", rawEmail)
          .maybeSingle()
        if (profileStudent) student = profileStudent
      }

      if (!student) {
        console.warn(`[SYNC_FORM_RESPONSES] Correo no reconocido en el curso: ${rawEmail}`)
        unmappedResponses.push({ email: rawEmail, timestamp: fr.timestamp })
        continue
      }

      // ── Reconstruir respuestas en formato de la plataforma ──
      const answers: Record<string, any> = {}
      const matchingBuckets: Record<string, Record<number, string>> = {}
      const orderingBuckets: Record<string, Record<number, string>> = {}

      for (const ir of (fr.itemResponses || [])) {
        const formItemIdStr = String(ir.formItemId)
        const mapping = itemMap.get(formItemIdStr)
        if (!mapping) continue
        const q = questionById.get(mapping.question_id)
        if (!q) continue

        let subIdx = mapping.sub_index
        if (subIdx === null || subIdx === undefined) {
          const list = formItemsByQuestion.get(q.id) || []
          const foundIdx = list.findIndex((x) => String(x.form_item_id) === formItemIdStr)
          if (foundIdx !== -1) subIdx = foundIdx
        }

        if (q.q_type === "matching") {
          matchingBuckets[q.id] = matchingBuckets[q.id] || {}
          matchingBuckets[q.id][Number(subIdx || 0)] = ir.answer
        } else if (q.q_type === "ordering") {
          orderingBuckets[q.id] = orderingBuckets[q.id] || {}
          orderingBuckets[q.id][Number(subIdx || 0)] = ir.answer
        } else if (q.q_type === "fill_blank") {
          answers[q.id] = String(ir.answer ?? "")
            .split("\n")
            .map((s: string) => s.trim())
            .filter(Boolean)
        } else {
          answers[q.id] = ir.answer
        }
      }

      // matching: convertir cada respuesta de texto a índice del arreglo "right"
      for (const [qId, bucket] of Object.entries(matchingBuckets)) {
        const q = questionById.get(qId)
        const right: string[] = q?.options?.right || []
        const mapa: Record<number, any> = {}
        for (const [leftIdx, text] of Object.entries(bucket)) {
          const lNum = Number(leftIdx)
          const normText = normalize(text)
          const idx = right.findIndex((r) => normalize(r) === normText || matchesChoice(text, r))
          mapa[lNum] = idx !== -1 ? idx : text
        }
        answers[qId] = mapa
      }

      // ordering: ensamblar arreglo en orden de sub_index
      for (const [qId, bucket] of Object.entries(orderingBuckets)) {
        const maxIdx = Math.max(...Object.keys(bucket).map(Number))
        const arr: string[] = []
        for (let i = 0; i <= maxIdx; i++) arr[i] = bucket[i]
        answers[qId] = arr
      }

      // ── Calificar los reactivos determinísticos ──
      const questionScores: Record<string, number> = {}
      let totalDeterministicScore = 0

      for (const q of questions) {
        const ans = answers[q.id]
        const pts = scoreQuestion(q, ans)
        questionScores[q.id] = pts
        totalDeterministicScore += pts
      }

      totalDeterministicScore = Number(totalDeterministicScore.toFixed(2))

      // ── Determinar estado y retroalimentación ──
      const status = hasOpenQuestions ? "submitted" : "completed"
      const finalScore = hasOpenQuestions ? totalDeterministicScore : totalDeterministicScore
      const feedbackIa = hasOpenQuestions
        ? "Reactivos objetivos calificados automáticamente. Preguntas abiertas pendientes de revisión."
        : "Evaluación calificada automáticamente según la clave oficial de respuestas."

      const metadata = {
        source: "google_forms",
        form_id: exam.google_form_id,
        submitted_at: fr.timestamp || new Date().toISOString(),
        synced_at: new Date().toISOString(),
        question_scores: questionScores,
        total_questions: questions.length,
        auto_graded: !hasOpenQuestions,
      }

      // ── Guardar o actualizar en evaluation_responses ──
      const { data: existing } = await serviceClient
        .from("evaluation_responses")
        .select("id")
        .eq("exam_id", examId)
        .eq("student_id", student.id)
        .maybeSingle()

      if (existing) {
        await serviceClient
          .from("evaluation_responses")
          .update({
            answers,
            status,
            final_score: finalScore,
            score_ia: totalDeterministicScore,
            feedback_ia: feedbackIa,
            submitted_at: fr.timestamp || new Date().toISOString(),
            graded_at: hasOpenQuestions ? null : new Date().toISOString(),
            metadata,
          })
          .eq("id", existing.id)
      } else {
        await serviceClient
          .from("evaluation_responses")
          .insert({
            exam_id: examId,
            student_id: student.id,
            answers,
            status,
            final_score: finalScore,
            score_ia: totalDeterministicScore,
            feedback_ia: feedbackIa,
            submitted_at: fr.timestamp || new Date().toISOString(),
            graded_at: hasOpenQuestions ? null : new Date().toISOString(),
            metadata,
          })
      }

      syncedCount++
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalFormResponses: formResponses.length,
        syncedCount,
        unmappedCount: unmappedResponses.length,
        unmappedResponses,
        message: `Se sincronizaron ${syncedCount} de ${formResponses.length} entregas de Google Forms exitosamente.`,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno en sincronización."
    console.error("[SYNC_FORM_RESPONSES]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})

