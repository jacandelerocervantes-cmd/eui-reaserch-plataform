// deno-lint-ignore-file no-import-prefix
/**
 * graphrag-query
 * Recuperación aumentada por grafo, sobre UNO de los dos grafos separados
 * (docencia por course_id / investigación+campo+laboratorio por usuario_id
 * — ver build-knowledge-graph para la justificación de esa separación).
 *
 * Embebe la pregunta, busca los nodos más cercanos por similitud coseno
 * (match_knowledge_nodes_<domain>, pgvector) y expande 1 salto por las
 * aristas del mismo grafo — no solo el nodo más parecido, también lo
 * conectado a él. Ese contexto se pasa a Gemini para responder ANCLADO al
 * material real, sin inventar cuando el contexto no alcanza.
 *
 * Requiere supabase/pendiente/002_graphrag_schema.sql aplicado.
 *
 * PRESUPUESTO DE LATENCIA (por qué cada paso es secuencial y no se puede
 * paralelizar más de lo que ya está): embed pregunta (~200-500ms) -> match
 * RPC pgvector (~50-150ms, usa el índice ivfflat) -> query de aristas 1
 * salto (~50-100ms, solo corre si hubo match) -> query de nodos vecinos
 * (~50-100ms, solo si hay vecinos) -> generación Gemini (~1-3s, normalmente
 * el paso más lento). Cada paso depende del resultado del anterior — no es
 * que falte paralelizar, es una cadena de dependencias real. Total esperado
 * ~1.5-4s. Si algún día esto se siente lento, el sospechoso más probable es
 * la generación final (el LLM redactando la respuesta), no la recuperación.
 *
 * Nota sobre el índice ivfflat (002_graphrag_schema.sql): pgvector requiere
 * correr `ANALYZE knowledge_nodes_docencia;` (y el equivalente para
 * _investigacion) después de la primera carga masiva de nodos para que el
 * planner empiece a usarlo — con pocas filas Postgres prefiere secuencial
 * de todos modos, así que no es urgente al principio, pero conviene
 * correrlo una vez que haya cientos/miles de nodos reales.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { embedText, toVectorLiteral } from "../_shared/embeddings.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

const TOP_K_NODES = 6
const DOMAINS = ["docencia", "investigacion"] as const

interface MatchedNode {
  id: string; label: string; description: string | null
  source_type: string; source_id: string | null; similarity: number
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    const { domain, course_id, query } = await req.json()
    if (!DOMAINS.includes(domain)) return new Response(
      JSON.stringify({ success: false, error: "'domain' debe ser 'docencia' o 'investigacion'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )
    if (!query || typeof query !== "string" || !query.trim()) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'query'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    if (domain === "docencia") {
      if (!course_id) return new Response(
        JSON.stringify({ success: false, error: "Se requiere 'course_id' para domain='docencia'." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
      const owns = await verifyCourseOwnership(serviceClient, course_id, userId)
      if (!owns) return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const nodesTable = domain === "docencia" ? "knowledge_nodes_docencia" : "knowledge_nodes_investigacion"
    const edgesTable = domain === "docencia" ? "knowledge_edges_docencia" : "knowledge_edges_investigacion"
    const matchFn = domain === "docencia" ? "match_knowledge_nodes_docencia" : "match_knowledge_nodes_investigacion"
    const matchParams = domain === "docencia"
      ? { match_course_id: course_id }
      : { match_usuario_id: userId }

    // ── 1. Embeber la pregunta y buscar nodos semánticamente cercanos ───────
    const queryVector = await embedText(query, GEMINI_KEY, controller.signal)
    const { data: topNodes, error: matchErr } = await serviceClient.rpc(matchFn, {
      query_embedding: toVectorLiteral(queryVector),
      ...matchParams,
      match_count: TOP_K_NODES,
    })
    if (matchErr) throw new Error(matchErr.message)

    const matched = (topNodes ?? []) as MatchedNode[]
    if (matched.length === 0) return new Response(
      JSON.stringify({ success: false, error: `El grafo de ${domain} todavía no tiene contenido (usa build-knowledge-graph primero).` }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── 2. Expandir 1 salto desde esos nodos vía knowledge_edges ────────────
    const topIds = matched.map((n) => n.id)
    const { data: edgeRows } = await serviceClient
      .from(edgesTable)
      .select("source_node_id, target_node_id, relation")
      .or(`source_node_id.in.(${topIds.join(",")}),target_node_id.in.(${topIds.join(",")})`)

    const neighborIds = new Set<string>()
    for (const e of edgeRows ?? []) {
      if (topIds.includes(e.source_node_id)) neighborIds.add(e.target_node_id)
      if (topIds.includes(e.target_node_id)) neighborIds.add(e.source_node_id)
    }
    topIds.forEach((id) => neighborIds.delete(id))

    let neighborNodes: MatchedNode[] = []
    if (neighborIds.size > 0) {
      const { data } = await serviceClient
        .from(nodesTable)
        .select("id, label, description, source_type, source_id")
        .in("id", [...neighborIds])
      neighborNodes = (data ?? []).map((n) => ({ ...n, similarity: 0 }))
    }

    const context = [...matched, ...neighborNodes]
      .map((n) => `- ${n.label}${n.description ? `: ${n.description}` : ""}`)
      .join("\n")

    // ── 3. Respuesta anclada al contexto recuperado ──────────────────────────
    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{
          parts: [{ text:
            `Responde la pregunta ÚNICAMENTE con base en estos conceptos extraídos del material real
            (${domain === "docencia" ? "de la materia" : "de investigación/campo/laboratorio"} del usuario).
            Si el contexto no alcanza para responder, dilo explícitamente en vez de inventar — este es
            material anclado (GraphRAG), no conocimiento general.

            CONTEXTO:
            ${context}

            PREGUNTA: ${query}

            JSON puro sin markdown:
            {"answer":"...","suficiente_contexto":true}`
          }]
        }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
      },
      controller.signal,
    )

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson = await aiRes.json()
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error("Gemini devolvió respuesta vacía.")
    const parsed = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(parsed), {
      serviceClient, teacherId: userId, toolName: "graphrag_query", cors,
      errorBody: { success: false, error: "La respuesta no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          answer: parsed.answer,
          suficiente_contexto: parsed.suficiente_contexto ?? true,
          sources: matched.map((n) => ({ label: n.label, source_type: n.source_type, source_id: n.source_id, similarity: n.similarity })),
        },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (25s) consultando el grafo de conocimiento." : err instanceof Error ? err.message : "Error interno."
    console.error("[GRAPHRAG_QUERY]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
