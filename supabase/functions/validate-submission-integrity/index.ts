// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * validate-submission-integrity
 *
 * El "Validador" independiente que docs/04_Multi_Agente_MCP.md (§2.3) pedía
 * y no existía: NO llama a Gemini, NO es el mismo modelo que generó/calificó
 * la entrega. Corre una Regresión Logística (_shared/logisticValidator.ts,
 * pesos fijados a mano) sobre señales que YA calculó
 * analyze-submission-integrity (contribution_percent, integrity_flags) —
 * pura aritmética, cero costo adicional de IA.
 *
 * Requiere que analyze-submission-integrity ya haya corrido sobre esta
 * entrega (si no, contribution_percent/integrity_flags están vacíos y el
 * score sale bajo por falta de señal, no por error).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
import { FEW_REVISIONS_THRESHOLD, scoreSubmission, type SubmissionFeatures } from "../_shared/logisticValidator.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  let body: { submission_id?: string; total_revisions?: number }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ success: false, error: "JSON inválido." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
  const { submission_id, total_revisions } = body
  if (!submission_id) {
    return new Response(JSON.stringify({ success: false, error: "Se requiere 'submission_id'." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  try {
    const { data: sub, error: subErr } = await serviceClient
      .from("submissions")
      .select("id, team_id, contribution_percent, integrity_flags, assignment_id, assignments(course_id)")
      .eq("id", submission_id)
      .single()
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

    const integrityFlags = Array.isArray((sub as any).integrity_flags) ? (sub as any).integrity_flags : []

    // totalRevisions no se persiste en `submissions` (analyze-submission-integrity
    // lo devuelve en su Response pero no lo guarda) — el frontend, que ya llamó
    // esa función momentos antes, lo reenvía aquí en `total_revisions`. Sin él
    // (ej. si se llama a este validador sin haber corrido antes el análisis),
    // se usa el umbral mismo como valor NEUTRAL (ni suma ni resta a la señal),
    // en vez de fabricar un número que sí la mueva.
    const features: SubmissionFeatures = {
      suspiciousPasteCount: integrityFlags.length,
      contributionPercent: (sub as any).team_id ? (sub as any).contribution_percent : null,
      totalRevisions: total_revisions ?? FEW_REVISIONS_THRESHOLD,
    }

    const result = scoreSubmission(features)

    return new Response(
      JSON.stringify({ success: true, data: { ...result, features } }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[VALIDATE_SUBMISSION_INTEGRITY]", msg)
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
