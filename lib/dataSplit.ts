/**
 * Partición train/validation/test para el futuro entrenamiento de modelos
 * (Módulo 03, MLOps) sobre datos de la plataforma.
 *
 * El schema real (`public.courses`) no tiene una columna "semestre" — se
 * particiona por CURSO (`course_id`), no por fila individual de
 * calificación: todas las calificaciones de un mismo curso caen en el
 * mismo split. Esto evita dos tipos de fuga de datos:
 *   1. Fuga temporal: el corte es cronológico por `created_at` del curso,
 *      así que `train` nunca contiene un curso posterior a uno de `test`.
 *   2. Fuga por identidad de curso: ningún `course_id` puede aparecer en
 *      más de un split (por construcción — cada curso se asigna una única
 *      vez), a diferencia de un split aleatorio por fila de calificación,
 *      que sí mezclaría filas del mismo curso entre train y test.
 *
 * Es determinista (mismo input → mismo split siempre) — nunca usa
 * aleatoriedad, así el resultado es reproducible entre corridas.
 */

export type SplitLabel = 'train' | 'validation' | 'test'

export interface SplittableEntity {
  id: string
  createdAt: string | Date
}

export interface SplitRatios {
  train: number
  validation: number
  test: number
}

const DEFAULT_RATIOS: SplitRatios = { train: 0.7, validation: 0.15, test: 0.15 }

/**
 * Ordena las entidades cronológicamente (desempate estable por `id`) y
 * asigna cada una a un split por posición: las más antiguas a `train`,
 * las siguientes a `validation`, las más recientes a `test`.
 */
export function computeChronologicalSplit<T extends SplittableEntity>(
  entities: T[],
  ratios: SplitRatios = DEFAULT_RATIOS,
): Map<string, SplitLabel> {
  const sum = ratios.train + ratios.validation + ratios.test
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`Los ratios de split deben sumar 1 (suman ${sum}).`)
  }

  const sorted = [...entities].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    if (ta !== tb) return ta - tb
    return a.id.localeCompare(b.id)
  })

  const n = sorted.length
  const trainEnd = Math.floor(n * ratios.train)
  const validationEnd = trainEnd + Math.floor(n * ratios.validation)

  const result = new Map<string, SplitLabel>()
  sorted.forEach((entity, idx) => {
    const label: SplitLabel = idx < trainEnd ? 'train' : idx < validationEnd ? 'validation' : 'test'
    result.set(entity.id, label)
  })
  return result
}

export interface SplitAssignment {
  id: string
  split: SplitLabel
}

/**
 * Verificación computacional de Data Leakage: comprueba que ningún `id`
 * (de curso, de calificación, de lo que se le pase) tenga asignado más de
 * un split — equivalente a comprobar que la intersección entre los
 * conjuntos train/validation/test es vacía.
 */
export function findLeakage(assignments: SplitAssignment[]): {
  hasLeakage: boolean
  leakedIds: string[]
} {
  const labelsById = new Map<string, Set<SplitLabel>>()
  for (const { id, split } of assignments) {
    if (!labelsById.has(id)) labelsById.set(id, new Set())
    labelsById.get(id)!.add(split)
  }

  const leakedIds = [...labelsById.entries()]
    .filter(([, labels]) => labels.size > 1)
    .map(([id]) => id)

  return { hasLeakage: leakedIds.length > 0, leakedIds }
}
