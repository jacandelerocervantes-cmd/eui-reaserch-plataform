import { describe, expect, it } from 'vitest'
import { computeChronologicalSplit, findLeakage, type SplitAssignment } from './dataSplit'

function makeCourses(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `curso-${String(i).padStart(3, '0')}`,
    createdAt: new Date(2024, 0, 1 + i).toISOString(),
  }))
}

describe('computeChronologicalSplit', () => {
  it('asigna exactamente un split a cada entidad, sin huecos', () => {
    const courses = makeCourses(100)
    const split = computeChronologicalSplit(courses)

    expect(split.size).toBe(100)
    for (const c of courses) expect(split.has(c.id)).toBe(true)
  })

  it('respeta los ratios 70/15/15 dentro del margen de redondeo', () => {
    const courses = makeCourses(200)
    const split = computeChronologicalSplit(courses)
    const counts = { train: 0, validation: 0, test: 0 }
    for (const label of split.values()) counts[label]++

    expect(counts.train).toBe(140)
    expect(counts.validation).toBe(30)
    expect(counts.test).toBe(30)
  })

  it('nunca asigna un curso más antiguo a un split "posterior" que uno más nuevo (orden cronológico estricto)', () => {
    const courses = makeCourses(50)
    const split = computeChronologicalSplit(courses)
    const order: Record<string, number> = { train: 0, validation: 1, test: 2 }

    let prevRank = -1
    // Los cursos ya están en orden cronológico (curso-000 es el más antiguo).
    for (const c of courses) {
      const rank = order[split.get(c.id)!]
      expect(rank).toBeGreaterThanOrEqual(prevRank)
      prevRank = rank
    }
  })

  it('es determinista: mismo input en distinto orden produce el mismo split', () => {
    const courses = makeCourses(60)
    const shuffled = [...courses].reverse()

    const splitA = computeChronologicalSplit(courses)
    const splitB = computeChronologicalSplit(shuffled)

    for (const c of courses) {
      expect(splitB.get(c.id)).toBe(splitA.get(c.id))
    }
  })

  it('rechaza ratios que no suman 1', () => {
    expect(() =>
      computeChronologicalSplit(makeCourses(10), { train: 0.5, validation: 0.3, test: 0.3 }),
    ).toThrow(/deben sumar 1/)
  })
})

describe('findLeakage — validación computacional de que la intersección entre splits es vacía', () => {
  it('caso real: calificaciones agregadas por curso, split por curso → cero fuga', () => {
    const courses = makeCourses(30)
    const courseSplit = computeChronologicalSplit(courses)

    // Simula grades.student_id / grades.activity_id → activities.unit_id →
    // course_units.course_id: cada calificación hereda el split del curso
    // al que pertenece su actividad.
    const grades: SplitAssignment[] = []
    for (const c of courses) {
      const split = courseSplit.get(c.id)!
      for (let g = 0; g < 5; g++) {
        grades.push({ id: `grade-${c.id}-${g}`, split })
      }
    }

    const result = findLeakage(grades)
    expect(result.hasLeakage).toBe(false)
    expect(result.leakedIds).toEqual([])
  })

  it('detecta fuga real cuando el MISMO course_id termina en dos splits (ej. bug de join)', () => {
    // No es un caso hipotético sin sentido: es exactamente el bug que
    // ocurriría si un `LEFT JOIN` duplicara una fila de curso y una copia
    // se etiquetara distinto por un cálculo de split no determinista.
    const leaking: SplitAssignment[] = [
      { id: 'curso-A', split: 'train' },
      { id: 'curso-A', split: 'test' }, // mismo curso, dos splits → fuga
      { id: 'curso-B', split: 'validation' },
    ]

    const result = findLeakage(leaking)
    expect(result.hasLeakage).toBe(true)
    expect(result.leakedIds).toEqual(['curso-A'])
  })

  it('no da falsos positivos: mismo id repetido con el MISMO split no es fuga', () => {
    const notLeaking: SplitAssignment[] = [
      { id: 'grade-1', split: 'train' },
      { id: 'grade-1', split: 'train' },
    ]
    expect(findLeakage(notLeaking).hasLeakage).toBe(false)
  })
})
