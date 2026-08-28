// deno-lint-ignore-file no-import-prefix
/**
 * calibrate-ai-thresholds
 * Tarea 3 de mds/03: recalibra dinámicamente un hiperparámetro del sistema
 * — aquí, "confidence_threshold": el % de calificaciones de IA que se
 * marcan para revisión humana obligatoria antes de publicarse — usando
 * EXCLUSIVAMENTE el resultado empírico de validate-ai-grading (R²/RMSE
 * reales), nunca un valor inventado.
 *
 * Regla de calibración (determinista, documentada aquí — no una "IA" que
 * decide en secreto qué tanto confiar en sí misma):
 *
 *   R² >= 0.85 y RMSE <= 5   -> threshold 0.10 (10% revisión obligatoria)
 *   R² >= 0.70 y RMSE <= 10  -> threshold 0.25
 *   R² >= 0.50               -> threshold 0.50
 *   R² < 0.50 o R² es null   -> threshold 1.00 (revisar TODO — la IA no
 *                                demostró ser confiable con la evidencia
 *                                disponible; null pasa aquí porque
 *                                significa que no hay variación en las
 *                                notas humanas para medir contra algo)
 *
 * Los cortes (0.85/0.70/0.50, RMSE 5/10) son un punto de partida razonable
 * para una escala de 0-100, no una verdad matemática — ajústalos con más
 * historial real si la métrica converge distinto para esta población.
 *
 * Este umbral queda escrito en ai_calibration_state y YA es leído por
 * bulk-evaluate-exams e evaluate-submissions-ia (`confidenceThreshold`,
 * usado con `Math.random() < confidenceThreshold` para decidir muestreo de
 * revisión obligatoria por caso) — este endpoint solo calcula y persiste el
 * umbral, el consumo en ambas funciones ya está conectado.
 *
 * ── Regularización del R² usado para calibrar (mds/03 tarea 4) ────────────
 * `validate-ai-grading` exige un mínimo de 3 observaciones por grupo
 * (MIN_SAMPLES_PER_GROUP) para siquiera incluir un examen/actividad — pero
 * eso protege la inclusión, no la CONFIANZA del R² agregado: con una
 * muestra total apenas por encima del mínimo, un R² alto puede ser una
 * racha de suerte (poco soporte estadístico), no evidencia real de que la
 * IA califica bien. Usar ese R² sin ajustar para fijar un umbral agresivo
 * (10% de revisión) es el equivalente de sobreajustar al ruido de una
 * muestra chica — exactamente lo que pide evitar la tarea 4.
 *
 * Se aplica un shrinkage estilo ridge sobre el propio R² (no hay "pesos" de
 * un modelo que penalizar aquí — el R² observado ES el estadístico a
 * regularizar, análogo a un James-Stein/empirical-Bayes shrinkage hacia un
 * prior conservador de 0, "la IA no explica nada hasta que la evidencia lo
 * demuestre"):
 *
 *   $R^2_{reg} = R^2 \cdot \dfrac{n}{n + \lambda}$
 *
 * con $n$ = sample_size (tamaño total de la muestra de validación) y
 * $\lambda = 10$ la fuerza de regularización (mismo rol que $\lambda$ en
 * ridge/L2: entre más grande, más se encoge la estimación hacia 0). Con
 * $n=3$ (el mínimo posible) el factor es $3/13 \approx 0.23$ — un R² de
 * 0.90 se regulariza a ~0.21, insuficiente para calificar como "alta
 * confianza" y el umbral cae a una categoría más conservadora. Con $n=100$
 * el factor es $100/110 \approx 0.91$ — casi sin penalización, porque a esa
 * escala el R² observado ya es un estimador confiable. $\lambda=10$ se
 * eligió porque iguala el punto de "mitad de penalización" ($n=\lambda$) a
 * un tamaño de muestra donde 10 pares docente-corregidos ya es una base
 * razonable para un curso típico, ni exigente en exceso ni laxo.
 *
 * ── Segmentación por curso (04-RECOMENDACIONES-IA-DOCENTE.md punto 3.2) ──
 * `course_id` opcional, simétrico con validate-ai-grading: sin él, calibra
 * la fila global (course_id IS NULL, todos los cursos agregados — el
 * comportamiento de siempre). Con él, calibra la fila específica de ese
 * curso (si ya tiene su propia validación — si no, no hay nada que
 * calibrar todavía para ese curso, se reporta el error tal cual, sin caer
 * silenciosamente a la global aquí: ESE fallback vive en el lado que LEE el
 * umbral — bulk-evaluate-exams/evaluate-submissions-ia — no aquí).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { calibrateThreshold } from "../_shared/thresholdCalibration.ts"

const DOMAINS = ["exam_grading", "submission_grading"] as const

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { serviceClient } = auth.ctx

  try {
    const { course_id } = await req.json().catch(() => ({ course_id: undefined }))
    const results: Record<string, unknown> = {}

    for (const domain of DOMAINS) {
      let query = serviceClient
        .from("ai_calibration_state")
        .select("id, r2, rmse, sample_size")
        .eq("domain", domain)
        .order("calibrated_at", { ascending: false })
        .limit(1)
      query = course_id ? query.eq("course_id", course_id) : query.is("course_id", null)
      const { data: latest } = await query.maybeSingle()

      if (!latest) {
        results[domain] = { error: `Sin validación previa (${course_id ? `curso ${course_id}` : "global"}) — corre validate-ai-grading primero.` }
        continue
      }

      const { threshold, regla } = calibrateThreshold(latest.r2, latest.rmse ?? 0, latest.sample_size ?? 0)

      const { error } = await serviceClient
        .from("ai_calibration_state")
        .update({ confidence_threshold: threshold, regla_aplicada: regla })
        .eq("id", latest.id)
      if (error) console.error(`[CALIBRATE_AI_THRESHOLDS] update ${domain}:`, error.message)

      results[domain] = { confidence_threshold: threshold, regla_aplicada: regla, based_on: { r2: latest.r2, rmse: latest.rmse, sample_size: latest.sample_size } }
    }

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[CALIBRATE_AI_THRESHOLDS]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
