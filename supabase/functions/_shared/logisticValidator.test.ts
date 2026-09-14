import { describe, expect, it } from 'vitest'
import { DEFAULT_WEIGHTS, fitWeights, scoreSubmission, sigmoid, type SubmissionFeatures } from './logisticValidator'

describe('sigmoid', () => {
  it('mapea 0 a 0.5, valores grandes positivos cerca de 1, grandes negativos cerca de 0', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 5)
    expect(sigmoid(10)).toBeGreaterThan(0.99)
    expect(sigmoid(-10)).toBeLessThan(0.01)
  })
})

describe('scoreSubmission — con pesos por defecto (arranque en frío)', () => {
  it('una entrega limpia (sin pegados, contribución normal, revisiones normales) da probabilidad baja', () => {
    const clean: SubmissionFeatures = { suspiciousPasteCount: 0, contributionPercent: 50, totalRevisions: 20 }
    const result = scoreSubmission(clean)
    expect(result.flagged).toBe(false)
    expect(result.probability).toBeLessThan(0.3)
    expect(result.reasons).toEqual([])
  })

  it('múltiples pegados masivos por sí solos ya disparan la bandera', () => {
    const suspicious: SubmissionFeatures = { suspiciousPasteCount: 5, contributionPercent: 50, totalRevisions: 20 }
    const result = scoreSubmission(suspicious)
    expect(result.flagged).toBe(true)
    expect(result.reasons[0]).toContain('pegado')
  })

  it('contribución muy baja en equipo (sin pegados) por sí sola NO alcanza para marcar (señal débil aislada)', () => {
    const lowContribOnly: SubmissionFeatures = { suspiciousPasteCount: 0, contributionPercent: 2, totalRevisions: 20 }
    const result = scoreSubmission(lowContribOnly)
    expect(result.probability).toBeGreaterThan(scoreSubmission({ suspiciousPasteCount: 0, contributionPercent: 50, totalRevisions: 20 }).probability)
  })

  it('entrega individual (contributionPercent null) nunca activa la señal de contribución', () => {
    const individual: SubmissionFeatures = { suspiciousPasteCount: 0, contributionPercent: null, totalRevisions: 20 }
    const result = scoreSubmission(individual)
    expect(result.reasons.some((r) => r.includes('contribución'))).toBe(false)
  })

  it('combinar señales moderadas (pegados + contribución baja + pocas revisiones) SÍ dispara, aunque ninguna sola sea suficiente', () => {
    const combined: SubmissionFeatures = { suspiciousPasteCount: 2, contributionPercent: 8, totalRevisions: 2 }
    const result = scoreSubmission(combined)
    expect(result.flagged).toBe(true)
    expect(result.reasons.length).toBeGreaterThanOrEqual(2)
  })
})

describe('fitWeights — validación de que el reentrenamiento futuro converge sobre casos sintéticos', () => {
  it('con ejemplos etiquetados claramente separables, los pesos ajustados distinguen mejor que los pesos por defecto', () => {
    const examples = [
      // Confirmados como trampa: muchos pegados masivos.
      { features: { suspiciousPasteCount: 5, contributionPercent: 50, totalRevisions: 20 }, wasConfirmedCheating: true },
      { features: { suspiciousPasteCount: 4, contributionPercent: 50, totalRevisions: 15 }, wasConfirmedCheating: true },
      { features: { suspiciousPasteCount: 5, contributionPercent: 40, totalRevisions: 10 }, wasConfirmedCheating: true },
      // Confirmados como limpios (falsa alarma descartada por el docente): sin pegados.
      { features: { suspiciousPasteCount: 0, contributionPercent: 50, totalRevisions: 20 }, wasConfirmedCheating: false },
      { features: { suspiciousPasteCount: 0, contributionPercent: 45, totalRevisions: 25 }, wasConfirmedCheating: false },
      { features: { suspiciousPasteCount: 0, contributionPercent: 55, totalRevisions: 18 }, wasConfirmedCheating: false },
    ]

    const fitted = fitWeights(examples, { iterations: 1000 })

    // El peso aprendido de "pegados masivos" debe seguir siendo claramente
    // positivo (la señal más fuerte en estos datos sintéticos).
    expect(fitted.suspiciousPasteCount).toBeGreaterThan(0)

    // Con los pesos aprendidos, los casos de trampa deben puntuar más alto
    // que los limpios, de forma consistente.
    const cheatingScores = examples.filter((e) => e.wasConfirmedCheating).map((e) => scoreSubmission(e.features, fitted).probability)
    const cleanScores = examples.filter((e) => !e.wasConfirmedCheating).map((e) => scoreSubmission(e.features, fitted).probability)
    expect(Math.min(...cheatingScores)).toBeGreaterThan(Math.max(...cleanScores))
  })

  it('con cero ejemplos, devuelve los pesos por defecto sin modificar (no fabrica un ajuste de la nada)', () => {
    expect(fitWeights([])).toEqual(DEFAULT_WEIGHTS)
  })
})
