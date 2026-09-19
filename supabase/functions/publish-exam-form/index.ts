// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * publish-exam-form
 * Genera un Google Form real a partir de un examen ya guardado en `exams` +
 * `questions`, y persiste sus URLs. Se usa cuando el docente elige
 * "Google Forms" como método de aplicación en vez de "Interno".
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim()

  let isServiceRole = Boolean(serviceRoleKey && token === serviceRoleKey)
  if (!isServiceRole && token.includes(".")) {
    try {
      const parts = token.split(".")
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        if (payload.role === "service_role") {
          isServiceRole = true
        }
      }
    } catch {}
  }

  let serviceClient: any
  let userId: string | null = null

  if (isServiceRole) {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
    serviceClient = createClient(SUPABASE_URL, serviceRoleKey)
  } else {
    const auth = await verifyDocente(req)
    if (!auth.ok) return errorResponse(auth.err, cors)
    userId = auth.ctx.userId
    serviceClient = auth.ctx.serviceClient
  }

  try {
    const { examId, force } = await req.json()
    if (!examId) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'examId'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // exams solo tiene unit_id — el ownership se valida vía course_units → courses
    const { data: exam, error: examErr } = await serviceClient
      .from("exams")
      .select("id, title, start_at, unit_id, deployment_method, google_form_id, google_form_url, course_units(title, courses(id, teacher_id, drive_folder_id))")
      .eq("id", examId)
      .single()
    if (examErr || !exam) return new Response(
      JSON.stringify({ success: false, error: "Examen no encontrado." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const course = (exam as any).course_units?.courses
    if (userId && (!course?.id || !(await verifyCourseOwnership(serviceClient, course.id, userId)))) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre este examen." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    if (!force && exam.google_form_id) {
      return new Response(
        JSON.stringify({
          success: false,
          already_published: true,
          google_form_url: exam.google_form_url,
          error: "Este examen ya tiene un Google Form vinculado.",
        }),
        { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    if (exam.google_form_id) {
      console.warn(`[PUBLISH_EXAM_FORM] Reemplazando Google Form existente para examId=${examId}. Form ID anterior: ${exam.google_form_id}, URL anterior: ${exam.google_form_url}`)
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
    // Reconstruir la forma {id, options, answer, left, right, correct} que
    // espera crearFormularioGoogle con tipos compatibles con la API de Google Forms (Quiz).
    const safeParse = (s: string | null) => { try { return JSON.parse(s ?? "null") } catch { return null } }
    const questions: any[] = []

    for (const q of questionsRows) {
      const t = q.q_type
      const points = Math.max(1, Math.round(Number(q.points) || 1))

      if (t === 'true_false') {
        const ans = String(q.correct_answer).trim().toLowerCase() === 'falso' ? 'Falso' : 'Verdadero'
        questions.push({
          id: q.id,
          type: 'multiple_choice',
          content: q.content,
          points,
          options: ['Verdadero', 'Falso'],
          answer: ans,
        })
        continue
      }

      if (t === 'matching') {
        const left: string[] = q.options?.left ?? []
        const right: string[] = q.options?.right ?? []
        const correctArr: number[] = safeParse(q.correct_answer) ?? []
        const cleanRight = [...new Set(right.map((r: any) => String(r).trim()).filter(Boolean))]

        left.forEach((concepto, idx) => {
          if (!concepto || !String(concepto).trim()) return
          const correctIdx = correctArr[idx]
          const correcta = right[correctIdx] || cleanRight[0]
          questions.push({
            id: q.id,
            type: 'multiple_choice',
            content: `${q.content} — Concepto: "${String(concepto).trim()}"`,
            points: 1,
            options: cleanRight,
            answer: String(correcta).trim(),
          })
        })
        continue
      }

      // multiple_choice y cualquier otro tipo:
      let rawOptions = Array.isArray(q.options) ? q.options : []
      let cleanOptions = [...new Set(rawOptions.map((o: any) => String(o).trim()).filter(Boolean))]
      let answer = String(q.correct_answer || '').trim()

      if (answer && !cleanOptions.includes(answer)) {
        cleanOptions.push(answer)
      }
      if (cleanOptions.length < 2) {
        cleanOptions.push('Ninguna de las anteriores')
      }

      questions.push({
        id: q.id,
        type: 'multiple_choice',
        content: q.content,
        points,
        options: cleanOptions,
        answer: answer || cleanOptions[0],
      })
    }

    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
    const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")
    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurado.")

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90_000)
    let scriptResult: any
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: WEBHOOK_SECRET,
          action: "crearFormularioGoogle",
          payload: {
            title: exam.title,
            questions,
            unitName: (exam as any).course_units?.title ?? "",
            examId,
            isFuture: false,
            startTimeStr: exam.start_at ? new Date(exam.start_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "",
          },
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
