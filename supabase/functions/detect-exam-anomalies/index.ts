// deno-lint-ignore-file no-import-prefix
/**
 * detect-exam-anomalies
 *
 * Segunda señal de integridad para un examen, complementaria (NUNCA
 * reemplazo) del bloqueo automático de 3 incidencias que ya existe en
 * useExamSession.ts. Corre Isolation Forest (_shared/isolationForest.ts)
 * sobre features derivadas de cada entrega (`evaluation_responses.metadata`)
 * para detectar patrones anómalos más sutiles que un simple conteo de
 * incidencias no captura — ver conversación de "estado del arte de
 * integridad académica".
 *
 * NUNCA bloquea ni cambia el estado de ninguna entrega: solo devuelve un
 * score para que el docente decida qué revisar con más atención. Bajo
 * demanda (el docente lo dispara desde los resultados del examen), no un
 * trigger automático.
 *
 * Requiere `answer_timing` en metadata (agregado hoy en useExamSession.ts)
 * — entregas ANTERIORES a ese cambio no lo tienen y se excluyen del
 * análisis (nunca se fabrica ese dato), reportadas aparte.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
import { isolationForest, MIN_SUBMISSIONS_FOR_FOREST } from "../_shared/isolationForest.ts"

interface AntiCheatMetadata {
  total_violations?: number
  duration_minutes?: number | null
}
interface ResponseMetadata {
  anti_cheat?: AntiCheatMetadata
  answer_timing?: Record<string, string[]>
}

interface SubmissionFeatures {
  student_id: string
  violations_per_minute: number
  duration_ratio: number
  mean_gap_seconds: number
  revision_count: number
}

/** Extrae las 4 features de una entrega, o null si le falta `answer_timing` (entregas previas a hoy) — nunca se fabrica ese dato. */
function extractFeatures(
  studentId: string, metadata: ResponseMetadata | null, expectedDurationMinutes: number,
): SubmissionFeatures | null {
  const timing = metadata?.answer_timing
  if (!timing || Object.keys(timing).length === 0) return null

  const allTimestamps = Object.values(timing).flat().sort()
  if (allTimestamps.length < 2) return null // no hay ni un solo intervalo que medir

  const gapsSeconds: number[] = []
  for (let i = 1; i < allTimestamps.length; i++) {
    gapsSeconds.push((new Date(allTimestamps[i]).getTime() - new Date(allTimestamps[i - 1]).getTime()) / 1000)
  }
  const meanGap = gapsSeconds.reduce((s, g) => s + g, 0) / gapsSeconds.length

  const revisionCount = Object.values(timing).reduce((sum, arr) => sum + Math.max(arr.length - 1, 0), 0)

  const violations = metadata?.anti_cheat?.total_violations ?? 0
  const durationMinutes = metadata?.anti_cheat?.duration_minutes ?? expectedDurationMinutes

  return {
    student_id: studentId,
    violations_per_minute: violations / Math.max(durationMinutes, 1),
    duration_ratio: durationMinutes / Math.max(expectedDurationMinutes, 1),
    mean_gap_seconds: meanGap,
    revision_count: revisionCount,
  }
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  let body: { exam_id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ success: false, error: "JSON inválido." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
  const { exam_id } = body
  if (!exam_id) {
    return new Response(JSON.stringify({ success: false, error: "Se requiere 'exam_id'." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  try {
    const { data: exam } = await serviceClient
      .from("exams").select("id, course_id, duration_minutes").eq("id", exam_id).single()
    if (!exam) {
      return new Response(JSON.stringify({ success: false, error: "Examen no encontrado." }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      })
    }
    const owns = await verifyCourseOwnership(serviceClient, exam.course_id, userId)
    if (!owns) {
      return new Response(JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const { data: responses } = await serviceClient
      .from("evaluation_responses")
      .select("student_id, metadata")
      .eq("exam_id", exam_id)
      .in("status", ["submitted", "completed", "ai_draft"])

    const rows = responses ?? []
    const eligible: SubmissionFeatures[] = []
    const excluded: string[] = []
    for (const row of rows) {
      const features = extractFeatures(row.student_id, row.metadata as ResponseMetadata | null, exam.duration_minutes ?? 60)
      if (features) eligible.push(features)
      else excluded.push(row.student_id)
    }

    if (eligible.length < MIN_SUBMISSIONS_FOR_FOREST) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ran: false,
            reason: `Se necesitan al menos ${MIN_SUBMISSIONS_FOR_FOREST} entregas con datos de timing completos (hay ${eligible.length}). Las entregas de antes de hoy no tienen esta información — vuelve a intentar cuando se acumulen más entregas nuevas.`,
            excluded_no_timing_data: excluded,
          },
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      )
    }

    const points = eligible.map((f) => [f.violations_per_minute, f.duration_ratio, f.mean_gap_seconds, f.revision_count])
    const { scores, suspicious } = isolationForest(points)

    const results = eligible.map((f, i) => ({
      student_id: f.student_id,
      score: scores[i],
      suspicious: suspicious[i],
      features: {
        violations_per_minute: f.violations_per_minute,
        duration_ratio: f.duration_ratio,
        mean_gap_seconds: f.mean_gap_seconds,
        revision_count: f.revision_count,
      },
    })).sort((a, b) => b.score - a.score)

    return new Response(
      JSON.stringify({ success: true, data: { ran: true, results, excluded_no_timing_data: excluded } }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[DETECT_EXAM_ANOMALIES]", msg)
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
