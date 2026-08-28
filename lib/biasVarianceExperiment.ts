/**
 * Experimento reproducible del Dilema Sesgo-Varianza (mds/03 tarea 4),
 * aplicado al ESTIMADOR REAL que ya regulariza el sistema —
 * `shrinkR2` (James-Stein/empirical-Bayes shrinkage, ver
 * `supabase/functions/_shared/thresholdCalibration.ts`) — en vez de simular
 * un modelo de juguete sin relación con el proyecto.
 *
 * No hay un modelo entrenado con pesos propios en este repo (es LLM-as-judge,
 * ver `supabase/pendiente/VALIDACION_Y_CALIBRACION.md`), así que el
 * "sesgo-varianza" no aplica a pesos de una red — aplica al ESTIMADOR de R²
 * usado para calibrar el umbral de revisión humana. Este experimento lo
 * demuestra con matemática real:
 *
 * Dado un R² "verdadero" desconocido θ, y una muestra de tamaño n que
 * produce un R² observado ruidoso R̂² ~ θ + ruido (varianza decreciente con
 * n, como cualquier estadístico muestral), comparamos dos estimadores:
 *
 *   Estimador crudo:      R̂²          (sin sesgo, pero con varianza alta si n es chico)
 *   Estimador regularizado: R̂²·n/(n+λ) (sesgo hacia 0, pero varianza más baja)
 *
 * $\text{ECM}(\hat\theta) = \text{Sesgo}(\hat\theta)^2 + \text{Var}(\hat\theta)$
 *
 * El experimento corre M repeticiones Monte Carlo para varios tamaños de
 * muestra n, y mide sesgo/varianza empíricos de ambos estimadores — el
 * resultado esperado (y lo que valida el test) es el patrón clásico: con n
 * chico, el estimador regularizado tiene MÁS sesgo pero MENOS varianza que
 * el crudo (y por lo tanto puede tener menor ECM total); con n grande, la
 * diferencia se vuelve despreciable.
 */
import { shrinkR2 } from '../supabase/functions/_shared/thresholdCalibration'

/** PRNG determinista (LCG) + Box-Muller — reproducible entre corridas, sin Math.random. */
export function makeSeededGaussian(seed: number): () => number {
  let state = seed
  function nextUniform(): number {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
  return function nextGaussian(): number {
    const u1 = Math.max(nextUniform(), 1e-9)
    const u2 = nextUniform()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }
}

export interface BiasVariancePoint {
  n: number
  biasRaw: number
  varianceRaw: number
  mseRaw: number
  biasShrunk: number
  varianceShrunk: number
  mseShrunk: number
}

/**
 * Simula, para un R² verdadero `trueR2` y cada tamaño de muestra en
 * `sampleSizes`, `trials` repeticiones de "observar un R² ruidoso de una
 * muestra de tamaño n" (ruido gaussiano con desviación estándar
 * proporcional a 1/sqrt(n), como cualquier estadístico muestral bien
 * comportado), y compara el estimador crudo contra el regularizado
 * (`shrinkR2`, el mismo código que corre en producción).
 */
export function runShrinkageBiasVarianceExperiment(
  trueR2: number,
  sampleSizes: number[],
  trials: number,
  seed = 12345,
): BiasVariancePoint[] {
  const gaussian = makeSeededGaussian(seed)
  const points: BiasVariancePoint[] = []

  for (const n of sampleSizes) {
    const noiseStd = 1 / Math.sqrt(n) // el ruido de un estadístico muestral decrece con sqrt(n)
    const rawEstimates: number[] = []
    const shrunkEstimates: number[] = []

    for (let t = 0; t < trials; t++) {
      const noisyR2 = Math.max(-1, Math.min(1, trueR2 + gaussian() * noiseStd * 0.3))
      rawEstimates.push(noisyR2)
      shrunkEstimates.push(shrinkR2(noisyR2, n))
    }

    const meanRaw = rawEstimates.reduce((a, b) => a + b, 0) / trials
    const meanShrunk = shrunkEstimates.reduce((a, b) => a + b, 0) / trials
    const varianceRaw = rawEstimates.reduce((s, x) => s + (x - meanRaw) ** 2, 0) / trials
    const varianceShrunk = shrunkEstimates.reduce((s, x) => s + (x - meanShrunk) ** 2, 0) / trials
    const biasRaw = meanRaw - trueR2
    const biasShrunk = meanShrunk - trueR2

    points.push({
      n,
      biasRaw,
      varianceRaw,
      mseRaw: biasRaw ** 2 + varianceRaw,
      biasShrunk,
      varianceShrunk,
      mseShrunk: biasShrunk ** 2 + varianceShrunk,
    })
  }

  return points
}
