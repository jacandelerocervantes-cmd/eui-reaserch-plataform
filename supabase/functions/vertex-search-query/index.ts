// deno-lint-ignore-file no-import-prefix
/**
 * vertex-search-query
 *
 * Lado "Vertex AI Search" del caso de estudio "GraphRAG casero vs. Vertex AI
 * Search" (crédito de prueba "GenAI App Builder"). Espejo funcional de
 * graphrag-query: recibe una pregunta + dominio ("docencia"|"investigacion")
 * y devuelve una respuesta anclada, pero usando el `:answer` endpoint de la
 * Discovery Engine API de Vertex AI Search en vez del pgvector casero.
 *
 * Requiere (secrets de Supabase, ver README del caso de estudio):
 *   GCP_SERVICE_ACCOUNT_KEY_JSON  — JSON completo de la cuenta de servicio.
 *   VERTEX_SEARCH_PROJECT_ID      — proyecto de GCP con el crédito activo.
 *   VERTEX_SEARCH_LOCATION        — normalmente "global".
 *   VERTEX_SEARCH_ENGINE_ID_DOCENCIA / VERTEX_SEARCH_ENGINE_ID_INVESTIGACION
 *     — ID del "Search app"/engine creado en la consola para cada dominio
 *       (uno por dominio, igual que los dos grafos separados de
 *       build-knowledge-graph/graphrag-query).
 *
 * Solo llama a verifyDocente (no verifyAlumnoSandbox ni verifyUser genérico)
 * porque esto es una herramienta de investigación/benchmark para el equipo
 * docente, no una feature de producto expuesta a alumnos.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { getGoogleAccessToken } from "../_shared/googleServiceAccount.ts"

type Domain = "docencia" | "investigacion"

function engineIdFor(domain: Domain): string | undefined {
  return domain === "docencia"
    ? Deno.env.get("VERTEX_SEARCH_ENGINE_ID_DOCENCIA")
    : Deno.env.get("VERTEX_SEARCH_ENGINE_ID_INVESTIGACION")
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)

  let body: { domain?: Domain; question?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const { domain, question } = body
  if (domain !== "docencia" && domain !== "investigacion") {
    return new Response(JSON.stringify({ error: "domain debe ser 'docencia' o 'investigacion'." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
  if (!question || !question.trim()) {
    return new Response(JSON.stringify({ error: "Falta 'question'." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const projectId = Deno.env.get("VERTEX_SEARCH_PROJECT_ID")
  const location = Deno.env.get("VERTEX_SEARCH_LOCATION") ?? "global"
  const engineId = engineIdFor(domain)

  if (!projectId || !engineId) {
    return new Response(
      JSON.stringify({ error: `Vertex AI Search no está configurado para el dominio "${domain}" (falta VERTEX_SEARCH_PROJECT_ID o el engine ID de ese dominio).` }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    )
  }

  const startedAt = Date.now()

  try {
    const accessToken = await getGoogleAccessToken()

    // Discovery Engine API — `:answer` (Answer API) devuelve respuesta
    // generada + citas a los documentos fuente, análogo a lo que
    // graphrag-query arma a mano con Gemini + contexto recuperado.
    const url = `https://discoveryengine.googleapis.com/v1/projects/${projectId}/locations/${location}/collections/default_collection/engines/${engineId}/servingConfigs/default_search:answer`

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { text: question },
        answerGenerationSpec: {
          ignoreAdversarialQuery: true,
          ignoreNonAnswerSeekingQuery: true,
          includeCitations: true,
        },
      }),
    })

    const latencyMs = Date.now() - startedAt

    if (!res.ok) {
      const errBody = await res.text().catch(() => "")
      throw new Error(`Vertex AI Search respondió ${res.status}: ${errBody}`)
    }

    const json = await res.json()
    const answerText: string = json?.answer?.answerText ?? ""
    const citations = json?.answer?.citations ?? []

    return new Response(
      JSON.stringify({ answer: answerText, citations, latencyMs }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[VERTEX_SEARCH_QUERY]", msg)
    return new Response(JSON.stringify({ error: msg, latencyMs: Date.now() - startedAt }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
