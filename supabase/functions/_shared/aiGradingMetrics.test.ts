import { describe, expect, it } from 'vitest'
import { computeR2AndRmse, filterByMinGroupSize, MIN_SAMPLES_PER_GROUP, type Pair } from './aiGradingMetrics'

describe('computeR2AndRmse — validación numérica contra caso de referencia calculado a mano', () => {
  it('reproduce R²=0.902 y RMSE=3.5 para y=[90,80,70,60], yhat=[92,78,74,55] (solución analítica de referencia)', () => {
    // Referencia calculada a mano:
    //   meanY = 75
    //   SS_res = (90-92)²+(80-78)²+(70-74)²+(60-55)² = 4+4+16+25 = 49
    //   SS_tot = (90-75)²+(80-75)²+(70-75)²+(60-75)² = 225+25+25+225 = 500
    //   R² = 1 - 49/500 = 0.902
    //   RMSE = sqrt(49/4) = sqrt(12.25) = 3.5
    const pairs: Pair[] = [
      { group_id: 'g1', y: 90, yhat: 92 },
      { group_id: 'g1', y: 80, yhat: 78 },
      { group_id: 'g1', y: 70, yhat: 74 },
      { group_id: 'g1', y: 60, yhat: 55 },
    ]
    const { r2, rmse } = computeR2AndRmse(pairs)
    expect(r2).toBeCloseTo(0.902, 10)
    expect(rmse).toBeCloseTo(3.5, 10)
  })

  it('predicción perfecta (yhat=y) da R²=1 y RMSE=0', () => {
    const pairs: Pair[] = [
      { group_id: 'g1', y: 10, yhat: 10 },
      { group_id: 'g1', y: 20, yhat: 20 },
      { group_id: 'g1', y: 30, yhat: 30 },
    ]
    const { r2, rmse } = computeR2AndRmse(pairs)
    expect(r2).toBe(1)
    expect(rmse).toBe(0)
  })

  it('R² es null (no 1 ni 0) cuando todas las notas humanas son idénticas (SS_tot=0) — caso degenerado sin fabricar un número', () => {
    const pairs: Pair[] = [
      { group_id: 'g1', y: 80, yhat: 70 },
      { group_id: 'g1', y: 80, yhat: 90 },
      { group_id: 'g1', y: 80, yhat: 80 },
    ]
    const { r2, rmse } = computeR2AndRmse(pairs)
    expect(r2).toBeNull()
    expect(rmse).toBeCloseTo(Math.sqrt((100 + 100 + 0) / 3), 10)
  })
})

describe('filterByMinGroupSize — validación del filtro de identificabilidad (mínimo de observaciones por grupo)', () => {
  it(`excluye grupos con menos de ${MIN_SAMPLES_PER_GROUP} observaciones e incluye los que tienen exactamente el mínimo`, () => {
    const pairs: Pair[] = [
      { group_id: 'examen-chico', y: 1, yhat: 1 }, // 2 obs — excluido
      { group_id: 'examen-chico', y: 1, yhat: 1 },
      { group_id: 'examen-justo', y: 1, yhat: 1 }, // exactamente 3 — incluido
      { group_id: 'examen-justo', y: 1, yhat: 1 },
      { group_id: 'examen-justo', y: 1, yhat: 1 },
      { group_id: 'examen-grande', y: 1, yhat: 1 }, // 4 — incluido
      { group_id: 'examen-grande', y: 1, yhat: 1 },
      { group_id: 'examen-grande', y: 1, yhat: 1 },
      { group_id: 'examen-grande', y: 1, yhat: 1 },
    ]
    const filtered = filterByMinGroupSize(pairs, MIN_SAMPLES_PER_GROUP)
    const groupsPresent = new Set(filtered.map((p) => p.group_id))
    expect(groupsPresent.has('examen-chico')).toBe(false)
    expect(groupsPresent.has('examen-justo')).toBe(true)
    expect(groupsPresent.has('examen-grande')).toBe(true)
    expect(filtered.length).toBe(3 + 4)
  })
})
