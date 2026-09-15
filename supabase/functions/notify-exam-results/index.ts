// deno-lint-ignore-file no-import-prefix no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    const { examId, force } = await req.json()
    if (!examId) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'examId'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // exams solo tiene unit_id — el ownership se valida vía course_units → courses
    const { data: exam } = await serviceClient
      .from("exams")
      .select("title, unit_id, results_notified_at, course_units(courses(id))")
      .eq("id", examId)
      .single()
    if (!exam) return new Response(
      JSON.stringify({ success: false, error: "Examen no encontrado." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const course = (exam as any)?.course_units?.courses
    if (!course?.id || !(await verifyCourseOwnership(serviceClient, course.id, userId))) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre este examen." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    if (!force && exam.results_notified_at) {
      return new Response(
        JSON.stringify({
          success: false,
          already_notified: true,
          notified_at: exam.results_notified_at,
          error: `Los resultados de este examen ya fueron notificados el ${exam.results_notified_at}.`,
        }),
        { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const { data: responses } = await serviceClient
      .from("evaluation_responses")
      .select("final_score, feedback_manual, feedback_ia, students(nombres, apellido_paterno, correo, notifications_opt_out)")
      .eq("exam_id", examId)
      .eq("status", "completed")

    if (!responses?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No hay calificaciones publicadas todavía." }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const resultados = responses
      .filter((r: any) => !r.students?.notifications_opt_out)
      .map((r: any) => ({
        email:    r.students?.correo,
        nombre:   r.students?.nombres,
        score:    r.final_score,
        feedback: r.feedback_manual || r.feedback_ia || "",
      }))
      .filter((r: any) => r.email)

    if (!resultados.length) {
      await serviceClient
        .from("exams")
        .update({ results_notified_at: new Date().toISOString() })
        .eq("id", examId)

      return new Response(
        JSON.stringify({ success: true, message: "No hay alumnos para notificar por correo (todos tienen opt-out de notificaciones o no tienen correo)." }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
    const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")
    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurado.")

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25_000)
    let scriptResult: any
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret:  WEBHOOK_SECRET,
          action:  "enviarCorreoResultadosExamen",
          payload: { resultados, examTitle: exam.title },
        }),
        signal: controller.signal,
      })
      const json = await res.json()
      // Router.gs envuelve todo éxito como {success:true, data:<resultado real>}.
      scriptResult = json.success ? (json.data ?? {}) : { success: false, error: json.error }
    } finally {
      clearTimeout(timeout)
    }

    if (!scriptResult.success) throw new Error(scriptResult.error || "Error al enviar correos.")

    await serviceClient
      .from("exams")
      .update({ results_notified_at: new Date().toISOString() })
      .eq("id", examId)

    return new Response(
      JSON.stringify({ success: true, message: scriptResult.message }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout al notificar resultados." : err instanceof Error ? err.message : "Error interno."
    console.error("[NOTIFY_EXAM_RESULTS]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: isTimeout ? 504 : 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
