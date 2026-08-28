import { describe, expect, it } from 'vitest'
import { runShrinkageBiasVarianceExperiment } from './biasVarianceExperiment'

describe('runShrinkageBiasVarianceExperiment — demostración numérica del Dilema Sesgo-Varianza sobre el estimador real de calibración', () => {
  it('es determinista (misma semilla → mismo resultado exacto), condición necesaria para que un experimento sea reproducible', () => {
    const a = runShrinkageBiasVarianceExperiment(0.8, [5, 50], 200, 999)
    const b = runShrinkageBiasVarianceExperiment(0.8, [5, 50], 200, 999)
    expect(a).toEqual(b)
  })

  it('con muestra chica (n=5), el estimador regularizado tiene MÁS sesgo absoluto pero MENOS varianza que el crudo (el patrón clásico del dilema)', () => {
    const [point] = runShrinkageBiasVarianceExperiment(0.8, [5], 5000, 42)
    expect(Math.abs(point.biasShrunk)).toBeGreaterThan(Math.abs(point.biasRaw))
    expect(point.varianceShrunk).toBeLessThan(point.varianceRaw)
  })

  it('con muestra grande (n=5000), la diferencia entre crudo y regularizado se vuelve despreciable (el shrinkage deja de importar cuando ya hay evidencia suficiente)', () => {
    const [point] = runShrinkageBiasVarianceExperiment(0.8, [5000], 3000, 7)
    expect(Math.abs(point.biasShrunk - point.biasRaw)).toBeLessThan(0.01)
    expect(Math.abs(point.varianceShrunk - point.varianceRaw)).toBeLessThan(0.001)
  })

  it('la curva de aprendizaje real: con más datos (n=1000 vs n=5), la varianza de AMBOS estimadores es sustancialmente menor (más datos = estimación más estable)', () => {
    // Se comparan los extremos (no cada paso intermedio contra el anterior):
    // con una simulación Monte Carlo de tamaño finito, la varianza empírica
    // de un valor ya pequeño tiene su propio ruido de muestreo — comparar
    // n=5 contra n=1000 (una diferencia de 200x) es una afirmación robusta;
    // comparar n=100 contra n=1000 (ambas ya chicas) no lo es.
    const points = runShrinkageBiasVarianceExperiment(0.75, [5, 1000], 5000, 2024)
    const [small, large] = points
    expect(large.varianceRaw).toBeLessThan(small.varianceRaw)
    expect(large.varianceShrunk).toBeLessThan(small.varianceShrunk)
  })

  it('en el régimen de muestra chica (n=5) con un R² verdadero cercano al objetivo del shrinkage (0), el ECM (sesgo²+varianza) del estimador regularizado es menor que el del crudo — el shrinkage cumple su propósito quando el prior es correcto: reduce el error total, no solo la varianza', () => {
    // Con el R² verdadero LEJOS de 0 (ej. 0.8, ver test anterior de sesgo)
    // el shrinkage hacia 0 introduce más sesgo del que ahorra en varianza a
    // n=5 — es matemáticamente esperado (el sesgo crece proporcional a la
    // distancia al prior). El caso donde el shrinkage SÍ reduce el ECM total
    // es cuando el R² verdadero está cerca del prior conservador (0) — que
    // es exactamente la situación que el sistema real está diseñado para
    // manejar bien: "la IA no explica nada hasta que la evidencia lo
    // demuestre" (ver docstring de calibrate-ai-thresholds).
    const [point] = runShrinkageBiasVarianceExperiment(0.1, [5], 5000, 123)
    expect(point.mseShrunk).toBeLessThan(point.mseRaw)
  })
})
