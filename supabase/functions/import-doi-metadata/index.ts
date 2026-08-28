// deno-lint-ignore-file no-import-prefix
/**
 * import-doi-metadata
 * Resuelve metadatos de un DOI vía la API pública de CrossRef (sin costo, sin
 * key) y los guarda en literatura_referencias del usuario autenticado. No usa
 * LLM — es un lookup determinista, igual que el resto del ecosistema
 * "Investigación" que combina IA (analyze-literature-gaps, search-literature)
 * con integraciones deterministas cuando el problema no lo requiere.
 * Invocada desde literatura/page.tsx y radar/page.tsx (al guardar un paper).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"

interface CrossrefAuthor { given?: string; family?: string }
interface CrossrefMessage {
  title?: string[]
  author?: CrossrefAuthor[]
  published?: { "date-parts"?: number[][] }
  "container-title"?: string[]
  abstract?: string
  DOI?: string
  URL?: string
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyUser(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const { doi: rawDoi } = await req.json()
    if (!rawDoi) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'doi'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const doi = String(rawDoi).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")

    const crossrefRes = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      signal: controller.signal,
      headers: { "User-Agent": "eui-plataforma/1.0 (mailto:soporte@eui.local)" },
    })

    if (crossrefRes.status === 404) return new Response(
      JSON.stringify({ success: false, error: "DOI no encontrado en CrossRef." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )
    if (!crossrefRes.ok) throw new Error(`CrossRef respondió ${crossrefRes.status}`)

    const { message }: { message: CrossrefMessage } = await crossrefRes.json()

    const titulo = message.title?.[0] ?? "(sin título)"
    // Array (post-migración autores text[]); requiere la misma migración pendiente.
    const autores = (message.author ?? [])
      .map((a) => [a.given, a.family].filter(Boolean).join(" ").trim())
      .filter(Boolean)
    const año = message.published?.["date-parts"]?.[0]?.[0] ?? null
    const journal = message["container-title"]?.[0] ?? null
    // CrossRef a veces trae el abstract con marcado JATS (<jats:p>...</jats:p>) — se limpia a texto plano.
    const abstract = message.abstract ? message.abstract.replace(/<[^>]+>/g, "").trim() : null
    const url = message.URL ?? `https://doi.org/${doi}`

    // NOTA: usa "url" (nombre post-migración). Requiere haber corrido
    // supabase/pendiente/001_fix_literatura_referencias_columns.sql primero
    // (renombra url_pdf -> url) — si aún no la corres, cambia "url" por
    // "url_pdf" aquí antes de desplegar esta función.
    const { data: inserted, error: insertErr } = await serviceClient
      .from("literatura_referencias")
      .insert({ usuario_id: userId, titulo, autores, año, journal, abstract, doi, url })
      .select()
      .single()

    if (insertErr) throw new Error(insertErr.message)

    return new Response(
      JSON.stringify({ success: true, data: inserted }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (15s) consultando CrossRef." : err instanceof Error ? err.message : "Error interno."
    console.error("[IMPORT_DOI_METADATA]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
