// deno-lint-ignore-file no-import-prefix
/**
 * analyze-literature-gaps
 * Analiza la biblioteca de referencias del investigador (tabla
 * literatura_referencias) y detecta vacíos teóricos, tendencias emergentes y
 * autores clave no citados vía Gemini. Invocada desde
 * app/(investigacion)/investigacion/literatura/page.tsx ("Análisis de Brechas con IA").
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

const MIN_REFS = 3

interface GapAnalysis {
  vacios: string[]
  tendencias_emergentes: string[]
  autores_clave_no_citados: string[]
  decadas_sin_cobertura: number[]
  sugerencias_busqueda: string[]
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyUser(req)
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
    // Solo la biblioteca del usuario que pide el análisis (RLS-equivalente
    // explícito: la tabla no filtra por usuario_id a nivel de policy en este
    // checkout, así que lo forzamos aquí).
    // select("*") en vez de listar columnas: el query builder de supabase-js
    // no puede parsear "año" (ñ) como identificador en su tipo generado.
    const { data: refsRaw, error: refsErr } = await serviceClient
      .from("literatura_referencias")
      .select("*")
      .eq("usuario_id", userId)

    if (refsErr) throw new Error(refsErr.message)

    type RefRow = { titulo: string; autores: string | null; año: number | null; journal: string | null; abstract: string | null }
    const refs = (refsRaw as RefRow[] | null)?.sort((a, b) => (b.año ?? 0) - (a.año ?? 0)) ?? null

    if (!refs || refs.length < MIN_REFS) {
      return new Response(
        JSON.stringify({ success: false, error: `Se requieren al menos ${MIN_REFS} referencias en tu biblioteca para un análisis de brechas útil.` }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{
          parts: [{ text:
            `Eres un asesor de investigación académica (nivel doctoral, área STEM/ingeniería).
            Analiza esta bibliografía y detecta brechas teóricas.

            BIBLIOGRAFÍA (${refs.length} referencias):
            ${JSON.stringify(refs.map((r) => ({
              titulo: r.titulo, autores: r.autores, año: r.año, revista: r.journal, resumen: r.abstract,
            })), null, 2)}

            Responde JSON puro con:
            - vacios: 3-6 vacíos teóricos o metodológicos concretos que deja esta bibliografía.
            - tendencias_emergentes: 2-4 líneas de investigación recientes (últimos 3 años) relacionadas pero ausentes.
            - autores_clave_no_citados: 2-5 autores/grupos de referencia en el área que no aparecen citados.
            - decadas_sin_cobertura: array de décadas (ej. [1990, 2000]) sin ninguna referencia, si aplica.
            - sugerencias_busqueda: 3-5 términos/queries de búsqueda concretos para cerrar los vacíos detectados.

            Si la bibliografía es demasiado limitada o heterogénea para inferir algo con confianza, dilo
            explícitamente dentro de "vacios" en vez de inventar hallazgos.

            JSON puro sin markdown:
            {"vacios":[],"tendencias_emergentes":[],"autores_clave_no_citados":[],"decadas_sin_cobertura":[],"sugerencias_busqueda":[]}`
          }]
        }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
      },
      controller.signal,
    )

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson = await aiRes.json()
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error("Gemini devolvió respuesta vacía.")

    const parsed: GapAnalysis = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(parsed), {
      serviceClient, teacherId: userId, toolName: "analyze_literature_gaps", cors,
      errorBody: { success: false, error: "El análisis no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (25s) analizando bibliografía." : err instanceof Error ? err.message : "Error interno."
    console.error("[ANALYZE_LITERATURE_GAPS]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
