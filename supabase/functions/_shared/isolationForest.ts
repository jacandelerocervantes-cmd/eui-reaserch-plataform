/**
 * Isolation Forest puro (sin librería, sin Deno) para detectar entregas de
 * examen anómalas más allá del conteo fijo de incidencias (tab_switches/
 * copy_attempts/fullscreen_exits >= 3 = bloqueo, ver useExamSession.ts) —
 * ver conversación de "estado del arte de integridad académica".
 *
 * Separado del glue de Deno para poder testearlo con vitest/node, mismo
 * patrón que kalman.ts/kmeans.ts.
 *
 * ALGORITMO (Liu, Ting & Zhou, 2008 — "Isolation Forest"):
 * construye `numTrees` árboles binarios; cada uno particiona un subsample
 * aleatorio del dataset eligiendo, en cada nodo, una FEATURE al azar y un
 * punto de corte al azar entre su mínimo y máximo dentro de ese subsample.
 * Los puntos anómalos quedan aislados (en su propia hoja) en pocos cortes
 * porque están lejos de la masa de datos normales; los puntos normales
 * necesitan muchos más cortes para separarse del resto. La profundidad
 * promedio a la que un punto queda aislado, normalizada, es su score de
 * anomalía: cerca de 1 = anómalo, cerca de 0.5 o menos = normal.
 *
 * DECISIONES DE DISEÑO:
 *
 * 1. NO se estandarizan las features antes de construir los árboles — a
 *    diferencia de K-Means (distancia entre TODAS las dimensiones a la
 *    vez), cada corte de Isolation Forest usa una sola feature por vez
 *    (su propio mín/máx dentro del subsample), así que la escala relativa
 *    entre features no distorsiona nada.
 *
 * 2. Nunca bloquea nada automáticamente — a diferencia de la regla de 3
 *    incidencias (que sí es una garantía dura y se queda igual), esto
 *    devuelve un score para que el DOCENTE decida qué revisar. Ver
 *    GUIA_USO_DOCENTE.md del watermark — mismo principio: "señal de alerta,
 *    no prueba forense infalible".
 *
 * 3. Umbral de "sospechoso" fijo en 0.6 (convención del paper original,
 *    Liu et al. reportan que scores >0.6 típicamente aíslan anomalías
 *    reales en sus benchmarks) — no se ajusta por dataset porque con
 *    grupos pequeños (20-40 alumnos) no hay suficiente masa para calibrar
 *    un umbral propio con confianza.
 */

export const MIN_SUBMISSIONS_FOR_FOREST = 5
const DEFAULT_NUM_TREES = 100
const SUSPICIOUS_THRESHOLD = 0.6

interface TreeNode {
  // Nodo interno: featureIndex + splitValue + hijos. Nodo hoja: size (cuántos
  // puntos del subsample cayeron ahí) y depth (a qué profundidad se detuvo).
  featureIndex?: number
  splitValue?: number
  left?: TreeNode
  right?: TreeNode
  isLeaf: boolean
  size: number
  depth: number
}

function makeSeededRng(seed: number): () => number {
  let state = seed >>> 0
  return function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** Altura máxima recomendada por el paper original: log2(subsampleSize), redondeado hacia arriba. Limita cortes inútiles una vez que ya no hay forma de reducir más el tamaño del subsample. */
function maxTreeHeight(subsampleSize: number): number {
  return Math.ceil(Math.log2(Math.max(subsampleSize, 2)))
}

/**
 * Longitud promedio de un camino de búsqueda sin éxito en un árbol binario
 * de búsqueda con `n` nodos (c(n) del paper original) — normaliza la
 * profundidad de aislamiento para que el score final quede en ~[0,1]
 * independientemente de cuántos puntos tenga el dataset.
 */
export function averagePathLengthNormalization(n: number): number {
  if (n <= 1) return 0
  const EULER_MASCHERONI = 0.5772156649
  const harmonic = Math.log(n - 1) + EULER_MASCHERONI
  return 2 * harmonic - (2 * (n - 1)) / n
}

function buildTree(
  points: number[][], indices: number[], depth: number, heightLimit: number, rng: () => number,
): TreeNode {
  if (depth >= heightLimit || indices.length <= 1) {
    return { isLeaf: true, size: indices.length, depth }
  }

  const numFeatures = points[0].length
  // Elige una feature con varianza real dentro de este subsample (una
  // feature constante no puede partir nada) — si TODAS son constantes, no
  // hay forma de seguir aislando, se corta como hoja.
  const candidateFeatures = [...Array(numFeatures).keys()]
  for (let attempt = 0; attempt < numFeatures; attempt++) {
    const fi = candidateFeatures[Math.floor(rng() * candidateFeatures.length)]
    const values = indices.map((i) => points[i][fi])
    const min = Math.min(...values), max = Math.max(...values)
    if (min === max) { candidateFeatures.splice(candidateFeatures.indexOf(fi), 1); continue }

    const splitValue = min + rng() * (max - min)
    const leftIndices = indices.filter((i) => points[i][fi] < splitValue)
    const rightIndices = indices.filter((i) => points[i][fi] >= splitValue)
    // Corte degenerado (todo cae de un lado pese a min<max, por redondeo):
    // reintenta con otra feature en vez de producir un nodo inútil.
    if (leftIndices.length === 0 || rightIndices.length === 0) continue

    return {
      isLeaf: false, size: indices.length, depth, featureIndex: fi, splitValue,
      left: buildTree(points, leftIndices, depth + 1, heightLimit, rng),
      right: buildTree(points, rightIndices, depth + 1, heightLimit, rng),
    }
  }
  return { isLeaf: true, size: indices.length, depth }
}

/** Profundidad de aislamiento de `point`, ajustada por `averagePathLengthNormalization(node.size)` cuando el recorrido termina en una hoja con más de 1 punto (no se aisló del todo, solo se acabó la altura permitida). */
function pathLength(node: TreeNode, point: number[]): number {
  if (node.isLeaf) return node.depth + averagePathLengthNormalization(node.size)
  const goLeft = point[node.featureIndex!] < node.splitValue!
  return pathLength(goLeft ? node.left! : node.right!, point)
}

export interface IsolationForestResult {
  scores: number[] // mismo orden que `points`, en [0,1] aprox — más alto = más anómalo
  suspicious: boolean[] // score > SUSPICIOUS_THRESHOLD
}

/**
 * Construye un bosque de `numTrees` árboles sobre subsamples aleatorios de
 * `points`, y devuelve el score de anomalía de CADA punto original (no solo
 * de los que cayeron en cada subsample — cada árbol evalúa a todos).
 *
 * `subsampleSize` por defecto es min(256, n) — 256 es el tamaño recomendado
 * por el paper original (más grande no mejora la detección y sí el costo);
 * con datasets pequeños (grupos de 20-40 alumnos) simplemente se usa el
 * dataset completo.
 */
export function isolationForest(
  points: number[][],
  options: { numTrees?: number; subsampleSize?: number; seed?: number } = {},
): IsolationForestResult {
  const n = points.length
  const { numTrees = DEFAULT_NUM_TREES, subsampleSize = Math.min(256, n), seed = 42 } = options
  const rng = makeSeededRng(seed)
  const heightLimit = maxTreeHeight(subsampleSize)

  const trees: TreeNode[] = []
  for (let t = 0; t < numTrees; t++) {
    const allIndices = [...Array(n).keys()]
    for (let i = allIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]]
    }
    const subsampleIndices = allIndices.slice(0, subsampleSize)
    trees.push(buildTree(points, subsampleIndices, 0, heightLimit, rng))
  }

  const cN = averagePathLengthNormalization(subsampleSize)
  const scores = points.map((p) => {
    const avgPath = trees.reduce((sum, tree) => sum + pathLength(tree, p), 0) / numTrees
    return cN === 0 ? 0 : Math.pow(2, -avgPath / cN)
  })

  return { scores, suspicious: scores.map((s) => s > SUSPICIOUS_THRESHOLD) }
}
