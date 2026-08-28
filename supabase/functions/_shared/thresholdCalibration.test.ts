import { describe, expect, it } from 'vitest'
import { calibrateThreshold, shrinkR2, SHRINKAGE_LAMBDA } from './thresholdCalibration'

describe('shrinkR2 — validación numérica contra los valores de referencia documentados (n=3 y n=100, λ=10)', () => {
  it('con n=3 (mínimo posible) y R²=0.90, el factor de encogimiento es 3/13≈0.2308 y R²_reg≈0.2077', () => {
    expect(SHRINKAGE_LAMBDA).toBe(10)
    const shrunk = shrinkR2(0.9, 3)
    expect(shrunk).toBeCloseTo(0.9 * (3 / 13), 10)
    expect(shrunk).toBeCloseTo(0.2077, 3)
  })

  it('con n=100, el factor de encogimiento es 100/110≈0.9091 y R²_reg≈0.8182 (casi sin penalización)', () => {
    const shrunk = shrinkR2(0.9, 100)
    expect(shrunk).toBeCloseTo(0.9 * (100 / 110), 10)
    expect(shrunk).toBeCloseTo(0.8182, 3)
  })

  it('a mayor n, menor encogimiento (monotonía): shrinkR2(r2,100) > shrinkR2(r2,3)', () => {
    expect(shrinkR2(0.9, 100)).toBeGreaterThan(shrinkR2(0.9, 3))
  })
})

describe('calibrateThreshold — validación de la regla determinista contra casos de referencia', () => {
  it('R² null → threshold 1.0 (sin varianza en notas humanas)', () => {
    const { threshold } = calibrateThreshold(null, 0, 50)
    expect(threshold).toBe(1.0)
  })

  it('n grande (n=100), R²_bruto=0.90 (R²_reg≈0.818) y RMSE=4 → cae en la categoría RMSE<=5 pero R²_reg<0.85, así que baja a la banda 0.70-<0.85 → threshold 0.25', () => {
    // R²_reg=0.8182 < 0.85, así que NO califica para el 0.10 aunque el RMSE sea bajo.
    const { threshold } = calibrateThreshold(0.9, 4, 100)
    expect(threshold).toBe(0.25)
  })

  it('n muy grande (n=1000, penalización de shrinkage despreciable), R²_bruto=0.95 y RMSE=3 → alta confianza, threshold 0.10', () => {
    const shrunk = shrinkR2(0.95, 1000) // 0.95*1000/1010 ≈ 0.9406
    expect(shrunk).toBeGreaterThan(0.85)
    const { threshold } = calibrateThreshold(0.95, 3, 1000)
    expect(threshold).toBe(0.10)
  })

  it('n=3 (mínimo) con R²_bruto=0.90 → tras shrinkage (≈0.2077) cae en la categoría más conservadora, threshold 1.0 (evita sobreajustar a una muestra chica)', () => {
    const { threshold } = calibrateThreshold(0.9, 2, 3)
    expect(threshold).toBe(1.0)
  })

  it('R²_reg>=0.50 pero <0.70 → threshold 0.50', () => {
    // n=30: factor=30/40=0.75 → R²_reg = 0.75*0.75=0.5625, RMSE alto para no calificar en la banda superior.
    const { threshold } = calibrateThreshold(0.75, 15, 30)
    expect(threshold).toBe(0.50)
  })

  it('R²_reg<0.50 → threshold 1.0', () => {
    const { threshold } = calibrateThreshold(0.3, 20, 50)
    expect(threshold).toBe(1.0)
  })
})
