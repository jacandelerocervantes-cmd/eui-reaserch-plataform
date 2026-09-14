/**
 * K-Means puro (sin librería, sin Deno) para agrupar alumnos por PATRÓN de
 * riesgo, no solo por un umbral binario "en riesgo sí/no" — ver
 * compute-student-risk-signals para las 5 señales suavizadas por Kalman
 * (asistencia, puntualidad, promedio de actividades, promedio de exámenes,
 * esfuerzo) que ya se calculan por alumno y que este módulo agrupa.
 *
 * Separado del glue de Deno (igual que kalman.ts/aiGradingMetrics.ts) para
 * poder testearlo con vitest/node.
 *
 * DECISIONES DE DISEÑO (para que quien lea esto en 6 meses sepa el porqué):
 *
 * 1. Estandarización obligatoria antes de agrupar: las 5 señales viven en
 *    escalas completamente distintas (asistencia/puntualidad en [0,1],
 *    esfuerzo en [0,5], calificaciones en [0,100]) — sin normalizar,
 *    K-Means quedaría dominado por la escala de calificaciones y las demás
 *    señales no pesarían casi nada en la distancia euclidiana.
 *
 * 2. NO se imputan señales faltantes con el promedio del grupo — un alumno
 *    sin suficientes observaciones en alguna señal (ver
 *    `confianza_insuficiente` en compute-student-risk-signals) se EXCLUYE
 *    del agrupamiento en vez de fabricarle un valor. Mismo principio que ya
 *    usa el resto del código de riesgo/calificación ("no fabricar un
 *    número" — ver aiGradingMetrics.ts, R² null en vez de 0/1 inventado).
 *
 * 3. K pequeño y fijo (3 por defecto), no un método automático (elbow/
 *    silhouette) para elegir K — filosofía frugal: un docente con un grupo
 *    de 30-40 alumnos entiende "3 perfiles" de un vistazo; buscar el K
 *    "óptimo" añade complejidad que nadie va a poder auditar a simple vista.
 *
 * 4. Múltiples reinicios con centroides iniciales aleatorios (PRNG
 *    determinista, sembrado, para que el resultado sea reproducible en
 *    tests) — Lloyd's puede converger a un óptimo local malo con una sola
 *    inicialización; nos quedamos con el reinicio de menor inercia.
 *
 * 5. Las etiquetas de clúster son una REGLA determinista sobre el centroide
 *    (qué señal(es) quedaron más por debajo del promedio del grupo), no una
 *    salida de caja negra — el docente siempre puede verificar por qué un
 *    clúster se llama como se llama.
 */

export const SIGNAL_NAMES = [
  "asistencia", "puntualidad", "promedio_actividades", "promedio_examenes", "esfuerzo",
] as const
export type SignalName = typeof SIGNAL_NAMES[number]

export type SignalVector = Record<SignalName, number | null>

export interface EligibleStudent {
  student_id: string
  signals: SignalVector
}

export interface ExcludedStudent {
  student_id: string
  faltantes: SignalName[]
}

export interface ClusterAssignment {
  student_id: string
  cluster: number
  label: string
}

export interface ClusterRunResult {
  clustered: ClusterAssignment[]
  excluded: ExcludedStudent[]
  k: number
  centroids_original_scale: Record<SignalName, number>[]
}

// ── PRNG determinista (LCG) — mismo patrón que kalman.test.ts, pero aquí
// vive en el código de producción (no solo en el test) porque el propio
// algoritmo de K-Means necesita aleatoriedad reproducible para que "correr
// dos veces sobre los mismos datos" dé el mismo resultado, algo que un
// docente esperaría razonablemente. ────────────────────────────────────────
function makeSeededRng(seed: number): () => number {
  let state = seed >>> 0
  return function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function euclideanDistanceSq(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return sum
}

/** Separa alumnos con las 5 señales completas (agrupables) de los que les falta alguna. */
export function partitionEligible(
  students: Array<{ student_id: string; signals: SignalVector }>,
): { eligible: EligibleStudent[]; excluded: ExcludedStudent[] } {
  const eligible: EligibleStudent[] = []
  const excluded: ExcludedStudent[] = []
  for (const s of students) {
    const faltantes = SIGNAL_NAMES.filter((name) => s.signals[name] === null)
    if (faltantes.length > 0) excluded.push({ student_id: s.student_id, faltantes })
    else eligible.push({ student_id: s.student_id, signals: s.signals })
  }
  return { eligible, excluded }
}

/** z-score por señal a través del cohorte elegible — devuelve también mean/std para poder des-estandarizar los centroides después. */
function standardizeCohort(eligible: EligibleStudent[]): {
  vectors: number[][] // en el mismo orden que SIGNAL_NAMES
  means: number[]
  stds: number[]
} {
  const n = eligible.length
  const means = SIGNAL_NAMES.map((name) =>
    eligible.reduce((sum, s) => sum + (s.signals[name] as number), 0) / n
  )
  const stds = SIGNAL_NAMES.map((_, i) => {
    const variance = eligible.reduce((sum, s) => {
      const v = (s.signals[SIGNAL_NAMES[i]] as number) - means[i]
      return sum + v * v
    }, 0) / n
    // Desviación 0 (todos los alumnos idénticos en esa señal) -> esa
    // dimensión no aporta nada a la distancia; se deja en 1 para no
    // dividir entre 0 (el numerador ya sería 0 de todos modos).
    return Math.sqrt(variance) || 1
  })
  const vectors = eligible.map((s) =>
    SIGNAL_NAMES.map((name, i) => ((s.signals[name] as number) - means[i]) / stds[i])
  )
  return { vectors, means, stds }
}

/** Una corrida de Lloyd's K-Means (asignación + recentrado hasta converger o max iteraciones). Reinicia clústeres vacíos al punto más lejano de su centroide actual. */
function lloydsKMeans(
  vectors: number[][], k: number, rng: () => number, maxIterations = 100,
): { assignments: number[]; centroids: number[][]; inertia: number } {
  const n = vectors.length
  const dims = vectors[0].length

  // Inicialización: k puntos distintos del propio dataset (evita centroides "de la nada" fuera de la nube de datos).
  const indices = [...Array(n).keys()]
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  let centroids = indices.slice(0, k).map((i) => [...vectors[i]])

  let assignments = new Array(n).fill(-1)
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false
    const newAssignments = vectors.map((v) => {
      let best = 0, bestDist = Infinity
      for (let c = 0; c < k; c++) {
        const d = euclideanDistanceSq(v, centroids[c])
        if (d < bestDist) { bestDist = d; best = c }
      }
      return best
    })
    if (newAssignments.some((a, i) => a !== assignments[i])) changed = true
    assignments = newAssignments
    if (!changed && iter > 0) break

    const newCentroids: number[][] = Array.from({ length: k }, () => new Array(dims).fill(0))
    const counts = new Array(k).fill(0)
    for (let i = 0; i < n; i++) {
      counts[assignments[i]]++
      for (let d = 0; d < dims; d++) newCentroids[assignments[i]][d] += vectors[i][d]
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) {
        // Clúster vacío: reasignarlo al punto más lejano de SU centroide más
        // cercano actual, para no perder un clúster completo por mala suerte
        // en la inicialización.
        let worstIdx = 0, worstDist = -Infinity
        for (let i = 0; i < n; i++) {
          const d = euclideanDistanceSq(vectors[i], centroids[assignments[i]])
          if (d > worstDist) { worstDist = d; worstIdx = i }
        }
        newCentroids[c] = [...vectors[worstIdx]]
      } else {
        for (let d = 0; d < dims; d++) newCentroids[c][d] /= counts[c]
      }
    }
    centroids = newCentroids
  }

  const inertia = vectors.reduce((sum, v, i) => sum + euclideanDistanceSq(v, centroids[assignments[i]]), 0)
  return { assignments, centroids, inertia }
}

/** Corre varios reinicios de Lloyd's y se queda con el de menor inercia (suma de distancias² al centroide asignado). */
function bestOfKMeansRestarts(
  vectors: number[][], k: number, restarts: number, seed: number,
): { assignments: number[]; centroids: number[][] } {
  const rng = makeSeededRng(seed)
  let best: { assignments: number[]; centroids: number[][]; inertia: number } | null = null
  for (let r = 0; r < restarts; r++) {
    const result = lloydsKMeans(vectors, k, rng)
    if (!best || result.inertia < best.inertia) best = result
  }
  return { assignments: best!.assignments, centroids: best!.centroids }
}

/**
 * Etiqueta un clúster según qué señal(es) de su centroide (en z-score,
 * relativo al cohorte) están claramente por debajo del promedio del grupo
 * (z < -0.5). Regla determinista y explicable, no una salida de modelo.
 */
export function labelCentroid(centroidZ: number[]): string {
  const THRESHOLD = -0.5
  const lowSignals = SIGNAL_NAMES
    .map((name, i) => ({ name, z: centroidZ[i] }))
    .filter((s) => s.z < THRESHOLD)
    .sort((a, b) => a.z - b.z) // más negativo primero

  if (lowSignals.length === 0) return "Sin riesgo aparente"
  if (lowSignals.length >= 3) return "Riesgo múltiple — prioritario"

  const labelBySignal: Record<SignalName, string> = {
    asistencia: "Riesgo por inasistencia",
    puntualidad: "Riesgo por impuntualidad recurrente",
    promedio_actividades: "Riesgo por desempeño en actividades",
    promedio_examenes: "Riesgo por desempeño en exámenes",
    esfuerzo: "Riesgo por bajo esfuerzo en entregas (pocas revisiones)",
  }
  if (lowSignals.length === 1) return labelBySignal[lowSignals[0].name]
  return `${labelBySignal[lowSignals[0].name]} + ${labelBySignal[lowSignals[1].name]}`
}

/**
 * Punto de entrada: agrupa a los alumnos elegibles (con las 5 señales
 * completas) en `k` clústeres, etiqueta cada clúster, y reporta aparte a
 * los alumnos excluidos por falta de datos suficientes.
 *
 * Si hay menos alumnos elegibles que `k`, reduce `k` al número de alumnos
 * elegibles (no tiene sentido pedir más clústeres que puntos); si no hay
 * NINGÚN alumno elegible, devuelve clustered vacío sin intentar nada.
 */
export function clusterStudentRisk(
  students: Array<{ student_id: string; signals: SignalVector }>,
  options: { k?: number; restarts?: number; seed?: number } = {},
): ClusterRunResult {
  const { k: requestedK = 3, restarts = 10, seed = 42 } = options
  const { eligible, excluded } = partitionEligible(students)

  if (eligible.length === 0) {
    return { clustered: [], excluded, k: 0, centroids_original_scale: [] }
  }

  const k = Math.min(requestedK, eligible.length)
  const { vectors, means, stds } = standardizeCohort(eligible)
  const { assignments, centroids } = bestOfKMeansRestarts(vectors, k, restarts, seed)

  const clustered: ClusterAssignment[] = eligible.map((s, i) => ({
    student_id: s.student_id,
    cluster: assignments[i],
    label: labelCentroid(centroids[assignments[i]]),
  }))

  const centroidsOriginalScale = centroids.map((centroid) => {
    const record = {} as Record<SignalName, number>
    SIGNAL_NAMES.forEach((name, i) => { record[name] = centroid[i] * stds[i] + means[i] })
    return record
  })

  return { clustered, excluded, k, centroids_original_scale: centroidsOriginalScale }
}
