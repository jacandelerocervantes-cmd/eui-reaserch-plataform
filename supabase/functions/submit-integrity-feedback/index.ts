// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * submit-integrity-feedback
 *
 * El docente confirma o descarta una alerta del Validador independiente
 * (validate-submission-integrity). Cada veredicto queda registrado en
 * `integrity_flag_feedback` con un snapshot de las features que produjeron
 * ese score — es el dataset etiquetado que, cuando haya suficientes casos,
 * permite reemplazar DEFAULT_WEIGHTS (fijados a mano) por pesos ajustados a
 * datos reales (ver fitWeights en _shared/logisticValidator.ts).
 *
 * Esto NO cambia ninguna calificación ni bloquea nada — es solo el registro
 * del juicio del docente para mejorar el clasificador a futuro.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
import type { SubmissionFeatures } from "../_shared/logisticValidator.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  let body: {
    submission_id?: string
    predicted_probability?: number
    features?: SubmissionFeatures
    verdict?: "confirmed_cheating" | "false_positive"
    docente_notes?: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ success: false, error: "JSON inválido." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const { submission_id, predicted_probability, features, verdict, docente_notes } = body
  if (!submission_id || predicted_probability === undefined || !features || !verdict) {
    return new Response(
      JSON.stringify({ success: false, error: "Se requieren submission_id, predicted_probability, features y verdict." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    )
  }
  if (!["confirmed_cheating", "false_positive"].includes(verdict)) {
    return new Response(JSON.stringify({ success: false, error: "verdict inválido." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  try {
    const { data: sub, error: subErr } = await serviceClient
      .from("submissions").select("id, assignment_id, assignments(course_id)").eq("id", submission_id).single()
    if (subErr || !sub) {
      return new Response(JSON.stringify({ success: false, error: "Entrega no encontrada." }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      })
    }
    const courseId = (sub as any).assignments?.course_id
    if (!courseId || !(await verifyCourseOwnership(serviceClient, courseId, userId))) {
      return new Response(JSON.stringify({ success: false, error: "No tienes permiso sobre esta entrega." }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const { error: insertErr } = await serviceClient.from("integrity_flag_feedback").insert({
      submission_id, predicted_probability, features, verdict,
      docente_notes: docente_notes ?? null, created_by: userId,
    })
    if (insertErr) throw insertErr

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[SUBMIT_INTEGRITY_FEEDBACK]", msg)
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
