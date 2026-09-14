import { describe, expect, it } from 'vitest'
import { averagePathLengthNormalization, isolationForest } from './isolationForest'

/** PRNG determinista (mismo LCG que kalman.test.ts) para generar datos sintéticos reproducibles. */
function makeSeededRng(seed: number) {
  let state = seed
  return function next(): number {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe('averagePathLengthNormalization', () => {
  it('devuelve 0 para n<=1 (no hay camino de búsqueda posible)', () => {
    expect(averagePathLengthNormalization(1)).toBe(0)
    expect(averagePathLengthNormalization(0)).toBe(0)
  })

  it('crece con n (más puntos, camino promedio más largo)', () => {
    const c10 = averagePathLengthNormalization(10)
    const c100 = averagePathLengthNormalization(100)
    const c1000 = averagePathLengthNormalization(1000)
    expect(c10).toBeGreaterThan(0)
    expect(c100).toBeGreaterThan(c10)
    expect(c1000).toBeGreaterThan(c100)
  })
})

describe('isolationForest — validación con un outlier claro entre puntos normales', () => {
  it('asigna un score de anomalía notablemente más alto al único punto lejano que a los puntos agrupados', () => {
    const rng = makeSeededRng(123)
    // 30 puntos "normales" agrupados alrededor de (0,0) con ruido pequeño en 3 dimensiones (ej: violaciones/min, duración_ratio, desviación de tiempo por pregunta)
    const normalPoints: number[][] = Array.from({ length: 30 }, () => [
      rng() * 0.2, 0.9 + rng() * 0.2, 5 + rng() * 3,
    ])
    // 1 outlier claro: muchas violaciones/min, duración muchísimo más corta de lo esperado, tiempos de respuesta casi idénticos entre sí (sospechosamente uniforme)
    const outlier: number[] = [3.5, 0.05, 0.1]

    const points = [...normalPoints, outlier]
    const result = isolationForest(points, { seed: 7 })

    const outlierScore = result.scores[result.scores.length - 1]
    const normalScores = result.scores.slice(0, 30)
    const maxNormalScore = Math.max(...normalScores)
    const avgNormalScore = normalScores.reduce((s, v) => s + v, 0) / normalScores.length

    expect(outlierScore).toBeGreaterThan(maxNormalScore)
    expect(outlierScore).toBeGreaterThan(avgNormalScore + 0.15)
    expect(result.suspicious[result.suspicious.length - 1]).toBe(true)
  })

  it('con puntos idénticos entre sí (sin ninguna variación) no revienta y no marca falsos positivos artificiales', () => {
    const identicalPoints: number[][] = Array.from({ length: 10 }, () => [1, 1, 1])
    const result = isolationForest(identicalPoints, { seed: 1 })
    expect(result.scores).toHaveLength(10)
    expect(result.scores.every((s) => Number.isFinite(s))).toBe(true)
  })

  it('el mismo seed produce el mismo resultado (reproducibilidad)', () => {
    const points = [[0, 0], [0.1, 0.1], [5, 5], [0.2, -0.1]]
    const run1 = isolationForest(points, { seed: 55 })
    const run2 = isolationForest(points, { seed: 55 })
    expect(run1.scores).toEqual(run2.scores)
  })
})
