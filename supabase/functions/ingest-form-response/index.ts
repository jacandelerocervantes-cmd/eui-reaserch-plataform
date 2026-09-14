// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * ingest-form-response
 * Webhook llamado por Apps Script (onExamFormSubmit, en servicio_evaluaciones.gs)
 * cada vez que un alumno entrega un Google Form generado por la plataforma.
 * Traduce las respuestas del Form (varios ítems pueden pertenecer a un solo
 * reactivo interno — matching y ordering se descomponen) de vuelta al mismo
 * formato que usa el examen interno, y las guarda en `evaluation_responses`
 * para que el resto del flujo (bulk-evaluate-exams, revisión, resultados)
 * las trate exactamente igual que una entrega hecha dentro de la plataforma.
 *
 * No usa verifyDocente — quien llama es Apps Script, no un docente con
 * sesión. Se autentica con el mismo secreto compartido que Router.gs valida
 * en la dirección contraria (APPS_SCRIPT_SECRET).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildCorsHeaders } from "../_shared/auth.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { secret, examId, respondentEmail, itemResponses } = await req.json()

    const WEBHOOK_SECRET = Deno.env.get("APPS_SCRIPT_SECRET")
    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ success: false, error: "No autorizado." }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    if (!examId || !respondentEmail || !Array.isArray(itemResponses)) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan examId, respondentEmail o itemResponses." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    // ── 1. Examen → curso, para poder ubicar al alumno por correo ──────────
    const { data: exam } = await serviceClient
      .from("exams")
      .select("id, unit_id, course_units(course_id)")
      .eq("id", examId)
      .single()
    if (!exam) throw new Error("Examen no encontrado.")
    const courseId = (exam as any).course_units?.course_id
    if (!courseId) throw new Error("El examen no tiene curso asociado.")

    const { data: student } = await serviceClient
      .from("students")
      .select("id")
      .eq("course_id", courseId)
      .ilike("correo", respondentEmail)
      .maybeSingle()
    if (!student) {
      console.error("[INGEST_FORM_RESPONSE] Sin alumno con correo", respondentEmail, "en curso", courseId)
      return new Response(
        JSON.stringify({ success: false, error: "No se encontró un alumno con ese correo en el curso." }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 2. Mapeo ítem-de-Form → reactivo real ───────────────────────────────
    const { data: formItems } = await serviceClient
      .from("exam_form_items")
      .select("question_id, form_item_id, sub_index")
      .eq("exam_id", examId)
    const itemMap = new Map((formItems ?? []).map((fi: any) => [fi.form_item_id, fi]))

    const { data: questions } = await serviceClient
      .from("questions")
      .select("id, q_type, options")
      .eq("exam_id", examId)
    const questionById = new Map((questions ?? []).map((q: any) => [q.id, q]))

    // ── 3. Reconstruir la respuesta de cada reactivo en el formato interno ──
    const answers: Record<string, any> = {}
    const matchingBuckets: Record<string, Record<number, string>> = {}
    const orderingBuckets: Record<string, Record<number, string>> = {}

    for (const ir of itemResponses) {
      const mapping = itemMap.get(String(ir.formItemId))
      if (!mapping) continue
      const q = questionById.get(mapping.question_id)
      if (!q) continue

      if (q.q_type === 'matching') {
        matchingBuckets[q.id] = matchingBuckets[q.id] ?? {}
        matchingBuckets[q.id][mapping.sub_index ?? 0] = ir.answer
      } else if (q.q_type === 'ordering') {
        orderingBuckets[q.id] = orderingBuckets[q.id] ?? {}
        orderingBuckets[q.id][mapping.sub_index ?? 0] = ir.answer
      } else if (q.q_type === 'fill_blank') {
        // ParagraphTextItem entrega un solo string — se aproxima dividiendo
        // por línea. Menos confiable que el examen interno; por diseño este
        // tipo ya requiere revisión manual también dentro de Forms.
        answers[q.id] = String(ir.answer ?? "").split("\n").map((s: string) => s.trim()).filter(Boolean)
      } else {
        // multiple_choice, true_false, short_answer, open: string directo.
        // multi_select (CheckboxItem): Apps Script ya entrega un array.
        answers[q.id] = ir.answer
      }
    }

    // matching: convertir el texto elegido (label de "right") a su índice,
    // que es el formato que espera el calificador determinístico.
    for (const [questionId, bucket] of Object.entries(matchingBuckets)) {
      const q = questionById.get(questionId)
      const right: string[] = q?.options?.right ?? []
      const mapa: Record<number, number> = {}
      Object.entries(bucket).forEach(([leftIdx, text]) => {
        const idx = right.indexOf(text)
        if (idx !== -1) mapa[Number(leftIdx)] = idx
      })
      answers[questionId] = mapa
    }

    // ordering: ensamblar el array en el orden de sub_index.
    for (const [questionId, bucket] of Object.entries(orderingBuckets)) {
      const maxIdx = Math.max(...Object.keys(bucket).map(Number))
      const arr: string[] = []
      for (let i = 0; i <= maxIdx; i++) arr[i] = bucket[i]
      answers[questionId] = arr
    }

    // ── 4. Guardar como entrega — mismo flujo que el examen interno ────────
    const { data: existing } = await serviceClient
      .from("evaluation_responses")
      .select("id")
      .eq("exam_id", examId)
      .eq("student_id", student.id)
      .maybeSingle()

    const metadata = { source: "google_forms", submitted_at: new Date().toISOString() }

    if (existing) {
      await serviceClient.from("evaluation_responses")
        .update({ answers, status: "submitted", metadata })
        .eq("id", existing.id)
    } else {
      await serviceClient.from("evaluation_responses")
        .insert({ exam_id: examId, student_id: student.id, answers, status: "submitted", metadata })
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[INGEST_FORM_RESPONSE]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
