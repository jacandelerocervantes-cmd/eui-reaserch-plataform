/**
 * Matemática pura de calibrate-ai-thresholds (mds/03 tareas 3 y 4), separada
 * del glue de Deno (`serve`, Supabase client) para poder testearla con
 * vitest/node — este archivo no importa nada de Deno.
 *
 * Regla de calibración (determinista):
 *   R² >= 0.85 y RMSE <= 5   -> threshold 0.10 (10% revisión obligatoria)
 *   R² >= 0.70 y RMSE <= 10  -> threshold 0.25
 *   R² >= 0.50               -> threshold 0.50
 *   R² < 0.50 o R² es null   -> threshold 1.00
 *
 * Shrinkage estilo James-Stein/empirical-Bayes sobre el R² observado, antes
 * de aplicar la regla anterior (mds/03 tarea 4 — Dilema Sesgo-Varianza):
 *
 *   $R^2_{reg} = R^2 \cdot \dfrac{n}{n + \lambda}$
 *
 * con $n$ = sample_size y $\lambda=10$. Ver docstring completo (justificación
 * de los cortes y de λ) en `supabase/functions/calibrate-ai-thresholds/index.ts`.
 */

export const SHRINKAGE_LAMBDA = 10

export function shrinkR2(r2: number, sampleSize: number): number {
  return r2 * (sampleSize / (sampleSize + SHRINKAGE_LAMBDA))
}

export function calibrateThreshold(
  r2Raw: number | null,
  rmse: number,
  sampleSize: number,
): { threshold: number; regla: string } {
  if (r2Raw === null) return { threshold: 1.0, regla: "R² indefinido (sin varianza en notas humanas) → revisión 100% por precaución." }
  const r2 = shrinkR2(r2Raw, sampleSize)
  const nota = `R²_bruto=${r2Raw.toFixed(3)} regularizado a R²=${r2.toFixed(3)} (n=${sampleSize}, λ=${SHRINKAGE_LAMBDA})`
  if (r2 >= 0.85 && rmse <= 5) return { threshold: 0.10, regla: `${nota} >= 0.85 y RMSE=${rmse.toFixed(2)} <= 5 → alta confianza, 10% revisión obligatoria.` }
  if (r2 >= 0.70 && rmse <= 10) return { threshold: 0.25, regla: `${nota} >= 0.70 y RMSE=${rmse.toFixed(2)} <= 10 → confianza media, 25% revisión obligatoria.` }
  if (r2 >= 0.50) return { threshold: 0.50, regla: `${nota} >= 0.50 → confianza baja, 50% revisión obligatoria.` }
  return { threshold: 1.0, regla: `${nota} < 0.50 → IA no demostró ser confiable con la evidencia disponible (regularizada por tamaño de muestra), 100% revisión obligatoria.` }
}
