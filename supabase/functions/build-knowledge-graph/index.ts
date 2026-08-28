// deno-lint-ignore-file no-import-prefix
/**
 * build-knowledge-graph
 * Extrae conceptos y relaciones de un texto (vía Gemini) y los agrega a UNO
 * de los DOS grafos de conocimiento separados que tiene la plataforma:
 *
 *   - domain "docencia":       escopado por course_id (una materia).
 *   - domain "investigacion":  escopado por el usuario autenticado — cubre
 *     Investigación + Campo + Laboratorio juntos, porque esas tres áreas no
 *     se referencian entre sí por FK pero sí comparten quién las creó.
 *
 * Deliberadamente NO descarga archivos por su cuenta: recibe el texto ya
 * extraído. Así se reusa desde cualquier fuente real (course_materials vía
 * intelligent-file-parser/process-hybrid-material que YA existen, notas de
 * campo, abstracts de literatura, etc.) en vez de duplicar lógica de
 * extracción de PDF/Office aquí.
 *
 * Requiere haber corrido supabase/pendiente/002_graphrag_schema.sql primero.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { embedText, toVectorLiteral } from "../_shared/embeddings.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

const MAX_TEXT_CHARS = 40_000 // margen de contexto de Gemini para un solo documento

const DOMAINS = ["docencia", "investigacion"] as const
type Domain = typeof DOMAINS[number]

const SOURCE_TYPES_BY_DOMAIN: Record<Domain, string[]> = {
  docencia: ["course_material", "materiales_boveda", "exam", "activity"],
  investigacion: ["literatura_referencia", "proyecto_investigacion", "mision_campo", "captura_campo", "equipo_lab", "telemetria_iot"],
}

interface ExtractedConcept {
  label: string
  description: string
  relaciona_con: string[] // labels de otros conceptos EN ESTA MISMA extracción
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
  const timeout = setTimeout(() => controller.abort(), 45_000)

  try {
    const { domain, course_id, source_type, source_id, text, titulo } = await req.json()
    if (!DOMAINS.includes(domain)) return new Response(
      JSON.stringify({ success: false, error: "'domain' debe ser 'docencia' o 'investigacion'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )
    if (!text || typeof text !== "string" || !text.trim()) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'text'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )
    const validSourceTypes = SOURCE_TYPES_BY_DOMAIN[domain as Domain]
    const sourceType = validSourceTypes.includes(source_type) ? source_type : validSourceTypes[0]

    // ── Ownership: docencia se valida contra el curso; investigación es
    //    siempre el grafo del propio usuario autenticado (no hay un
    //    "scope_id" externo que validar — no existe un solo dueño de
    //    Investigación+Campo+Laboratorio salvo la persona misma). ──────────
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
    const scopeColumns = domain === "docencia" ? { course_id } : { usuario_id: userId }

    const truncated = text.slice(0, MAX_TEXT_CHARS)

    // ── 1. Extracción de conceptos + relaciones vía Gemini ──────────────────
    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{
          parts: [{ text:
            `Eres un extractor de grafos de conocimiento para material ${domain === "docencia" ? "educativo universitario" : "de investigación académica"}.
            ${titulo ? `DOCUMENTO: "${titulo}"` : ""}

            TEXTO:
            ${truncated}

            Extrae los conceptos técnicos/académicos clave (8-20, ni una lista trivial de palabras sueltas
            ni un resumen del documento entero) y sus relaciones ENTRE SÍ (no con el mundo exterior).

            JSON puro sin markdown:
            {"conceptos":[{"label":"Nombre corto del concepto","description":"1-2 frases explicándolo en el
            contexto de este documento","relaciona_con":["Label de otro concepto de esta misma lista"]}]}

            - label: corto (2-6 palabras), consistente si el mismo concepto aparece varias veces en el texto.
            - relaciona_con: solo labels que también existan en tu propia lista "conceptos" de esta respuesta
              (no inventes relaciones con conceptos que no extrajiste). Puede ser [] si no hay relación clara.`
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

    const parsed: { conceptos: ExtractedConcept[] } = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(parsed), {
      serviceClient, teacherId: userId, toolName: "build_knowledge_graph", cors,
      errorBody: { success: false, error: "La extracción no pudo procesarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    const conceptos = (parsed.conceptos ?? []).slice(0, 30) // tope duro por costo de embeddings

    if (conceptos.length === 0) return new Response(
      JSON.stringify({ success: true, data: { nodes_created: 0, edges_created: 0 } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── 2. Embeddings (en paralelo, tope de concurrencia) + un solo insert
    //      batcheado — el modelo de embeddings no tiene endpoint batch, así
    //      que la llamada HTTP sigue siendo una por concepto, pero en vuelo
    //      simultáneo en vez de una tras otra: con 30 conceptos, secuencial
    //      podía acercarse o pasar el timeout de 45s; con 5 en paralelo el
    //      tiempo total es ~1/5, y un solo insert batcheado evita además 30
    //      round-trips a Postgres por 1. ────────────────────────────────────
    const EMBEDDING_CONCURRENCY = 5
    const vectors: (number[] | null)[] = new Array(conceptos.length).fill(null)
    let nextIndex = 0
    const embedWorker = async () => {
      while (nextIndex < conceptos.length) {
        const i = nextIndex++
        const c = conceptos[i]
        try {
          vectors[i] = await embedText(`${c.label}: ${c.description}`, GEMINI_KEY!, controller.signal)
        } catch (err) {
          console.error(`[BUILD_KNOWLEDGE_GRAPH] embed "${c.label}":`, err instanceof Error ? err.message : err)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(EMBEDDING_CONCURRENCY, conceptos.length) }, embedWorker))

    const rowsToInsert = conceptos
      .map((c, i) => vectors[i] ? {
        ...scopeColumns, source_type: sourceType, source_id: source_id ?? null,
        label: c.label, description: c.description,
        embedding: toVectorLiteral(vectors[i]!),
      } : null)
      .filter((row): row is NonNullable<typeof row> => row !== null)

    const labelToId = new Map<string, string>()
    if (rowsToInsert.length > 0) {
      const { data: insertedNodes, error } = await serviceClient.from(nodesTable).insert(rowsToInsert).select("id, label")
      if (error) console.error("[BUILD_KNOWLEDGE_GRAPH] insert nodes:", error.message)
      for (const n of insertedNodes ?? []) labelToId.set(n.label, n.id)
    }

    // ── 3. Aristas (solo entre conceptos que sí se insertaron) ──────────────
    const edgesToInsert: { source_node_id: string; target_node_id: string; relation: string }[] = []
    for (const c of conceptos) {
      const sourceId = labelToId.get(c.label)
      if (!sourceId) continue
      for (const targetLabel of c.relaciona_con ?? []) {
        const targetId = labelToId.get(targetLabel)
        if (targetId && targetId !== sourceId) {
          edgesToInsert.push({ source_node_id: sourceId, target_node_id: targetId, relation: "relacionado_con" })
        }
      }
    }

    if (edgesToInsert.length > 0) {
      const { error: edgeErr } = await serviceClient.from(edgesTable).insert(edgesToInsert)
      if (edgeErr) console.error("[BUILD_KNOWLEDGE_GRAPH] insert edges:", edgeErr.message)
    }

    return new Response(
      JSON.stringify({ success: true, data: { nodes_created: labelToId.size, edges_created: edgesToInsert.length } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (45s) construyendo el grafo de conocimiento." : err instanceof Error ? err.message : "Error interno."
    console.error("[BUILD_KNOWLEDGE_GRAPH]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
