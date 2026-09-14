/**
 * Regresión logística pura (sin librería, sin Deno) para el rol "Validador"
 * de integridad que docs/04_Multi_Agente_MCP.md (§2.3) identifica como
 * hallazgo abierto: hoy el único integrity_flag es AUTO-REPORTADO por el
 * mismo modelo (Gemini) que generó/calificó la entrega — "no es una segunda
 * opinión, es la misma opinión preguntada dos veces". Esto es esa segunda
 * opinión, independiente: no llama a ningún LLM, solo aritmética sobre
 * señales que YA calcula analyze-submission-integrity (contribution_percent,
 * integrity_flags/pegados masivos) sin depender de Gemini para nada.
 *
 * Separado del glue de Deno para poder testearlo con vitest/node, mismo
 * patrón que kalman.ts/kmeans.ts/isolationForest.ts.
 *
 * DECISIONES DE DISEÑO:
 *
 * 1. Pesos fijados A MANO (no aprendidos) como arranque en frío — hoy no
 *    existen suficientes casos etiquetados por un docente ("esto sí era
 *    trampa" / "falsa alarma") para ajustar una regresión de verdad.
 *    `integrity_flag_feedback` (ver migración) acumula esas etiquetas desde
 *    ahora; cuando haya suficientes, estos pesos se reemplazan por unos
 *    ajustados con esos datos reales (ver `fitWeights` más abajo, ya listo
 *    para ese momento, no usado todavía en producción).
 *
 * 2. Features normalizadas a [0,1] antes de aplicar los pesos — así los
 *    pesos son directamente comparables entre sí como "importancia relativa"
 *    sin tener que compensar mentalmente escalas distintas.
 *
 * 3. Nunca bloquea ni cambia calificaciones — mismo principio que Isolation
 *    Forest: el score es una señal para que el docente decida, no un
 *    veredicto automático.
 */

export interface SubmissionFeatures {
  /** # de eventos de "pegado masivo" detectados por analyze-submission-integrity (integrity_flags.length). */
  suspiciousPasteCount: number
  /** % de contribución del alumno a un Doc de EQUIPO (0-100). null si es entrega individual (no aplica). */
  contributionPercent: number | null
  /** # total de revisiones guardadas del documento (Google Docs revision history). */
  totalRevisions: number
}

export interface ValidatorWeights {
  bias: number
  suspiciousPasteCount: number
  lowContribution: number // se activa cuando contributionPercent es bajo Y es entrega de equipo
  fewRevisions: number    // se activa cuando totalRevisions es sospechosamente bajo
}

// Pesos iniciales fijados a mano (arranque en frío — ver nota de diseño
// arriba). Interpretación: log-odds que aporta cada señal cuando está
// presente con intensidad máxima (features ya normalizadas 0-1).
export const DEFAULT_WEIGHTS: ValidatorWeights = {
  bias: -2.0,               // prior: la mayoría de entregas NO son sospechosas
  suspiciousPasteCount: 3.5, // señal más fuerte: por sí sola ya cruza el umbral
  lowContribution: 2.0,
  fewRevisions: 1.0,         // señal más débil por sí sola — muchos alumnos legítimamente escriben de un jalón
}

const SUSPICIOUS_PASTE_CAP = 5 // 5+ eventos ya satura la señal, no distingue más allá de eso
const LOW_CONTRIBUTION_THRESHOLD = 15 // % — por debajo de esto, "casi no tocó el documento"
// Exportado: cuando no se conoce totalRevisions (ver validate-submission-integrity,
// que no siempre lo recibe) se usa este mismo valor como "neutral" — ni suma
// ni resta a la señal, en vez de fabricar un número que sí la mueva.
export const FEW_REVISIONS_THRESHOLD = 3 // 1-2 revisiones en un documento largo es la señal, no un número exacto

export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z))
}

/** Traduce features crudas a las 3 señales normalizadas [0,1] que usa el modelo — separado para poder testear cada regla por su cuenta. */
export function normalizeFeatures(f: SubmissionFeatures): { suspiciousPasteNorm: number; lowContributionNorm: number; fewRevisionsNorm: number } {
  const suspiciousPasteNorm = Math.min(f.suspiciousPasteCount, SUSPICIOUS_PASTE_CAP) / SUSPICIOUS_PASTE_CAP

  // Sin contribution_percent (entrega individual, o aún no analizada) esta
  // señal simplemente no aporta nada — no se fabrica un valor.
  const lowContributionNorm = f.contributionPercent === null
    ? 0
    : Math.max(0, (LOW_CONTRIBUTION_THRESHOLD - f.contributionPercent) / LOW_CONTRIBUTION_THRESHOLD)

  const fewRevisionsNorm = Math.max(0, (FEW_REVISIONS_THRESHOLD - f.totalRevisions) / FEW_REVISIONS_THRESHOLD)

  return { suspiciousPasteNorm, lowContributionNorm, fewRevisionsNorm }
}

export interface ValidatorResult {
  probability: number // [0,1] — probabilidad estimada de que la entrega amerite revisión de integridad
  flagged: boolean
  reasons: string[]
}

const SUSPICIOUS_THRESHOLD = 0.5

/** Corre el clasificador sobre una entrega. Nunca lanza — con features todas en 0/null da un score bajo (prior), no un error. */
export function scoreSubmission(features: SubmissionFeatures, weights: ValidatorWeights = DEFAULT_WEIGHTS): ValidatorResult {
  const { suspiciousPasteNorm, lowContributionNorm, fewRevisionsNorm } = normalizeFeatures(features)

  const z = weights.bias
    + weights.suspiciousPasteCount * suspiciousPasteNorm
    + weights.lowContribution * lowContributionNorm
    + weights.fewRevisions * fewRevisionsNorm

  const probability = sigmoid(z)
  const reasons: string[] = []
  if (suspiciousPasteNorm > 0) reasons.push(`${features.suspiciousPasteCount} pegado(s) masivo(s) detectado(s)`)
  if (lowContributionNorm > 0) reasons.push(`contribución baja al documento de equipo (${features.contributionPercent}%)`)
  if (fewRevisionsNorm > 0) reasons.push(`pocas revisiones guardadas (${features.totalRevisions})`)

  return { probability, flagged: probability > SUSPICIOUS_THRESHOLD, reasons }
}

// ── Reentrenamiento futuro (no usado en producción todavía) ────────────────
// Punto de entrada para cuando `integrity_flag_feedback` tenga suficientes
// casos etiquetados por docentes — descenso de gradiente simple sobre las 3
// features normalizadas, para reemplazar DEFAULT_WEIGHTS por unos ajustados
// a los datos reales de esta institución en vez de la intuición inicial.
export interface LabeledExample { features: SubmissionFeatures; wasConfirmedCheating: boolean }

export function fitWeights(
  examples: LabeledExample[], options: { learningRate?: number; iterations?: number } = {},
): ValidatorWeights {
  const { learningRate = 0.1, iterations = 500 } = options
  let w = { ...DEFAULT_WEIGHTS }
  const n = examples.length
  if (n === 0) return w

  for (let iter = 0; iter < iterations; iter++) {
    const gradients = { bias: 0, suspiciousPasteCount: 0, lowContribution: 0, fewRevisions: 0 }
    for (const ex of examples) {
      const { suspiciousPasteNorm, lowContributionNorm, fewRevisionsNorm } = normalizeFeatures(ex.features)
      const z = w.bias + w.suspiciousPasteCount * suspiciousPasteNorm + w.lowContribution * lowContributionNorm + w.fewRevisions * fewRevisionsNorm
      const pred = sigmoid(z)
      const error = pred - (ex.wasConfirmedCheating ? 1 : 0)
      gradients.bias += error
      gradients.suspiciousPasteCount += error * suspiciousPasteNorm
      gradients.lowContribution += error * lowContributionNorm
      gradients.fewRevisions += error * fewRevisionsNorm
    }
    w = {
      bias: w.bias - (learningRate * gradients.bias) / n,
      suspiciousPasteCount: w.suspiciousPasteCount - (learningRate * gradients.suspiciousPasteCount) / n,
      lowContribution: w.lowContribution - (learningRate * gradients.lowContribution) / n,
      fewRevisions: w.fewRevisions - (learningRate * gradients.fewRevisions) / n,
    }
  }
  return w
}
