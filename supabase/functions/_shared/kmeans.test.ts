import { describe, expect, it } from 'vitest'
import { clusterStudentRisk, labelCentroid, partitionEligible, SIGNAL_NAMES, type SignalVector } from './kmeans'

function makeSignals(overrides: Partial<Record<typeof SIGNAL_NAMES[number], number>>): SignalVector {
  const base: SignalVector = {
    asistencia: 0.9, puntualidad: 0.2, promedio_actividades: 85, promedio_examenes: 85, esfuerzo: 2,
  }
  return { ...base, ...overrides }
}

describe('partitionEligible', () => {
  it('excluye alumnos con al menos una señal null, sin fabricar ningún valor', () => {
    const students = [
      { student_id: 'a', signals: makeSignals({}) },
      { student_id: 'b', signals: makeSignals({ asistencia: null as unknown as number }) },
    ]
    const { eligible, excluded } = partitionEligible(students)
    expect(eligible.map((e) => e.student_id)).toEqual(['a'])
    expect(excluded).toEqual([{ student_id: 'b', faltantes: ['asistencia'] }])
  })
})

describe('labelCentroid', () => {
  it('etiqueta "Sin riesgo aparente" cuando ninguna señal está por debajo del umbral', () => {
    expect(labelCentroid([0, 0.2, -0.1, 0.3, 0])).toBe('Sin riesgo aparente')
  })

  it('etiqueta por la señal única claramente por debajo del promedio', () => {
    // asistencia muy por debajo (-2), el resto normal
    expect(labelCentroid([-2, 0, 0, 0.1, 0.2])).toBe('Riesgo por inasistencia')
  })

  it('etiqueta "Riesgo múltiple" cuando 3+ señales están por debajo del umbral', () => {
    expect(labelCentroid([-1, -1, -1, 0.2, 0.1])).toBe('Riesgo múltiple — prioritario')
  })
})

describe('clusterStudentRisk — validación con grupos sintéticos claramente separables', () => {
  it('separa 3 perfiles obvios (buen desempeño / riesgo por inasistencia / riesgo por notas) en 3 clústeres distintos con etiquetas correctas', () => {
    const students = [
      // Grupo A: todo bien
      { student_id: 'a1', signals: makeSignals({ asistencia: 0.95, promedio_actividades: 90, promedio_examenes: 88 }) },
      { student_id: 'a2', signals: makeSignals({ asistencia: 0.92, promedio_actividades: 87, promedio_examenes: 91 }) },
      { student_id: 'a3', signals: makeSignals({ asistencia: 0.97, promedio_actividades: 85, promedio_examenes: 89 }) },
      // Grupo B: inasistencia marcada, notas normales
      { student_id: 'b1', signals: makeSignals({ asistencia: 0.20, promedio_actividades: 85, promedio_examenes: 82 }) },
      { student_id: 'b2', signals: makeSignals({ asistencia: 0.15, promedio_actividades: 88, promedio_examenes: 80 }) },
      { student_id: 'b3', signals: makeSignals({ asistencia: 0.25, promedio_actividades: 83, promedio_examenes: 85 }) },
      // Grupo C: asiste normal, notas muy bajas
      { student_id: 'c1', signals: makeSignals({ asistencia: 0.90, promedio_actividades: 35, promedio_examenes: 30 }) },
      { student_id: 'c2', signals: makeSignals({ asistencia: 0.93, promedio_actividades: 32, promedio_examenes: 28 }) },
      { student_id: 'c3', signals: makeSignals({ asistencia: 0.88, promedio_actividades: 38, promedio_examenes: 33 }) },
    ]

    const result = clusterStudentRisk(students, { k: 3, seed: 7 })

    expect(result.excluded).toEqual([])
    expect(result.clustered).toHaveLength(9)

    const clusterOf = (id: string) => result.clustered.find((c) => c.student_id === id)!.cluster

    // Los 3 miembros de cada grupo sintético deben caer en el MISMO clúster entre sí...
    expect(clusterOf('a1')).toBe(clusterOf('a2'))
    expect(clusterOf('a2')).toBe(clusterOf('a3'))
    expect(clusterOf('b1')).toBe(clusterOf('b2'))
    expect(clusterOf('b2')).toBe(clusterOf('b3'))
    expect(clusterOf('c1')).toBe(clusterOf('c2'))
    expect(clusterOf('c2')).toBe(clusterOf('c3'))

    // ...y los 3 grupos deben quedar en clústeres DISTINTOS entre sí.
    const clusterA = clusterOf('a1'), clusterB = clusterOf('b1'), clusterC = clusterOf('c1')
    expect(new Set([clusterA, clusterB, clusterC]).size).toBe(3)

    const labelOf = (id: string) => result.clustered.find((c) => c.student_id === id)!.label
    expect(labelOf('a1')).toBe('Sin riesgo aparente')
    expect(labelOf('b1')).toBe('Riesgo por inasistencia')
    expect(labelOf('c1')).toMatch(/Riesgo por desempeño en (actividades|exámenes)/)
  })

  it('reduce k automáticamente si hay menos alumnos elegibles que k pedido', () => {
    const students = [
      { student_id: 'x1', signals: makeSignals({}) },
      { student_id: 'x2', signals: makeSignals({ asistencia: 0.1 }) },
    ]
    const result = clusterStudentRisk(students, { k: 3 })
    expect(result.k).toBe(2)
    expect(result.clustered).toHaveLength(2)
  })

  it('no fabrica resultados cuando no hay ningún alumno elegible', () => {
    const students = [
      { student_id: 'y1', signals: makeSignals({ asistencia: null as unknown as number }) },
    ]
    const result = clusterStudentRisk(students)
    expect(result.clustered).toEqual([])
    expect(result.k).toBe(0)
    expect(result.excluded).toHaveLength(1)
  })

  it('el mismo seed produce el mismo resultado (reproducibilidad)', () => {
    const students = [
      { student_id: 'a1', signals: makeSignals({ asistencia: 0.95 }) },
      { student_id: 'a2', signals: makeSignals({ asistencia: 0.92 }) },
      { student_id: 'b1', signals: makeSignals({ asistencia: 0.15, promedio_actividades: 30 }) },
      { student_id: 'b2', signals: makeSignals({ asistencia: 0.10, promedio_actividades: 25 }) },
    ]
    const run1 = clusterStudentRisk(students, { k: 2, seed: 99 })
    const run2 = clusterStudentRisk(students, { k: 2, seed: 99 })
    expect(run1.clustered).toEqual(run2.clustered)
  })
})
