// deno-lint-ignore-file no-import-prefix
/**
 * cluster-student-risk
 *
 * Segunda etapa del pipeline de riesgo académico: toma la salida YA
 * CALCULADA de compute-student-risk-signals (las 5 señales suavizadas por
 * Kalman por alumno) y las agrupa con K-Means (_shared/kmeans.ts) en
 * perfiles de riesgo etiquetados, en vez de un solo umbral binario.
 *
 * A propósito NO vuelve a consultar la base de datos ni recalcula Kalman —
 * el frontend ya tiene el array de compute-student-risk-signals de la
 * llamada anterior, se lo reenvía tal cual a esta función. Esto evita
 * duplicar las ~6 consultas (asistencia, calificaciones, exámenes,
 * entregas) que ya pagó la primera llamada.
 *
 * Solo `verifyDocente` (sin verifyCourseOwnership): no se toca ninguna fila
 * de un curso específico aquí, solo se hace aritmética sobre números que el
 * propio caller ya tenía permiso de ver.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { clusterStudentRisk, SIGNAL_NAMES, type SignalVector } from "../_shared/kmeans.ts"

// Forma exacta que ya devuelve compute-student-risk-signals — se acepta tal
// cual para que el frontend no tenga que remapear nada entre una llamada y
// la otra.
interface StudentRiskInput {
  student_id: string
  asistencia_suavizada: number | null
  puntualidad_suavizada: number | null
  promedio_actividades_suavizado: number | null
  promedio_examenes_suavizado: number | null
  esfuerzo_suavizado: number | null
}

function toSignalVector(s: StudentRiskInput): SignalVector {
  return {
    asistencia: s.asistencia_suavizada,
    puntualidad: s.puntualidad_suavizada,
    promedio_actividades: s.promedio_actividades_suavizado,
    promedio_examenes: s.promedio_examenes_suavizado,
    esfuerzo: s.esfuerzo_suavizado,
  }
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)

  let body: { students?: StudentRiskInput[]; k?: number }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ success: false, error: "JSON inválido." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const { students, k } = body
  if (!Array.isArray(students)) {
    return new Response(JSON.stringify({ success: false, error: "Se requiere 'students' (array)." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
  if (k !== undefined && (!Number.isInteger(k) || k < 2 || k > 8)) {
    return new Response(JSON.stringify({ success: false, error: "'k' debe ser un entero entre 2 y 8." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  try {
    const input = students.map((s) => ({ student_id: s.student_id, signals: toSignalVector(s) }))
    const result = clusterStudentRisk(input, { k })

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          k_usado: result.k,
          clustered: result.clustered,
          excluded: result.excluded,
          centroids: result.centroids_original_scale,
          signal_order: SIGNAL_NAMES,
        },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[CLUSTER_STUDENT_RISK]", msg)
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
