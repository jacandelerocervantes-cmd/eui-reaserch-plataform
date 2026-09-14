// deno-lint-ignore-file no-import-prefix
/**
 * compute-activity-work-patterns
 * Agregado de GRUPO (nunca por-alumno) sobre patrones de trabajo de una
 * actividad — para que el docente entienda cómo trabajó el curso en
 * conjunto, no para vigilar a un alumno individual. Reutiliza el mismo
 * umbral de anonimato k>=5 que `get_group_aggregate` de mcp-server
 * (ANONYMITY_THRESHOLD, mismo criterio, no uno nuevo inventado): si la
 * actividad tiene menos de 5 entregas, no se emite ningún agregado.
 *
 * Fuentes: submissions.metadata.ai_analysis (analyze-submission-metadata) +
 * submission_revisions (histórico de versiones, 009_submission_revisions.sql).
 *
 * Origen: qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md, punto 2.3.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"

const ANONYMITY_THRESHOLD = 5 // mismo criterio que mcp-server/index.ts (agregado@1.0)

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    const { assignment_id } = await req.json()
    if (!assignment_id) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'assignment_id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const { data: assignment } = await serviceClient
      .from("assignments")
      .select("id, course_id, title, soft_deadline, hard_deadline")
      .eq("id", assignment_id)
      .single()
    if (!assignment) return new Response(
      JSON.stringify({ success: false, error: "Actividad no encontrada." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const owns = await verifyCourseOwnership(serviceClient, assignment.course_id, userId)
    if (!owns) return new Response(
      JSON.stringify({ success: false, error: "No tienes permiso sobre esta actividad." }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const { data: submissions } = await serviceClient
      .from("submissions")
      .select("id, version_number, submitted_at, metadata")
      .eq("assignment_id", assignment_id)
      .not("submitted_at", "is", null)

    const n = submissions?.length ?? 0
    if (n < ANONYMITY_THRESHOLD) {
      return new Response(
        JSON.stringify({
          success: true,
          data: { n_entregas: n, agregado: null, motivo: `Menos de ${ANONYMITY_THRESHOLD} entregas — por debajo del umbral de anonimato, no se emite agregado.` },
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── % de entregas hechas en las últimas 2 horas antes del deadline ──────
    const limite = assignment.hard_deadline ?? assignment.soft_deadline
    let ultimaHoraCount = 0
    let horasAntesSum = 0
    let horasAntesN = 0
    for (const s of submissions!) {
      if (!s.submitted_at || !limite) continue
      const horas = (new Date(limite).getTime() - new Date(s.submitted_at).getTime()) / 3_600_000
      horasAntesSum += horas
      horasAntesN++
      if (horas <= 2) ultimaHoraCount++
    }
    const pctUltimasHoras = horasAntesN > 0 ? Math.round((ultimaHoraCount / horasAntesN) * 100) : null
    const promedioHorasAntes = horasAntesN > 0 ? Math.round((horasAntesSum / horasAntesN) * 10) / 10 : null

    // ── Promedio de revisiones por entrega ───────────────────────────────
    const versionCounts = submissions!.map((s) => s.version_number ?? 1)
    const promedioRevisiones = Math.round((versionCounts.reduce((a, b) => a + b, 0) / versionCounts.length) * 10) / 10

    // ── Distribución de tipo de contenido (si analyze-submission-metadata
    //    ya corrió sobre esas entregas) ───────────────────────────────────
    const tipoContenidoCounts: Record<string, number> = {}
    let tipoContenidoN = 0
    for (const s of submissions!) {
      const meta = s.metadata as { ai_analysis?: { tipo_contenido?: string | null } } | null
      const tipo = meta?.ai_analysis?.tipo_contenido
      if (tipo) {
        tipoContenidoCounts[tipo] = (tipoContenidoCounts[tipo] ?? 0) + 1
        tipoContenidoN++
      }
    }
    const distribucionTipoContenido = tipoContenidoN >= ANONYMITY_THRESHOLD
      ? Object.fromEntries(Object.entries(tipoContenidoCounts).map(([k, v]) => [k, Math.round((v / tipoContenidoN) * 100)]))
      : null // si menos de 5 entregas tienen metadata de tipo, tampoco se desglosa (mismo umbral)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          actividad: assignment.title,
          n_entregas: n,
          pct_entregas_ultimas_2_horas: pctUltimasHoras,
          promedio_horas_antes_del_limite: promedioHorasAntes,
          promedio_revisiones_por_entrega: promedioRevisiones,
          distribucion_tipo_contenido: distribucionTipoContenido,
        },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[COMPUTE_ACTIVITY_WORK_PATTERNS]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
