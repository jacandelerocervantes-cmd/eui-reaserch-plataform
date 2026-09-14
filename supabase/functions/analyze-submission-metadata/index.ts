// deno-lint-ignore-file no-import-prefix
/**
 * analyze-submission-metadata
 * Extractor de metadata de PROCESO de una entrega (submissions) — no de
 * contenido para calificar (eso lo hace evaluate-submissions-ia). Mismo
 * espíritu human-in-the-loop que analyze-capture: la IA clasifica, nunca
 * decide una nota ni bloquea nada. Escribe en submissions.metadata (jsonb,
 * ya existe en el esquema pendiente — 005_fix_submissions_ai_columns.sql)
 * bajo la clave `ai_analysis`, marcada explícitamente como derivada de IA,
 * informativa — ningún otro endpoint la trata como ground truth.
 *
 * Origen: qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md, punto 2.1.
 *
 * También registra la revisión actual en submission_revisions (histórico
 * real de versiones — requiere 009_submission_revisions.sql), insumo de
 * compute-activity-work-patterns (agregado de grupo) y de la señal Kalman
 * "esfuerzo" de compute-student-risk-signals.
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
    const { submission_id } = await req.json()
    if (!submission_id) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'submission_id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const { data: submission } = await serviceClient
      .from("submissions")
      .select("id, assignment_id, file_path, version_number, submitted_at, assignments(course_id, soft_deadline, hard_deadline)")
      .eq("id", submission_id)
      .single()

    if (!submission) return new Response(
      JSON.stringify({ success: false, error: "Entrega no encontrada." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const assignmentInfo = submission.assignments as unknown as { course_id: string; soft_deadline: string; hard_deadline: string | null } | null
    if (!assignmentInfo) return new Response(
      JSON.stringify({ success: false, error: "Actividad asociada no encontrada." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const owns = await verifyCourseOwnership(serviceClient, assignmentInfo.course_id, userId)
    if (!owns) return new Response(
      JSON.stringify({ success: false, error: "No tienes permiso sobre esta entrega." }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── Métrica determinista: cercanía al deadline (sin LLM) ────────────────
    let horasAntesDelLimite: number | null = null
    if (submission.submitted_at) {
      const limite = assignmentInfo.hard_deadline ?? assignmentInfo.soft_deadline
      if (limite) horasAntesDelLimite = Math.round(((new Date(limite).getTime() - new Date(submission.submitted_at).getTime()) / 3_600_000) * 10) / 10
    }

    // ── Registrar la revisión en el histórico (best-effort, no bloquea) ─────
    await serviceClient.from("submission_revisions").insert({
      submission_id: submission.id,
      version_number: submission.version_number ?? 1,
      content_url: submission.file_path,
    }).then(({ error }) => {
      // Conflicto esperado si ya se registró esta versión antes (UNIQUE
      // submission_id+version_number) — no es un error real, se ignora.
      if (error && error.code !== "23505") console.error("[ANALYZE_SUBMISSION_METADATA] insert revision:", error.message)
    })

    // ── Clasificación de tipo de contenido vía Gemini (no decide nada,
    //    solo etiqueta) — solo si hay archivo que analizar. ─────────────────
    let tipoContenido: string | null = null
    if (submission.file_path) {
      const { data: fileData } = await serviceClient.storage.from("archivos_docentes").download(submission.file_path)
      if (fileData) {
        const arrayBuffer = await fileData.arrayBuffer()
        const base64File = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        const aiRes = await fetchGeminiWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
            contents: [{ parts: [
              { text: "Clasifica el tipo de contenido dominante de este archivo de entrega académica. Responde SOLO con una palabra de esta lista: codigo, ensayo, reporte_datos, presentacion, mixto, otro. JSON puro: {\"tipo\":\"...\"}" },
              { inline_data: { mime_type: "application/pdf", data: base64File } },
            ] }],
            generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
          },
          controller.signal,
        )
        if (aiRes.ok) {
          const aiJson = await aiRes.json()
          const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
          if (content) {
            // Guardrail de salida (docs/04_Multi_Agente_MCP.md §3): igual que
            // el resto de las ~27 funciones que llaman a Gemini, aunque aquí
            // la salida esperada sea una sola palabra de una lista cerrada —
            // una fuga del prompt de sistema o contenido bloqueado en el JSON
            // crudo de Gemini no debe llegar a persistirse.
            const guard = await guardOutputOrBlock(content, {
              serviceClient, teacherId: userId, toolName: "analyze_submission_metadata", cors,
              errorBody: { success: false, error: "El análisis no pudo completarse por una regla de seguridad interna." },
            })
            if (guard.blocked) return guard.response
            try { tipoContenido = (JSON.parse(content) as { tipo?: string }).tipo ?? null } catch { /* respuesta no parseable: se deja null, no se rompe el flujo */ }
          }
        }
      }
    }

    // ── Persistir bajo metadata.ai_analysis — nunca sobreescribe el resto
    //    de metadata que otros procesos puedan haber escrito. ───────────────
    const { data: current } = await serviceClient.from("submissions").select("metadata").eq("id", submission_id).single()
    const existingMetadata = (current?.metadata as Record<string, unknown> | null) ?? {}
    const { error: updateErr } = await serviceClient.from("submissions").update({
      metadata: {
        ...existingMetadata,
        ai_analysis: {
          tipo_contenido: tipoContenido, // sugerencia de IA, informativa — no bloquea calificación
          horas_antes_del_limite: horasAntesDelLimite, // determinista, sin IA
          version_analizada: submission.version_number ?? 1,
          analizado_at: new Date().toISOString(),
        },
      },
    }).eq("id", submission_id)
    if (updateErr) throw updateErr

    return new Response(
      JSON.stringify({ success: true, data: { tipo_contenido: tipoContenido, horas_antes_del_limite: horasAntesDelLimite } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (28s) analizando metadata de la entrega." : err instanceof Error ? err.message : "Error interno."
    console.error("[ANALYZE_SUBMISSION_METADATA]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
