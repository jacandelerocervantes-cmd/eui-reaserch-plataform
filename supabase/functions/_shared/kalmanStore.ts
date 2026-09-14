/**
 * Persistencia del filtro de Kalman escalar (ver kalman.ts) en la tabla
 * genérica kalman_states — un solo punto de entrada para aplicar suavizado
 * a CUALQUIER serie escalar de cualquiera de los dos dominios: asistencia,
 * tendencia de calificación por actividad, tendencia de examen, sensor IoT,
 * etc. No es una tabla/función por feature — todas las llamadas a
 * applyKalman() comparten la misma mecánica y el mismo lugar de estado.
 *
 * Requiere supabase/pendiente/002_graphrag_schema.sql aplicado (tabla
 * kalman_states) y supabase/pendiente/006_rls_hardening_kalman_version.sql
 * (columna `version`, usada para optimistic locking — ver applyKalman).
 */
import type { SupabaseClient } from "./auth.ts"
import { kalmanCorrect, kalmanCorrectVector, type KalmanCorrectResult, type KalmanVectorResult } from "./kalman.ts"

export type KalmanDomain = "docencia" | "investigacion"

export interface ApplyKalmanParams {
  domain: KalmanDomain
  entityType: string // ej. 'student_attendance', 'student_grade_trend', 'equipo_lab_sensor'
  entityId: string
  signalName: string // ej. 'asistencia_pct', 'promedio_actividades', 'temperatura'
  measurement: number
  processNoiseQ: number
  measurementNoiseR: number
  outlierSigmas?: number
}

const MAX_CAS_ATTEMPTS = 5

/**
 * Lee el estado previo (si existe), corre predicción+actualización, y
 * persiste el nuevo estado. Devuelve el resultado del filtro (incluye
 * isOutlier) para que el caller decida qué hacer con eso (alertar, marcar,
 * etc.) — este helper no toma esa decisión de negocio, solo hace la
 * estimación.
 *
 * Optimistic locking: el ciclo read→compute→write no es atómico (PostgREST
 * no expone transacciones al cliente), así que dos invocaciones concurrentes
 * para la misma entidad/señal (ej. dos docentes recalculando riesgo al mismo
 * tiempo) podían leer el mismo estado previo y pisarse una a otra (lost
 * update). Se resuelve con compare-and-swap sobre `version`: el UPDATE solo
 * aplica si `version` sigue siendo la que se leyó; si otra invocación ganó
 * la carrera, se reintenta el ciclo completo (re-lee el estado ya actualizado
 * y vuelve a calcular sobre ese) hasta MAX_CAS_ATTEMPTS veces.
 */
export async function applyKalman(
  client: SupabaseClient,
  params: ApplyKalmanParams,
): Promise<KalmanCorrectResult> {
  const { domain, entityType, entityId, signalName, measurement, processNoiseQ, measurementNoiseR, outlierSigmas } = params

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const { data: existing } = await client
      .from("kalman_states")
      .select("x, p, version")
      .eq("domain", domain)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("signal_name", signalName)
      .maybeSingle()

    const result = kalmanCorrect(
      existing ? { x: existing.x, p: existing.p } : null,
      measurement,
      processNoiseQ,
      measurementNoiseR,
      outlierSigmas,
    )

    const row = {
      domain, entity_type: entityType, entity_id: entityId, signal_name: signalName,
      x: result.state.x, p: result.state.p,
      last_measurement: measurement, last_is_outlier: result.isOutlier,
      updated_at: new Date().toISOString(),
    }

    if (!existing) {
      // Primera lectura para esta entidad/señal: insert directo. Si otra
      // invocación concurrente también está en su primer insert, la
      // constraint UNIQUE(domain,entity_type,entity_id,signal_name) hace que
      // una de las dos falle — se reintenta y esa segunda vuelta ya toma la
      // rama de UPDATE de abajo.
      const { error } = await client.from("kalman_states").insert({ ...row, version: 0 })
      if (!error) return result
      if (attempt === MAX_CAS_ATTEMPTS - 1) console.error("[KALMAN_STORE] insert (CAS agotado):", error.message)
      continue
    }

    // CAS: solo escribe si `version` no cambió desde el SELECT de arriba.
    const { data: updated, error } = await client
      .from("kalman_states")
      .update({ ...row, version: existing.version + 1 })
      .eq("domain", domain).eq("entity_type", entityType).eq("entity_id", entityId).eq("signal_name", signalName)
      .eq("version", existing.version)
      .select("domain")

    if (error) {
      console.error("[KALMAN_STORE] update:", error.message)
      return result // no hay nada mejor que devolver; no reintentar sobre un error real de DB
    }
    if (updated && updated.length > 0) return result
    // updated.length === 0: alguien más ganó la carrera entre el SELECT y el
    // UPDATE — reintenta el ciclo completo sobre el estado ya actualizado.
  }

  console.error("[KALMAN_STORE] CAS agotado tras", MAX_CAS_ATTEMPTS, "intentos para", domain, entityType, entityId, signalName)
  // Último recurso: devuelve el resultado calculado en el último intento sin
  // persistir — el caller sigue funcionando con una estimación válida para
  // esta invocación, aunque no haya quedado guardada (se corrige sola en el
  // siguiente recálculo).
  const { data: existing } = await client
    .from("kalman_states")
    .select("x, p")
    .eq("domain", domain).eq("entity_type", entityType).eq("entity_id", entityId).eq("signal_name", signalName)
    .maybeSingle()
  return kalmanCorrect(existing ? { x: existing.x, p: existing.p } : null, measurement, processNoiseQ, measurementNoiseR, outlierSigmas)
}

// ═══════════════════════════════════════════════════════════════════════
// Persistencia del filtro VECTORIAL (kalmanCorrectVector, ver kalman.ts) —
// función ADICIONAL, no reemplaza applyKalman de arriba (sigue intacta,
// todos sus callers actuales sin cambios). Requiere
// supabase/pendiente/011_kalman_vector_states.sql. Ver
// qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md punto 17.
// ═══════════════════════════════════════════════════════════════════════

export interface ApplyKalmanVectorParams {
  domain: KalmanDomain
  entityType: string
  entityId: string
  pairName: string // ej. 'asistencia_puntualidad' — identifica qué par de señales es x1/x2
  measurement: [number, number]
  processNoiseQ: [number, number]
  measurementNoiseR: [number, number]
}

/**
 * Mismo patrón CAS que applyKalman (optimistic locking sobre `version`),
 * aplicado al estado vectorial 2D. Ver kalman.ts (kalmanCorrectVector) para
 * las ecuaciones y la nota de honestidad sobre la covarianza cruzada
 * inicial (arranca en 0, se aprende de las observaciones reales).
 */
export async function applyKalmanVector(
  client: SupabaseClient,
  params: ApplyKalmanVectorParams,
): Promise<KalmanVectorResult> {
  const { domain, entityType, entityId, pairName, measurement, processNoiseQ, measurementNoiseR } = params

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const { data: existing } = await client
      .from("kalman_vector_states")
      .select("x1, x2, p11, p12, p22, q12_estimate, version")
      .eq("domain", domain)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("pair_name", pairName)
      .maybeSingle()

    const result = kalmanCorrectVector(
      existing ? { x: [existing.x1, existing.x2], p11: existing.p11, p12: existing.p12, p22: existing.p22 } : null,
      measurement,
      processNoiseQ,
      measurementNoiseR,
      existing?.q12_estimate ?? 0,
    )

    const row = {
      domain, entity_type: entityType, entity_id: entityId, pair_name: pairName,
      x1: result.state.x[0], x2: result.state.x[1],
      p11: result.state.p11, p12: result.state.p12, p22: result.state.p22,
      q12_estimate: result.q12Estimate,
      last_measurement_1: measurement[0], last_measurement_2: measurement[1],
      updated_at: new Date().toISOString(),
    }

    if (!existing) {
      const { error } = await client.from("kalman_vector_states").insert({ ...row, version: 0 })
      if (!error) return result
      if (attempt === MAX_CAS_ATTEMPTS - 1) console.error("[KALMAN_STORE] insert vector (CAS agotado):", error.message)
      continue
    }

    const { data: updated, error } = await client
      .from("kalman_vector_states")
      .update({ ...row, version: existing.version + 1 })
      .eq("domain", domain).eq("entity_type", entityType).eq("entity_id", entityId).eq("pair_name", pairName)
      .eq("version", existing.version)
      .select("domain")

    if (error) {
      console.error("[KALMAN_STORE] update vector:", error.message)
      return result
    }
    if (updated && updated.length > 0) return result
  }

  console.error("[KALMAN_STORE] CAS agotado (vector) tras", MAX_CAS_ATTEMPTS, "intentos para", domain, entityType, entityId, pairName)
  const { data: existing } = await client
    .from("kalman_vector_states")
    .select("x1, x2, p11, p12, p22, q12_estimate")
    .eq("domain", domain).eq("entity_type", entityType).eq("entity_id", entityId).eq("pair_name", pairName)
    .maybeSingle()
  return kalmanCorrectVector(
    existing ? { x: [existing.x1, existing.x2], p11: existing.p11, p12: existing.p12, p22: existing.p22 } : null,
    measurement, processNoiseQ, measurementNoiseR, existing?.q12_estimate ?? 0,
  )
}
