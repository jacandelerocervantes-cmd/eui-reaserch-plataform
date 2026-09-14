/**
 * Filtro de Kalman escalar (1 variable de estado por sensor) para suavizar
 * telemetria_iot.payload y detectar outliers, sin dependencias nuevas (puro
 * TS, equivalente a la restricción "solo numpy" del stack Python original).
 *
 * Por qué escalar y no EKF/UKF: este repo no tiene un modelo de dinámica no
 * lineal conocido (no hay cinética de proceso tipo Monod/Pirt ni ningún otro
 * modelo mecanístico de la planta/equipo) — inventar una función de
 * transición no lineal sin esa base sería fabricar precisión que no existe.
 * El modelo de proceso honesto para "un sensor sin dinámica conocida" es
 * random walk (F=1, H=1): asumimos que el valor real cambia poco entre
 * lecturas salvo ruido de proceso Q, y cada lectura cruda es una observación
 * ruidosa (ruido de medición R) de ese valor. Si en el futuro se define un
 * modelo mecanístico real de algún equipo de `equipos_lab` (ej. una curva de
 * calentamiento/enfriamiento con constante de tiempo conocida), F deja de
 * ser 1 y esto se convierte en EKF linealizando esa F alrededor del estado.
 *
 * Predicción (F=1, sin control):
 *   $\hat{x}_{k|k-1} = \hat{x}_{k-1|k-1}$
 *   $P_{k|k-1} = P_{k-1|k-1} + Q$
 *
 * Actualización (H=1), con regularización (ver nota abajo):
 *   $K_k = \min\!\left(\dfrac{P_{k|k-1}}{P_{k|k-1} + R},\; K_{\max}\right)$
 *   $\hat{x}_{k|k} = \hat{x}_{k|k-1} + K_k \left(z_k - \hat{x}_{k|k-1}\right)$
 *   $P_{k|k} = \max\!\left((1 - K_k)\, P_{k|k-1},\; P_{\min}\right)$
 *
 * Innovación (para detección de outliers):
 *   $y_k = z_k - \hat{x}_{k|k-1}$, $S_k = P_{k|k-1} + R$
 *   se marca outlier si $|y_k| > n_\sigma \sqrt{S_k}$ (default $n_\sigma=3$).
 *
 * ── Regularización (mds/03 tarea 4 — Dilema Sesgo-Varianza) ────────────────
 * Para un filtro escalar de un parámetro no hay "pesos" que penalizar con
 * L1/L2 en el sentido de una regresión — el mecanismo matemáticamente
 * equivalente aquí es limitar cuánto puede desplazar la estimación una sola
 * medición nueva, y evitar que la covarianza reportada colapse a una
 * falsa certeza absoluta. Dos guardas mínimas, agregadas sobre la
 * fórmula clásica sin cambiar el modelo de proceso (F=1, H=1 sigue igual):
 *
 * 1) Cota de ganancia $K_{\max}=0.9$: sin cota, una sola lectura ruidosa con
 *    $P_{k|k-1} \gg R$ puede llevar $K_k \to 1$, es decir, la estimación
 *    pasa a ser casi la medición cruda — el equivalente en un filtro a
 *    "memorizar el ruido del sensor" que pide evitar la tarea 4. Con
 *    $K_{\max}=0.9$ se garantiza que al menos un 10% de peso se retenga
 *    siempre en la estimación previa (shrinkage hacia el prior, el mismo
 *    principio de una ridge/L2: nunca confiar al 100% en un solo punto
 *    nuevo). 0.9 se eligió por ser laxo — no suaviza de más una tendencia
 *    real, solo pone un techo a la sobreconfianza de un outlier aislado.
 * 2) Piso de varianza $P_{\min} = R / 100$: sin piso, con $Q$ fijo pequeño
 *    (ej. `ATTENDANCE_Q = 0.01`) la covarianza posterior puede acercarse a
 *    valores casi nulos tras muchas actualizaciones, y el filtro reportaría
 *    una certeza que ninguna serie real de asistencia/calificaciones
 *    justifica. $P_{\min}$ escala con $R$ (no es una constante fija
 *    compartida entre dominios de escalas muy distintas — asistencia en
 *    [0,1] vs. notas en [0,100]) y es intencionalmente pequeño (1% de R):
 *    no cambia el comportamiento de convergencia normal del filtro, solo
 *    evita el caso límite de sobreconfianza tras muchas iteraciones.
 *
 * Ambas guardas son no-ops en el caso común (K y P ya están dentro de esos
 * límites la gran mayoría del tiempo con los Q/R actuales) — solo actúan
 * como salvaguarda en los extremos, que es exactamente el rol de un término
 * de regularización: no cambiar el ajuste cuando los datos ya se comportan
 * bien, solo evitar el caso degenerado.
 */

export interface KalmanState {
  x: number // estimación actual
  p: number // varianza de la estimación
}

export interface KalmanCorrectResult {
  state: KalmanState
  innovation: number
  innovationStd: number
  isOutlier: boolean
}

const DEFAULT_OUTLIER_SIGMAS = 3

// Regularización (ver docstring del archivo, sección "Regularización"):
// K_MAX acota cuánto puede desplazar la estimación una sola medición nueva
// (equivalente de shrinkage/ridge para un filtro escalar); P_MIN_RATIO fija
// el piso de varianza como fracción de R, escalado por dominio.
const MAX_GAIN = 0.9
const MIN_VARIANCE_RATIO = 0.01 // P_min = R * este ratio

/**
 * Un paso predicción+actualización. `prev` es null en la primera lectura de
 * un sensor (arranca con la propia medición como estimación inicial y
 * covarianza R, ya que no hay estimación previa que fusionar).
 */
export function kalmanCorrect(
  prev: KalmanState | null,
  measurement: number,
  processNoiseQ: number,
  measurementNoiseR: number,
  outlierSigmas: number = DEFAULT_OUTLIER_SIGMAS,
): KalmanCorrectResult {
  if (prev === null) {
    return {
      state: { x: measurement, p: measurementNoiseR },
      innovation: 0,
      innovationStd: Math.sqrt(measurementNoiseR),
      isOutlier: false,
    }
  }

  // Predicción
  const xPred = prev.x
  const pPred = prev.p + processNoiseQ

  // Innovación (antes de corregir, para poder marcar outliers sin dejar que
  // una lectura errónea arrastre el estado)
  const innovation = measurement - xPred
  const s = pPred + measurementNoiseR
  const innovationStd = Math.sqrt(s)
  const isOutlier = Math.abs(innovation) > outlierSigmas * innovationStd

  // Actualización — incluso si es outlier, se aplica (con K pequeño si R es
  // alto): rechazar la lectura del todo requeriría un modelo de sensor
  // fallido explícito, que no existe aquí. Se reporta el flag, no se oculta.
  // K se acota a MAX_GAIN (regularización — ver docstring): ninguna medición
  // aislada, por atípica que sea, puede desplazar la estimación más que ese
  // porcentaje de la distancia hacia sí misma.
  const k = Math.min(pPred / s, MAX_GAIN)
  const xUpd = xPred + k * innovation
  // P se acota por abajo a un piso proporcional a R (regularización — evita
  // falsa sobreconfianza tras muchas iteraciones con Q fijo pequeño).
  const pUpd = Math.max((1 - k) * pPred, measurementNoiseR * MIN_VARIANCE_RATIO)

  return { state: { x: xUpd, p: pUpd }, innovation, innovationStd, isOutlier }
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * Filtro de Kalman VECTORIAL (2 señales acopladas) — EXCEPCIÓN EXPLÍCITA A
 * LA REGLA DURA de esta ronda (qa-05a-doublecheck-03), autorizada por el
 * usuario para implementar el punto 17 de
 * 04-RECOMENDACIONES-IA-DOCENTE.md. NO reemplaza `kalmanCorrect` (el
 * escalar de arriba sigue exactamente igual, todos sus usos actuales
 * — asistencia, calificaciones, exámenes, esfuerzo, puntualidad — lo
 * siguen llamando sin cambios) — esta es una función ADICIONAL para el
 * caso específico de dos señales que se miden JUNTAS en el mismo evento y
 * podrían estar correlacionadas (ej. asistencia+puntualidad: ambas se
 * derivan del mismo escaneo QR).
 *
 * Por qué vectorial y no seguir con dos filtros escalares independientes:
 * dos escalares independientes asumen implícitamente que las dos señales
 * NO se informan entre sí — cada una se actualiza sin saber nada de la
 * otra. Un filtro vectorial con matriz de covarianza $P$ de 2x2 SÍ modela
 * la posible correlación entre ambas (vía el término $P_{12}$ fuera de la
 * diagonal) y la usa para mejorar ambas estimaciones a la vez cuando esa
 * correlación existe de verdad.
 *
 * ── Honestidad sobre la covarianza cruzada inicial (exigencia explícita
 * del usuario) ─────────────────────────────────────────────────────────
 * NO existe todavía ninguna covarianza empírica medida entre estas señales
 * en este repo — nunca se corrió un análisis que la calculara. Por lo
 * tanto:
 *   - $P_{12}$ (covarianza cruzada de la ESTIMACIÓN) arranca en 0 en la
 *     primera observación — equivale a asumir independencia inicial,
 *     honesto dado que no hay evidencia de lo contrario todavía.
 *   - $Q_{12}$ (covarianza cruzada del RUIDO DE PROCESO) NUNCA se fija a
 *     mano — se ESTIMA de forma recursiva y online a partir de las
 *     innovaciones reales de cada actualización (ver `updateCrossCovarianceEstimate`
 *     abajo): un promedio móvil exponencial del producto de las dos
 *     innovaciones observadas, $\widehat{Q}_{12} \leftarrow (1-\alpha)\widehat{Q}_{12} + \alpha\, y_{1,k}\, y_{2,k}$.
 *     Arranca en 0 (sin correlación asumida) y SOLO se aleja de 0 si las
 *     observaciones reales muestran que las dos señales de verdad se
 *     mueven juntas — no se fabrica un valor de correlación, se aprende.
 *     $\alpha=0.05$ (ventana efectiva ~20 observaciones) para que no
 *     reaccione a un solo par de observaciones ruidosas.
 *
 * Predicción ($F=I$, sin control):
 *   $\hat{\mathbf{x}}_{k|k-1} = \hat{\mathbf{x}}_{k-1|k-1}$
 *   $P_{k|k-1} = P_{k-1|k-1} + Q_k$ ,  $Q_k = \begin{bmatrix}Q_1 & \widehat{Q}_{12}\\ \widehat{Q}_{12} & Q_2\end{bmatrix}$
 *
 * Actualización ($H=I$, ambas señales observadas directamente):
 *   $\mathbf{y}_k = \mathbf{z}_k - \hat{\mathbf{x}}_{k|k-1}$
 *   $S_k = P_{k|k-1} + R$ ,  $R = \begin{bmatrix}R_1 & 0\\ 0 & R_2\end{bmatrix}$ (ruido de MEDICIÓN se asume
 *     independiente entre sensores — son mecanismos de medición distintos,
 *     a diferencia del ruido de PROCESO que sí puede compartir causa común)
 *   $K_k = P_{k|k-1}\, S_k^{-1}$
 *   $\hat{\mathbf{x}}_{k|k} = \hat{\mathbf{x}}_{k|k-1} + K_k\, \mathbf{y}_k$
 *   $P_{k|k} = (I - K_k)\, P_{k|k-1}$
 *
 * Salvaguarda numérica (NO es la regularización K_MAX/P_MIN del escalar —
 * esa lógica no se generalizó aquí para no sobre-diseñar algo que ni
 * siquiera tiene evidencia empírica de uso real todavía; ver "no
 * overengineering" en el propio pedido de esta tarea): el coeficiente de
 * correlación implícito $\rho=P_{12}/\sqrt{P_{11}P_{22}}$ se acota a
 * $[-0.98, 0.98]$ tras cada paso — sin esto, $P$ podría volverse singular
 * (determinante ≈0) y $S_k^{-1}$ explotar numéricamente.
 */

export interface KalmanVectorState {
  x: [number, number]
  // P como 2x2 explícito (no una lib de matrices — sería overengineering
  // para un caso 2x2, la inversión cerrada es trivial).
  p11: number; p12: number; p22: number
}

export interface KalmanVectorResult {
  state: KalmanVectorState
  innovation: [number, number]
  correlacionAprendida: number // P12/sqrt(P11*P22) — 0 al inicio, se aleja de 0 solo con evidencia real
}

const CROSS_COVARIANCE_LEARNING_RATE = 0.05 // alpha del promedio móvil de Q12 — ventana efectiva ~20 observaciones
const MAX_IMPLIED_CORRELATION = 0.98 // salvaguarda numérica, no regularización estadística

/**
 * Estima Q12 (covarianza cruzada del ruido de proceso) de forma recursiva a
 * partir de las innovaciones reales — arranca en 0, nunca se fija a mano.
 * `prevQ12Estimate` es el estado acumulado entre llamadas (el caller debe
 * persistirlo junto con el resto del estado vectorial).
 */
function updateCrossCovarianceEstimate(prevQ12Estimate: number, innovation1: number, innovation2: number): number {
  return (1 - CROSS_COVARIANCE_LEARNING_RATE) * prevQ12Estimate + CROSS_COVARIANCE_LEARNING_RATE * innovation1 * innovation2
}

/**
 * Un paso predicción+actualización del filtro vectorial 2D. `prev` es null
 * en la primera observación conjunta (arranca con las mediciones crudas
 * como estimación inicial, P12=0 — independencia inicial honesta).
 * `prevQ12Estimate` es el Q12 aprendido hasta ahora (0 si nunca se corrió
 * antes) — el caller lo persiste junto al resto del estado.
 */
export function kalmanCorrectVector(
  prev: KalmanVectorState | null,
  measurement: [number, number],
  processNoiseQ: [number, number], // [Q1, Q2] diagonal — SIN término cruzado fijo, ver docstring
  measurementNoiseR: [number, number], // [R1, R2] diagonal — ruido de medición independiente
  prevQ12Estimate: number = 0,
): KalmanVectorResult & { q12Estimate: number } {
  const [q1, q2] = processNoiseQ
  const [r1, r2] = measurementNoiseR

  if (prev === null) {
    return {
      state: { x: measurement, p11: r1, p12: 0, p22: r2 }, // P12=0: sin evidencia de correlación todavía
      innovation: [0, 0],
      correlacionAprendida: 0,
      q12Estimate: 0,
    }
  }

  // Predicción — Q12 = prevQ12Estimate (aprendido, nunca fijado a mano)
  const xPred: [number, number] = [prev.x[0], prev.x[1]]
  const p11Pred = prev.p11 + q1
  const p22Pred = prev.p22 + q2
  const p12Pred = prev.p12 + prevQ12Estimate

  // Innovación (R diagonal — ruido de MEDICIÓN independiente entre sensores)
  const y1 = measurement[0] - xPred[0]
  const y2 = measurement[1] - xPred[1]
  const s11 = p11Pred + r1
  const s22 = p22Pred + r2
  const s12 = p12Pred // R12=0

  // Inversión cerrada de S (2x2): S^-1 = 1/det * [[s22,-s12],[-s12,s11]]
  const det = s11 * s22 - s12 * s12
  const safeDet = Math.abs(det) < 1e-9 ? (det >= 0 ? 1e-9 : -1e-9) : det // guarda numérica: evita división por ~0
  const sInv11 = s22 / safeDet, sInv12 = -s12 / safeDet, sInv22 = s11 / safeDet

  // K = P_pred * S^-1 (2x2 * 2x2)
  const k11 = p11Pred * sInv11 + p12Pred * sInv12
  const k12 = p11Pred * sInv12 + p12Pred * sInv22
  const k21 = p12Pred * sInv11 + p22Pred * sInv12
  const k22 = p12Pred * sInv12 + p22Pred * sInv22

  const x1Upd = xPred[0] + k11 * y1 + k12 * y2
  const x2Upd = xPred[1] + k21 * y1 + k22 * y2

  // P_upd = (I - K) * P_pred
  const oneMinusK11 = 1 - k11, oneMinusK22 = 1 - k22
  const p11Upd = oneMinusK11 * p11Pred - k12 * p12Pred
  const p22Upd = -k21 * p12Pred + oneMinusK22 * p22Pred
  let p12Upd = oneMinusK11 * p12Pred - k12 * p22Pred

  // Salvaguarda numérica: acota el coeficiente de correlación implícito
  // (no es la regularización K_MAX/P_MIN del escalar — ver docstring).
  const maxP12 = MAX_IMPLIED_CORRELATION * Math.sqrt(Math.max(p11Upd, 1e-9) * Math.max(p22Upd, 1e-9))
  p12Upd = Math.max(-maxP12, Math.min(maxP12, p12Upd))

  const q12Estimate = updateCrossCovarianceEstimate(prevQ12Estimate, y1, y2)
  const correlacionAprendida = p11Upd > 0 && p22Upd > 0 ? p12Upd / Math.sqrt(p11Upd * p22Upd) : 0

  return {
    state: { x: [x1Upd, x2Upd], p11: p11Upd, p12: p12Upd, p22: p22Upd },
    innovation: [y1, y2],
    correlacionAprendida,
    q12Estimate,
  }
}
