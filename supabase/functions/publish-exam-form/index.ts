// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * publish-exam-form
 * Genera un Google Form real a partir de un examen ya guardado en `exams` +
 * `questions`, y persiste sus URLs. Se usa cuando el docente elige
 * "Google Forms" como método de aplicación en vez de "Interno".
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    const { examId } = await req.json()
    if (!examId) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'examId'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // exams solo tiene unit_id — el ownership se valida vía course_units → courses
    const { data: exam, error: examErr } = await serviceClient
      .from("exams")
      .select("id, title, unit_id, course_units(title, courses(id, teacher_id, drive_folder_id))")
      .eq("id", examId)
      .single()
    if (examErr || !exam) return new Response(
      JSON.stringify({ success: false, error: "Examen no encontrado." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const course = (exam as any).course_units?.courses
    if (!course?.id || !(await verifyCourseOwnership(serviceClient, course.id, userId))) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre este examen." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const { data: questionsRows, error: qErr } = await serviceClient
      .from("questions")
      .select("id, q_type, content, options, correct_answer, points")
      .eq("exam_id", examId)
      .order("order_index", { ascending: true })
    if (qErr) throw qErr
    if (!questionsRows?.length) return new Response(
      JSON.stringify({ success: false, error: "El examen no tiene reactivos." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // Reconstruir la forma {id, options, answer, left, right, correct} que
    // espera crearFormularioGoogle — misma lógica que usa el editor al cargar
    // un examen. El "id" viaja para poder mapear cada ítem del Form de vuelta
    // a su question_id real (ver itemsMap más abajo).
    const safeParse = (s: string | null) => { try { return JSON.parse(s ?? "null") } catch { return null } }
    const questions = questionsRows.map((q: any) => {
      const t = q.q_type
      if (t === 'matching') {
        return { id: q.id, type: t, content: q.content, points: q.points, left: q.options?.left ?? [], right: q.options?.right ?? [], correct: safeParse(q.correct_answer) ?? [] }
      }
      if (t === 'multi_select') {
        return { id: q.id, type: t, content: q.content, points: q.points, options: q.options ?? [], correct: safeParse(q.correct_answer) ?? [] }
      }
      if (t === 'ordering') {
        return { id: q.id, type: t, content: q.content, points: q.points, options: { items: safeParse(q.correct_answer) ?? q.options?.items ?? [] } }
      }
      return { id: q.id, type: t, content: q.content, points: q.points, options: q.options ?? [], answer: q.correct_answer }
    })

    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
    const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")
    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurado.")

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45_000)
    let scriptResult: any
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: WEBHOOK_SECRET,
          action: "crearFormularioGoogle",
          payload: { title: exam.title, questions, unitName: (exam as any).course_units?.title ?? "", examId },
        }),
        signal: controller.signal,
      })
      const json = await res.json()
      // Router.gs envuelve el éxito como {success:true, data:<resultado real>}.
      scriptResult = json.success ? (json.data ?? {}) : { success: false, error: json.error }
    } finally {
      clearTimeout(timeout)
    }

    if (!scriptResult.success) throw new Error(scriptResult.error || "Error al generar el formulario.")

    await serviceClient
      .from("exams")
      .update({
        deployment_method:   "google_forms",
        google_form_id:       scriptResult.formId,
        google_form_url:      scriptResult.publishedUrl,
        google_form_edit_url: scriptResult.editUrl,
      })
      .eq("id", examId)

    // Reemplazar el mapeo anterior (si esto es una regeneración, el Form
    // viejo ya quedó huérfano — solo el más reciente recibe sincronización).
    await serviceClient.from("exam_form_items").delete().eq("exam_id", examId)
    const itemsMap = Array.isArray(scriptResult.itemsMap) ? scriptResult.itemsMap : []
    if (itemsMap.length > 0) {
      await serviceClient.from("exam_form_items").insert(
        itemsMap.map((it: any) => ({
          exam_id: examId,
          question_id: it.questionId,
          form_item_id: it.formItemId,
          sub_index: it.subIndex ?? null,
        }))
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        publishedUrl: scriptResult.publishedUrl,
        editUrl: scriptResult.editUrl,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout al generar el formulario." : err instanceof Error ? err.message : "Error interno."
    console.error("[PUBLISH_EXAM_FORM]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: isTimeout ? 504 : 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
