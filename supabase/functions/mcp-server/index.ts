// deno-lint-ignore-file no-import-prefix
/**
 * Servidor MCP (Model Context Protocol) mínimo para EUI, sobre JSON-RPC 2.0
 * vía HTTP — el mismo transporte "streamable HTTP" que usa Claude Desktop/
 * Code y otros clientes MCP modernos, sin dependencia de un SDK externo (el
 * repo no trae ninguno: se implementa el subconjunto de MCP que se necesita
 * con `serve` puro, igual que el resto de las Edge Functions).
 *
 * Alcance deliberadamente angosto: 4 tools, todas de solo lectura, todas
 * limitadas al docente autenticado (verifyDocente + teacher_id/admin), y la
 * agregación de grupo respeta el mismo umbral de anonimato de 5 participantes
 * que el contrato `agregado@1.0` (traspaso/CONTRATOS-COMPARTIDOS.md §3). Ver
 * docs/04_Multi_Agente_MCP.md para la justificación completa de qué NO se
 * expone y por qué.
 *
 * `get_students_at_risk` (04-RECOMENDACIONES-IA-DOCENTE.md punto 14) es la
 * ÚNICA tool de las 4 que devuelve datos POR ALUMNO en vez de agregados de
 * grupo — a propósito, no es una inconsistencia: el umbral de anonimato
 * k>=5 de `get_group_aggregate` protege contra exponer datos de un alumno
 * individual a alguien que NO es su propio docente (ej. otro docente
 * consultando un grupo ajeno). Aquí el docente está preguntando por SUS
 * PROPIOS alumnos de SU PROPIO curso (mismo `verifyCourseOwnership` que ya
 * usan `get_course_units`) — no hay tercero de por medio a quien proteger,
 * así que el gate de anonimato no aplica ni tendría sentido (impediría al
 * docente ver el riesgo de sus propios alumnos, que es justo el propósito).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente, verifyCourseOwnership } from "../_shared/auth.ts"

const MCP_VERSION = "2025-06-18"

interface JsonRpcRequest {
  jsonrpc: "2.0"
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id, result }
}

function rpcError(id: JsonRpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

const TOOLS = [
  {
    name: "list_courses",
    description: "Lista los cursos del docente autenticado.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_course_units",
    description: "Unidades/temario de un curso propio.",
    inputSchema: {
      type: "object",
      properties: { course_id: { type: "string" } },
      required: ["course_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_group_aggregate",
    description: "Media, desviación y subtemas débiles de un examen, agregados por grupo. Se niega con menos de 5 respuestas.",
    inputSchema: {
      type: "object",
      properties: { exam_id: { type: "string" } },
      required: ["exam_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_students_at_risk",
    description: "Alumnos en riesgo académico de un curso propio (tendencias Kalman de asistencia/calificaciones/exámenes ya calculadas por compute-student-risk-signals). Por-alumno, no agregado — ver docstring del archivo sobre por qué esta tool no usa el umbral de anonimato.",
    inputSchema: {
      type: "object",
      properties: { course_id: { type: "string" } },
      required: ["course_id"],
      additionalProperties: false,
    },
  },
] as const

const ANONYMITY_THRESHOLD = 5 // igual que agregado@1.0 — ver manifest.json

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // Todo el protocolo va detrás del mismo JWT check que el resto del
  // producto — un cliente MCP no es una excepción de confianza.
  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { serviceClient, userId } = auth.ctx

  let body: JsonRpcRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, "JSON inválido.")), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const { id, method, params } = body
  const reply = (payload: unknown) =>
    new Response(JSON.stringify(payload), { headers: { ...cors, "Content-Type": "application/json" } })

  switch (method) {
    case "initialize":
      return reply(rpcResult(id, {
        protocolVersion: MCP_VERSION,
        serverInfo: { name: "eui-tecnm-tizimin", version: "1.0.0" },
        capabilities: { tools: {} },
      }))

    case "tools/list":
      return reply(rpcResult(id, { tools: TOOLS }))

    case "tools/call": {
      const toolName = params?.name as string | undefined
      const args = (params?.arguments ?? {}) as Record<string, unknown>

      try {
        switch (toolName) {
          case "list_courses": {
            const { data, error } = await serviceClient
              .from("courses")
              .select("id, name, period")
              .eq("teacher_id", userId)
            if (error) throw error
            return reply(rpcResult(id, { content: [{ type: "text", text: JSON.stringify(data ?? []) }] }))
          }

          case "get_course_units": {
            const courseId = args.course_id as string
            if (!courseId) return reply(rpcError(id, -32602, "Falta 'course_id'."))
            const owns = await verifyCourseOwnership(serviceClient, courseId, userId)
            if (!owns) return reply(rpcError(id, -32001, "No tienes acceso a ese curso."))

            const { data, error } = await serviceClient
              .from("course_units")
              .select("id, name, order_index")
              .eq("course_id", courseId)
            if (error) throw error
            return reply(rpcResult(id, { content: [{ type: "text", text: JSON.stringify(data ?? []) }] }))
          }

          case "get_group_aggregate": {
            const examId = args.exam_id as string
            if (!examId) return reply(rpcError(id, -32602, "Falta 'exam_id'."))

            // Ownership indirecto: el examen debe pertenecer a un curso del docente.
            const { data: exam } = await serviceClient
              .from("exams").select("id, title, course_id").eq("id", examId).single()
            if (!exam) return reply(rpcError(id, -32001, "Examen no encontrado."))
            const owns = await verifyCourseOwnership(serviceClient, exam.course_id, userId)
            if (!owns) return reply(rpcError(id, -32001, "No tienes acceso a ese examen."))

            const { data: responses } = await serviceClient
              .from("evaluation_responses")
              .select("score_ia, final_score")
              .eq("exam_id", examId)

            const n = responses?.length ?? 0
            if (n < ANONYMITY_THRESHOLD) {
              return reply(rpcResult(id, {
                content: [{
                  type: "text",
                  text: `Grupo con ${n} respuesta(s) — por debajo del umbral de anonimato (${ANONYMITY_THRESHOLD}). No se emite agregado.`,
                }],
              }))
            }

            const scores = responses!.map((r) => r.final_score ?? r.score_ia ?? 0)
            const media = scores.reduce((a, b) => a + b, 0) / scores.length
            const varianza = scores.reduce((a, b) => a + (b - media) ** 2, 0) / scores.length

            return reply(rpcResult(id, {
              content: [{
                type: "text",
                text: JSON.stringify({
                  examen: exam.title,
                  n_participantes: n,
                  media: Number(media.toFixed(2)),
                  desviacion: Number(Math.sqrt(varianza).toFixed(2)),
                }),
              }],
            }))
          }

          case "get_students_at_risk": {
            const courseId = args.course_id as string
            if (!courseId) return reply(rpcError(id, -32602, "Falta 'course_id'."))
            const owns = await verifyCourseOwnership(serviceClient, courseId, userId)
            if (!owns) return reply(rpcError(id, -32001, "No tienes acceso a esa materia."))

            // Reusa compute-student-risk-signals (mismo servidor, mismo
            // request docente reenviado) en vez de duplicar la lógica de
            // Kalman aquí — una sola fuente de verdad para el cálculo.
            const baseUrl = Deno.env.get("SUPABASE_URL")
            if (!baseUrl) return reply(rpcError(id, -32000, "SUPABASE_URL no configurado."))
            const authHeader = req.headers.get("Authorization")
            const riskRes = await fetch(`${baseUrl}/functions/v1/compute-student-risk-signals`, {
              method: "POST",
              headers: { Authorization: authHeader ?? "", "Content-Type": "application/json" },
              body: JSON.stringify({ course_id: courseId }),
            })
            if (!riskRes.ok) return reply(rpcError(id, -32000, `compute-student-risk-signals respondió ${riskRes.status}.`))
            const riskJson = await riskRes.json()
            const allStudents = (riskJson?.data?.students ?? []) as { en_riesgo: boolean }[]
            const atRisk = allStudents.filter((s) => s.en_riesgo)

            return reply(rpcResult(id, { content: [{ type: "text", text: JSON.stringify({ n_en_riesgo: atRisk.length, n_total: allStudents.length, alumnos: atRisk }) }] }))
          }

          default:
            return reply(rpcError(id, -32601, `Tool desconocida: ${toolName}`))
        }
      } catch (err) {
        console.error("[MCP_SERVER]", err)
        return reply(rpcError(id, -32000, err instanceof Error ? err.message : "Error interno."))
      }
    }

    default:
      return reply(rpcError(id, -32601, `Método no soportado: ${method}`))
  }
})
