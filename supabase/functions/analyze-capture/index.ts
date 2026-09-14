// deno-lint-ignore-file no-import-prefix
/**
 * analyze-capture
 * Paso 1 del pipeline human-in-the-loop de Campo/Laboratorio: analiza el
 * archivo ya subido (foto/audio) de una captura de campo o de una incidencia
 * de laboratorio, y escribe una SUGERENCIA de datos estructurados en
 * ai_extracted_data + review_status='analizado_ia'.
 *
 * IMPORTANTE: nunca escribe el campo "final" (capturas_campo.campos_datos ni
 * ningún otro dato que otros módulos consuman como válido) — eso solo lo
 * hace confirm-capture, después de que un humano revisa/edita esta
 * sugerencia. La IA propone, la persona dispone.
 *
 * domain='campo'      -> capturas_campo (bucket campo-capturas, público)
 * domain='laboratorio' -> equipos_lab_logs (content_url subido por el
 *                          docente, mismo patrón de foto de incidencia)
 *
 * Requiere supabase/pendiente/003_captura_review_columns.sql aplicado.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

const DOMAINS = ["campo", "laboratorio"] as const
type Domain = typeof DOMAINS[number]

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, role, serviceClient } = auth.ctx

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const { domain, id } = await req.json()
    if (!DOMAINS.includes(domain)) return new Response(
      JSON.stringify({ success: false, error: "'domain' debe ser 'campo' o 'laboratorio'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )
    if (!id) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    let contentUrl: string | null
    let contextPrompt: string
    let table: string
    let ownerId: string | null

    if ((domain as Domain) === "campo") {
      const { data: captura } = await serviceClient
        .from("capturas_campo")
        .select("id, docente_id, tipo, content_url, notas, mision_id")
        .eq("id", id)
        .single()
      if (!captura) return new Response(
        JSON.stringify({ success: false, error: "Captura no encontrada." }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      )
      ownerId = captura.docente_id
      contentUrl = captura.content_url
      table = "capturas_campo"

      const { data: mision } = await serviceClient
        .from("misiones_campo")
        .select("titulo, objetivo, campos_requeridos")
        .eq("id", captura.mision_id)
        .single()

      contextPrompt = `Misión: "${mision?.titulo ?? "sin título"}". Objetivo: ${mision?.objetivo ?? "no especificado"}.
        Campos que la misión pide capturar (JSON): ${JSON.stringify(mision?.campos_requeridos ?? [])}.
        Notas que el investigador ya escribió: ${captura.notas ?? "(ninguna)"}`
    } else {
      const { data: log } = await serviceClient
        .from("equipos_lab_logs")
        .select("id, docente_id, accion, content_url, notas, equipo_id")
        .eq("id", id)
        .single()
      if (!log) return new Response(
        JSON.stringify({ success: false, error: "Registro de equipo no encontrado." }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      )
      ownerId = log.docente_id
      contentUrl = log.content_url
      table = "equipos_lab_logs"

      const { data: equipo } = await serviceClient
        .from("equipos_lab")
        .select("nombre, tipo, modelo")
        .eq("id", log.equipo_id)
        .single()

      contextPrompt = `Equipo: "${equipo?.nombre ?? "sin nombre"}" (${equipo?.tipo ?? "tipo no especificado"}, modelo ${equipo?.modelo ?? "?"}).
        Acción registrada: ${log.accion}. Notas del docente: ${log.notas ?? "(ninguna)"}`
    }

    if (role !== "admin" && ownerId !== userId) return new Response(
      JSON.stringify({ success: false, error: "No tienes permiso sobre este registro." }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    )
    if (!contentUrl) return new Response(
      JSON.stringify({ success: false, error: "Este registro no tiene archivo adjunto que analizar." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── Descargar el archivo (URL pública del bucket) y mandarlo a Gemini ──
    const fileRes = await fetch(contentUrl, { signal: controller.signal })
    if (!fileRes.ok) throw new Error(`No se pudo descargar el archivo adjunto (${fileRes.status}).`)
    const mimeType = fileRes.headers.get("content-type") ?? "application/octet-stream"
    const arrayBuffer = await fileRes.arrayBuffer()
    const base64File = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64File } },
            { text:
              `Eres un asistente de captura de datos ${domain === "campo" ? "de campo" : "de laboratorio"}. Analiza el
              archivo adjunto y propone datos estructurados. Esto es SOLO UNA SUGERENCIA — un humano la va a
              revisar y corregir antes de que cuente como dato válido, así que si algo no es visible/audible
              con certeza en el archivo, dilo en "incertidumbres" en vez de inventarlo.

              ${contextPrompt}

              JSON puro sin markdown:
              {"datos_sugeridos":{"campo":"valor"},"observaciones":"1-2 frases de lo que ves/escuchas relevante","incertidumbres":["qué no se puede determinar con confianza del archivo"]}`
            },
          ],
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
      serviceClient, teacherId: userId, toolName: "analyze_capture", cors,
      errorBody: { success: false, error: "La sugerencia no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    const { error: updateErr } = await serviceClient
      .from(table)
      .update({ ai_extracted_data: parsed, review_status: "analizado_ia" })
      .eq("id", id)
    if (updateErr) throw new Error(updateErr.message)

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (30s) analizando el archivo." : err instanceof Error ? err.message : "Error interno."
    console.error("[ANALYZE_CAPTURE]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
