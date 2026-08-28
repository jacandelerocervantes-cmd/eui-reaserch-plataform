// deno-lint-ignore-file no-import-prefix
/**
 * validate-ai-grading
 * Tarea 2 de mds/03: validación empírica con datos reales (R², RMSE), sin
 * datos sintéticos. El "ground truth" es evaluation_responses.final_score /
 * evaluations.final_score — la corrección humana que el docente YA hace
 * hoy cuando revisa una calificación de IA (score_ia / suggested_score).
 * No hay ingesta nueva que construir: el dato de validación se genera solo
 * cada vez que alguien corrige/confirma una nota.
 *
 * Filtro "≥3 observaciones por ensayo" (mds/03, adaptado): solo se incluyen
 * pares de un examen/actividad si ese examen/actividad tiene AL MENOS 3
 * calificaciones ya revisadas por un humano — con menos de eso, R²/RMSE por
 * grupo no es estadísticamente significativo y solo metería ruido.
 *
 * R² = 1 - SS_res/SS_tot,  SS_res = Σ(y_i - ŷ_i)²,  SS_tot = Σ(y_i - ȳ)²
 * RMSE = sqrt( (1/n) Σ(y_i - ŷ_i)² )
 * donde y_i = final_score (verdad humana), ŷ_i = score_ia/suggested_score (predicción IA).
 *
 * ── Segmentación por curso (qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md,
 * punto 3.2) ────────────────────────────────────────────────────────────
 * `course_id` es un parámetro OPCIONAL. Sin él, se calibra igual que antes:
 * un R²/RMSE agregado por dominio, mezclando todos los cursos de la
 * plataforma (fila con course_id=NULL en ai_calibration_state — requiere
 * supabase/pendiente/010_ai_calibration_course_segment.sql). Con él, se
 * calibra SOLO con el historial de ESE curso — más preciso cuando ya
 * acumuló suficientes observaciones propias, porque la confiabilidad real
 * de la IA calificando puede variar bastante entre un curso con exámenes de
 * opción múltiple y uno con ensayos largos, y promediarlos en un solo
 * número diluye la señal. calibrate-ai-thresholds decide cuál usar (ver ese
 * archivo).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { computeR2AndRmse, filterByMinGroupSize, MIN_SAMPLES_PER_GROUP, type Pair } from "../_shared/aiGradingMetrics.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { serviceClient } = auth.ctx

  try {
    const { domain, course_id } = await req.json().catch(() => ({ domain: undefined, course_id: undefined }))
    const domains = domain ? [domain] : ["exam_grading", "submission_grading"]
    const results: Record<string, unknown> = {}
    const scopeLabel = course_id ? `curso ${course_id}` : "global (todos los cursos)"

    if (domains.includes("exam_grading")) {
      // Con course_id: acota a los exámenes de ESE curso antes de traer respuestas.
      let examIdsForCourse: string[] | null = null
      if (course_id) {
        const { data: examsInCourse } = await serviceClient.from("exams").select("id").eq("course_id", course_id)
        examIdsForCourse = (examsInCourse ?? []).map((e) => e.id)
      }

      let query = serviceClient
        .from("evaluation_responses")
        .select("exam_id, score_ia, final_score")
        .not("score_ia", "is", null)
        .not("final_score", "is", null)
      if (examIdsForCourse) query = query.in("exam_id", examIdsForCourse.length ? examIdsForCourse : ["00000000-0000-0000-0000-000000000000"])
      const { data: rows } = await query

      const pairs = filterByMinGroupSize(
        (rows ?? []).map((r) => ({ group_id: r.exam_id, y: r.final_score, yhat: r.score_ia })),
        MIN_SAMPLES_PER_GROUP,
      )

      if (pairs.length >= MIN_SAMPLES_PER_GROUP) {
        const { r2, rmse } = computeR2AndRmse(pairs)
        const { error } = await serviceClient.from("ai_calibration_state").insert({
          domain: "exam_grading", course_id: course_id ?? null, r2, rmse, sample_size: pairs.length,
          regla_aplicada: `pendiente de calibrate-ai-thresholds (${scopeLabel})`, confidence_threshold: 0.3,
        })
        if (error) console.error("[VALIDATE_AI_GRADING] insert exam_grading:", error.message)
        results.exam_grading = { r2, rmse, sample_size: pairs.length, scope: scopeLabel }
      } else {
        results.exam_grading = { error: `Insuficientes calificaciones revisadas por humano (${pairs.length}) para validar (${scopeLabel}). Se requieren exámenes con ≥${MIN_SAMPLES_PER_GROUP} calificaciones corregidas cada uno.` }
      }
    }

    if (domains.includes("submission_grading")) {
      // "evaluations" (suggested_score/final_score) es una tabla huérfana —
      // nada en el repo escribe ahí. El par predicción/verdad real vive en
      // submissions.ai_score (predicción de evaluate-submissions-ia, tras
      // 005_fix_submissions_ai_columns.sql) vs. grades.score (la nota final
      // que el docente publica en el gradebook para esa actividad). El
      // puente es assignments.criteria_id -> activities.id: cada submission
      // pertenece a un assignment, y ese assignment está vinculado a la fila
      // de "activities" donde vive la nota final del alumno.
      let assignmentIdsForCourse: string[] | null = null
      if (course_id) {
        const { data: assignmentsInCourse } = await serviceClient.from("assignments").select("id").eq("course_id", course_id)
        assignmentIdsForCourse = (assignmentsInCourse ?? []).map((a) => a.id)
      }

      let subQuery = serviceClient
        .from("submissions")
        .select("id, student_id, assignment_id, ai_score")
        .not("ai_score", "is", null)
      if (assignmentIdsForCourse) subQuery = subQuery.in("assignment_id", assignmentIdsForCourse.length ? assignmentIdsForCourse : ["00000000-0000-0000-0000-000000000000"])
      const { data: submissionRows } = await subQuery

      const assignmentIds = [...new Set((submissionRows ?? []).map((s) => s.assignment_id))]
      const { data: assignmentRows } = assignmentIds.length
        ? await serviceClient.from("assignments").select("id, criteria_id").in("id", assignmentIds)
        : { data: [] as { id: string; criteria_id: string | null }[] }
      const assignmentToActivity = new Map((assignmentRows ?? []).map((a) => [a.id, a.criteria_id]))

      const activityIds = [...new Set([...assignmentToActivity.values()].filter((v): v is string => !!v))]
      const { data: gradeRows } = activityIds.length
        ? await serviceClient.from("grades").select("student_id, activity_id, score").in("activity_id", activityIds)
        : { data: [] as { student_id: string; activity_id: string; score: number | null }[] }
      const gradeByStudentActivity = new Map((gradeRows ?? []).map((g) => [`${g.student_id}:${g.activity_id}`, g.score]))

      const pairs: Pair[] = []
      for (const s of submissionRows ?? []) {
        const activityId = assignmentToActivity.get(s.assignment_id)
        if (!activityId || !s.student_id) continue
        const finalScore = gradeByStudentActivity.get(`${s.student_id}:${activityId}`)
        if (finalScore === undefined || finalScore === null) continue // sin nota final publicada aún: no hay verdad humana con qué comparar
        pairs.push({ group_id: s.assignment_id, y: finalScore, yhat: s.ai_score! })
      }
      const filteredPairs = filterByMinGroupSize(pairs, MIN_SAMPLES_PER_GROUP)

      if (filteredPairs.length >= MIN_SAMPLES_PER_GROUP) {
        const { r2, rmse } = computeR2AndRmse(filteredPairs)
        const { error } = await serviceClient.from("ai_calibration_state").insert({
          domain: "submission_grading", course_id: course_id ?? null, r2, rmse, sample_size: filteredPairs.length,
          regla_aplicada: `pendiente de calibrate-ai-thresholds (${scopeLabel})`, confidence_threshold: 0.3,
        })
        if (error) console.error("[VALIDATE_AI_GRADING] insert submission_grading:", error.message)
        results.submission_grading = { r2, rmse, sample_size: filteredPairs.length, scope: scopeLabel }
      } else {
        results.submission_grading = { error: `Insuficientes entregas revisadas por humano (${filteredPairs.length}) para validar (${scopeLabel}). Se requieren actividades con ≥${MIN_SAMPLES_PER_GROUP} calificaciones corregidas cada una.` }
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[VALIDATE_AI_GRADING]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
