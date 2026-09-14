// deno-lint-ignore-file no-import-prefix
/**
 * search-literature
 * Busca literatura científica en OpenAlex (API pública, sin costo, sin key —
 * +250M publicaciones). No usa LLM. Invocada desde
 * app/(investigacion)/investigacion/radar/page.tsx.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"

interface OpenAlexAuthorship { author?: { display_name?: string } }
interface OpenAlexWork {
  id: string
  title: string | null
  authorships?: OpenAlexAuthorship[]
  publication_year: number | null
  cited_by_count: number
  primary_location?: { source?: { display_name?: string }; landing_page_url?: string; is_oa?: boolean }
  open_access?: { is_oa?: boolean }
  doi: string | null
  abstract_inverted_index?: Record<string, number[]>
}

// OpenAlex no da el abstract como texto plano, sino como índice invertido
// (palabra -> posiciones) para ahorrar espacio. Se reconstruye la oración.
function rebuildAbstract(index?: Record<string, number[]>): string | null {
  if (!index) return null
  const words: string[] = []
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words[pos] = word
  }
  const text = words.join(" ").trim()
  return text || null
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyUser(req)
  if (!auth.ok) return errorResponse(auth.err, cors)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const { query, filters } = await req.json()
    if (!query || typeof query !== "string" || !query.trim()) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'query'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const params = new URLSearchParams({
      search: query.trim(),
      per_page: "20",
      "select": "id,title,authorships,publication_year,cited_by_count,primary_location,open_access,doi,abstract_inverted_index",
    })

    const filterParts: string[] = []
    if (filters?.years) filterParts.push(`from_publication_date:${new Date().getFullYear() - Number(filters.years)}-01-01`)
    if (filters?.open_access) filterParts.push("open_access.is_oa:true")
    if (filterParts.length) params.set("filter", filterParts.join(","))

    const startedAt = Date.now()
    const oaRes = await fetch(`https://api.openalex.org/works?${params.toString()}`, {
      signal: controller.signal,
      headers: { "User-Agent": "eui-plataforma/1.0 (mailto:soporte@eui.local)" },
    })
    if (!oaRes.ok) throw new Error(`OpenAlex respondió ${oaRes.status}`)

    const json = await oaRes.json()
    const works: OpenAlexWork[] = json.results ?? []

    const papers = works.map((w) => ({
      id: w.id,
      title: w.title ?? "(sin título)",
      authors: (w.authorships ?? []).map((a) => a.author?.display_name).filter((n): n is string => !!n),
      year: w.publication_year,
      citations: w.cited_by_count ?? 0,
      venue: w.primary_location?.source?.display_name ?? null,
      doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, "") : null,
      url: w.primary_location?.landing_page_url ?? w.doi ?? null,
      is_oa: w.open_access?.is_oa ?? w.primary_location?.is_oa ?? false,
      abstract: rebuildAbstract(w.abstract_inverted_index),
    }))

    return new Response(
      JSON.stringify({
        success: true,
        data: { papers, total: json.meta?.count ?? papers.length, took_ms: Date.now() - startedAt },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (15s) buscando en OpenAlex." : err instanceof Error ? err.message : "Error interno."
    console.error("[SEARCH_LITERATURE]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
