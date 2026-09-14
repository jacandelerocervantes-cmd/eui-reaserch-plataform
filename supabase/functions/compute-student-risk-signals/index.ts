// deno-lint-ignore-file no-import-prefix
/**
 * compute-student-risk-signals
 * Recalcula, por alumno de una materia, la tendencia suavizada (Kalman) de
 * CINCO señales reales: asistencia, puntualidad, calificaciones por
 * actividad, exámenes y esfuerzo (revisiones de entregas). No es una
 * llamada a Gemini — es estimación de estado sobre datos ya existentes
 * (validated_attendances, grades, student_exams, submissions), persistida
 * en kalman_states vía _shared/kalmanStore.ts.
 *
 * Es un recálculo por lotes bajo demanda (el docente lo dispara desde el
 * panel de la materia), no un trigger automático por cada evento — doblar
 * sobre el historial completo cada vez es correcto para un filtro con Q/R
 * fijos: converge al mismo estado aproximado sin importar cuántas veces se
 * recalcule.
 *
 * Umbral de riesgo: heurística determinista y documentada (no una "IA" que
 * decide en secreto) — asistencia suavizada < 0.6 O promedio de
 * calificaciones suavizado < 60 marca al alumno como en riesgo. Ajustable
 * por el docente en el futuro, no hardcoded como verdad absoluta.
 *
 * Origen de las señales 2 (puntualidad), 4 (correlación) y 5 (esfuerzo):
 * qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md, puntos 1.2, 1.4 y
 * 2.4. Todas por alumno, visibles SOLO al docente dueño del curso
 * (verifyCourseOwnership, sin cambios) — nunca agregadas ni expuestas a
 * otros alumnos.
 *
 * Punto 17 (Kalman vectorial): ADEMÁS de los dos filtros escalares
 * independientes de asistencia y puntualidad (sin cambios, siguen
 * corriendo igual), se corre un filtro vectorial conjunto
 * (`applyKalmanVector`, par 'asistencia_puntualidad') sobre las mismas dos
 * mediciones de cada sesión — ambas se originan del mismo escaneo QR, así
 * que es razonable sospechar correlación, pero esa correlación NO se
 * asume: arranca en 0 y se aprende de las observaciones reales (ver
 * _shared/kalman.ts). El resultado (`correlacion_asistencia_puntualidad_aprendida`)
 * es informativo — no reemplaza ni modifica `asistencia_suavizada`/
 * `puntualidad_suavizada`, que siguen viniendo de los filtros escalares
 * de siempre.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
import { applyKalman, applyKalmanVector } from "../_shared/kalmanStore.ts"

// Ruido de proceso (Q) y de medición (R) por señal — valores de partida
// razonables, no calibrados empíricamente todavía (eso es la Fase de
// "calibración de umbrales" pendiente, ver conversación). Revisados en
// qa-05a-doublecheck-03/01-REPORTE.md sección 2.1 — Q pequeño frente a R es
// la elección correcta para este objetivo (una sola inasistencia/nota baja
// aislada es más probablemente ruido que tendencia real).
const ATTENDANCE_Q = 0.01, ATTENDANCE_R = 0.15   // status en [0, 0.5, 1]
const GRADE_Q = 4, GRADE_R = 100                  // score en escala 0-100
const EXAM_Q = 4, EXAM_R = 100
// Puntualidad: fracción de la ventana de radar transcurrida al escanear
// (0 = llegó justo al abrir el radar, 1 = escaneó en el último segundo de
// la ventana de 300s) — ver register-attendance/index.ts (scan_offset_seconds,
// supabase/pendiente/008_attendance_metadata.sql). Mismo orden de magnitud
// de ruido que asistencia: es una señal de comportamiento igual de "lenta".
const PUNCTUALITY_Q = 0.01, PUNCTUALITY_R = 0.1
// Esfuerzo: número de revisiones de una entrega (submissions.version_number),
// tope en 5 (a partir de ahí, más revisiones ya no distingue "más esfuerzo"
// de forma confiable — variabilidad normal de estilo de trabajo). R alto
// relativo a Q: una sola entrega con muchas/pocas versiones no debe mover
// mucho la tendencia, es una señal más ruidosa que asistencia/notas porque
// el número de revisiones depende también del tipo de actividad, no solo
// del alumno.
const EFFORT_Q = 0.05, EFFORT_R = 1.5
const EFFORT_VERSION_CAP = 5

const ATTENDANCE_RISK_THRESHOLD = 0.6
const GRADE_RISK_THRESHOLD = 60

// Con menos de esto, el "suavizado" del Kalman es casi la lectura cruda (P
// todavía cerca de R, el filtro apenas empezó a converger) — no hay
// suficiente historial para marcar a un alumno en riesgo con confianza.
// Con 1 punto x=medición sin más; con 2 ya corrió una actualización pero con
// varianza alta; 3 es el mínimo razonable para reportar una tendencia y no
// una lectura aislada disfrazada de tendencia. Mismo umbral que usa
// validate-ai-grading (MIN_SAMPLES_PER_GROUP) por consistencia entre
// subsistemas de Módulo 03.
const MIN_OBSERVATIONS = 3

/**
 * Correlación de Pearson entre dos series numéricas de igual longitud
 * (aritmética directa, sin LLM — ver 04-RECOMENDACIONES-IA-DOCENTE.md
 * punto 1.4). NOTA HONESTA: las series de asistencia (por sesión) y de
 * calificación (por actividad) tienen calendarios distintos — no hay una
 * fecha compartida exacta para alinearlas. Se alinean por ORDEN
 * CRONOLÓGICO relativo dentro de cada serie propia del alumno (i-ésimo
 * evento de asistencia vs. i-ésima calificación), truncando a la serie más
 * corta — es una aproximación direccional para el docente, no una
 * correlación calendario-exacta. null si no hay suficientes pares.
 */
function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length)
  if (n < MIN_OBSERVATIONS) return null
  const xs = a.slice(0, n), ys = b.slice(0, n)
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX, dy = ys[i] - meanY
    num += dx * dy; denX += dx * dx; denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null // sin varianza en una de las dos series: correlación indefinida, no 0 fabricado
  return num / Math.sqrt(denX * denY)
}

interface StudentRisk {
  student_id: string
  nombre: string
  asistencia_suavizada: number | null
  asistencia_outlier: boolean
  asistencia_n_observaciones: number
  puntualidad_suavizada: number | null // 0=puntual, 1=al límite de la ventana
  puntualidad_outlier: boolean
  puntualidad_n_observaciones: number
  promedio_actividades_suavizado: number | null
  promedio_actividades_outlier: boolean
  promedio_actividades_n_observaciones: number
  promedio_examenes_suavizado: number | null
  promedio_examenes_outlier: boolean
  promedio_examenes_n_observaciones: number
  esfuerzo_suavizado: number | null // 0-5, revisiones promedio por entrega (suavizado)
  esfuerzo_n_observaciones: number
  correlacion_asistencia_calificaciones: number | null
  // Punto 17 — filtro vectorial conjunto (kalmanCorrectVector), informativo,
  // no reemplaza los suavizados escalares de arriba. null si aún no hay
  // suficientes observaciones conjuntas.
  correlacion_asistencia_puntualidad_aprendida: number | null
  en_riesgo: boolean
  motivo_riesgo: string[]
  confianza_insuficiente: string[]
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    const { course_id } = await req.json()
    if (!course_id) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'course_id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const owns = await verifyCourseOwnership(serviceClient, course_id, userId)
    if (!owns) return new Response(
      JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const { data: students } = await serviceClient
      .from("students")
      .select("id, nombres, apellido_paterno")
      .eq("course_id", course_id)
    if (!students?.length) return new Response(
      JSON.stringify({ success: true, data: { students: [] } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )
    const studentIds = students.map((s) => s.id)

    // ── Historial de asistencia (course_id directo) ──────────────────────
    // scan_offset_seconds puede ser null en filas viejas (previas a
    // supabase/pendiente/008_attendance_metadata.sql) o en marcado manual
    // (sin escaneo real) — la señal de puntualidad simplemente las salta.
    const { data: attendanceRows } = await serviceClient
      .from("validated_attendances")
      .select("student_id, status, session_date, scan_offset_seconds")
      .eq("course_id", course_id)
      .in("student_id", studentIds)
      .order("session_date", { ascending: true })

    // ── Historial de calificaciones (grades -> activities -> course_units) ─
    const { data: units } = await serviceClient.from("course_units").select("id").eq("course_id", course_id)
    const unitIds = (units ?? []).map((u) => u.id)
    const { data: activities } = unitIds.length
      ? await serviceClient.from("activities").select("id").in("unit_id", unitIds)
      : { data: [] as { id: string }[] }
    const activityIds = (activities ?? []).map((a) => a.id)
    const { data: gradeRows } = activityIds.length
      ? await serviceClient.from("grades").select("student_id, score, created_at").in("activity_id", activityIds).in("student_id", studentIds).order("created_at", { ascending: true })
      : { data: [] as { student_id: string; score: number | null; created_at: string }[] }

    // ── Historial de exámenes (student_exams -> exams.course_id) ────────────
    const { data: exams } = await serviceClient.from("exams").select("id").eq("course_id", course_id)
    const examIds = (exams ?? []).map((e) => e.id)
    const { data: examRows } = examIds.length
      ? await serviceClient.from("student_exams").select("student_id, score, final_score, finished_at").in("exam_id", examIds).in("student_id", studentIds).order("finished_at", { ascending: true })
      : { data: [] as { student_id: string; score: number | null; final_score: number | null; finished_at: string | null }[] }

    // ── Historial de esfuerzo (submissions.version_number -> assignments -> course_units) ─
    const { data: assignmentsForEffort } = unitIds.length
      ? await serviceClient.from("assignments").select("id").in("unit_id", unitIds)
      : { data: [] as { id: string }[] }
    const assignmentIdsForEffort = (assignmentsForEffort ?? []).map((a) => a.id)
    const { data: submissionRows } = assignmentIdsForEffort.length
      ? await serviceClient.from("submissions").select("student_id, version_number, submitted_at").in("assignment_id", assignmentIdsForEffort).in("student_id", studentIds).not("submitted_at", "is", null).order("submitted_at", { ascending: true })
      : { data: [] as { student_id: string; version_number: number | null; submitted_at: string | null }[] }

    const results: StudentRisk[] = []

    for (const student of students) {
      const nombre = `${student.apellido_paterno ?? ""}, ${student.nombres ?? ""}`.trim()
      const motivo_riesgo: string[] = []
      const confianza_insuficiente: string[] = []

      // Asistencia: doblar Kalman sobre la secuencia cronológica de status.
      let attendanceState: { x: number; p: number } | null = null
      let attendanceOutlier = false
      let attendanceCount = 0
      const attendanceSeries: number[] = []
      // Puntualidad: segunda señal, independiente de presencia/ausencia —
      // solo se alimenta cuando hay scan_offset_seconds real (escaneo QR).
      let punctualityState: { x: number; p: number } | null = null
      let punctualityOutlier = false
      let punctualityCount = 0
      // Punto 17 — filtro vectorial conjunto, corre EN PARALELO a los dos
      // escalares de arriba (no los reemplaza). learnedCorrelation es
      // P12/sqrt(P11*P22) del estado vectorial más reciente.
      let learnedCorrelation: number | null = null
      for (const row of (attendanceRows ?? []).filter((r) => r.student_id === student.id)) {
        const result = await applyKalman(serviceClient, {
          domain: "docencia", entityType: "student_attendance", entityId: student.id, signalName: "asistencia",
          measurement: Number(row.status), processNoiseQ: ATTENDANCE_Q, measurementNoiseR: ATTENDANCE_R,
        })
        attendanceState = result.state
        attendanceOutlier = result.isOutlier
        attendanceCount++
        attendanceSeries.push(Number(row.status))

        if (row.scan_offset_seconds !== null && row.scan_offset_seconds !== undefined) {
          const normalizedOffset = Math.min(Math.max(row.scan_offset_seconds / 300, 0), 1)
          const punctResult = await applyKalman(serviceClient, {
            domain: "docencia", entityType: "student_punctuality_trend", entityId: student.id, signalName: "puntualidad",
            measurement: normalizedOffset, processNoiseQ: PUNCTUALITY_Q, measurementNoiseR: PUNCTUALITY_R,
          })
          punctualityState = punctResult.state
          punctualityOutlier = punctResult.isOutlier
          punctualityCount++

          const vectorResult = await applyKalmanVector(serviceClient, {
            domain: "docencia", entityType: "student_attendance_punctuality_pair", entityId: student.id, pairName: "asistencia_puntualidad",
            measurement: [Number(row.status), normalizedOffset],
            processNoiseQ: [ATTENDANCE_Q, PUNCTUALITY_Q],
            measurementNoiseR: [ATTENDANCE_R, PUNCTUALITY_R],
          })
          learnedCorrelation = vectorResult.correlacionAprendida
        }
      }
      if (attendanceCount < MIN_OBSERVATIONS) {
        confianza_insuficiente.push("asistencia")
      } else if (attendanceState && attendanceState.x < ATTENDANCE_RISK_THRESHOLD) {
        motivo_riesgo.push("asistencia baja/decreciente")
      }
      if (punctualityCount < MIN_OBSERVATIONS) {
        confianza_insuficiente.push("puntualidad")
      }

      // Calificaciones por actividad
      let gradeState: { x: number; p: number } | null = null
      let gradeOutlier = false
      let gradeCount = 0
      const gradeSeries: number[] = []
      for (const row of (gradeRows ?? []).filter((r) => r.student_id === student.id)) {
        if (row.score === null) continue
        const result = await applyKalman(serviceClient, {
          domain: "docencia", entityType: "student_grade_trend", entityId: student.id, signalName: "promedio_actividades",
          measurement: row.score, processNoiseQ: GRADE_Q, measurementNoiseR: GRADE_R,
        })
        gradeState = result.state
        gradeOutlier = result.isOutlier
        gradeCount++
        gradeSeries.push(row.score)
      }
      if (gradeCount < MIN_OBSERVATIONS) {
        confianza_insuficiente.push("promedio_actividades")
      } else if (gradeState && gradeState.x < GRADE_RISK_THRESHOLD) {
        motivo_riesgo.push("calificaciones por debajo del umbral")
      }

      // Exámenes
      let examState: { x: number; p: number } | null = null
      let examOutlier = false
      let examCount = 0
      for (const row of (examRows ?? []).filter((r) => r.student_id === student.id)) {
        const score = row.final_score ?? row.score
        if (score === null) continue
        const result = await applyKalman(serviceClient, {
          domain: "docencia", entityType: "student_exam_trend", entityId: student.id, signalName: "promedio_examenes",
          measurement: score, processNoiseQ: EXAM_Q, measurementNoiseR: EXAM_R,
        })
        examState = result.state
        examOutlier = result.isOutlier
        examCount++
      }
      if (examCount < MIN_OBSERVATIONS) {
        confianza_insuficiente.push("promedio_examenes")
      } else if (examState && examState.x < GRADE_RISK_THRESHOLD) {
        motivo_riesgo.push("desempeño en exámenes por debajo del umbral")
      }

      // Esfuerzo — señal privada por alumno (visible solo al docente),
      // complementaria del agregado de grupo de compute-activity-work-patterns.
      let effortState: { x: number; p: number } | null = null
      let effortCount = 0
      for (const row of (submissionRows ?? []).filter((r) => r.student_id === student.id)) {
        const versions = Math.min(row.version_number ?? 1, EFFORT_VERSION_CAP)
        const result = await applyKalman(serviceClient, {
          domain: "docencia", entityType: "student_effort_trend", entityId: student.id, signalName: "esfuerzo",
          measurement: versions, processNoiseQ: EFFORT_Q, measurementNoiseR: EFFORT_R,
        })
        effortState = result.state
        effortCount++
      }
      if (effortCount < MIN_OBSERVATIONS) confianza_insuficiente.push("esfuerzo")

      // Correlación asistencia↔calificaciones (aritmética directa, ver
      // pearsonCorrelation arriba) — distingue "ausente → bajo desempeño"
      // (correlación alta) de "presente pero con dificultades" (correlación
      // baja/nula pese a nota baja): intervenciones docentes distintas.
      const correlacion = pearsonCorrelation(attendanceSeries, gradeSeries)
      if (correlacion !== null && gradeState && gradeState.x < GRADE_RISK_THRESHOLD && Math.abs(correlacion) < 0.15) {
        motivo_riesgo.push("bajo desempeño no explicado por inasistencia (revisar dificultad de contenido, no solo asistencia)")
      }

      results.push({
        student_id: student.id, nombre,
        asistencia_suavizada: attendanceState?.x ?? null, asistencia_outlier: attendanceOutlier,
        asistencia_n_observaciones: attendanceCount,
        puntualidad_suavizada: punctualityState?.x ?? null, puntualidad_outlier: punctualityOutlier,
        puntualidad_n_observaciones: punctualityCount,
        promedio_actividades_suavizado: gradeState?.x ?? null, promedio_actividades_outlier: gradeOutlier,
        promedio_actividades_n_observaciones: gradeCount,
        promedio_examenes_suavizado: examState?.x ?? null, promedio_examenes_outlier: examOutlier,
        promedio_examenes_n_observaciones: examCount,
        esfuerzo_suavizado: effortState?.x ?? null,
        esfuerzo_n_observaciones: effortCount,
        correlacion_asistencia_calificaciones: correlacion,
        correlacion_asistencia_puntualidad_aprendida: punctualityCount >= MIN_OBSERVATIONS ? learnedCorrelation : null,
        en_riesgo: motivo_riesgo.length > 0, motivo_riesgo,
        confianza_insuficiente,
      })
    }

    return new Response(
      JSON.stringify({ success: true, data: { students: results } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[COMPUTE_STUDENT_RISK_SIGNALS]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
