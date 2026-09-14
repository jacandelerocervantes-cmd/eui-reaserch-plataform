// deno-lint-ignore-file no-import-prefix
/**
 * generate-tesis-feedback
 * Retroalimentación de avance de tesis vía Gemini, a partir del registro real
 * del tesista (tabla tesistas) — no del documento completo, que no se
 * almacena aquí. Invocada desde
 * app/(investigacion)/investigacion/tesis/page.tsx.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

interface TesisFeedback {
  fortalezas: string[]
  areas_mejora: string[]
  preguntas_defensa: string[]
  siguiente_paso: string
  tiempo_estimado_siguiente_etapa: string
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
    const { tesista_id } = await req.json()
    if (!tesista_id) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'tesista_id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const { data: tesista } = await serviceClient
      .from("tesistas")
      .select("nombre, titulo_tesis, etapa, avance, fecha_defensa, notas, docente_id")
      .eq("id", tesista_id)
      .single()

    if (!tesista) return new Response(
      JSON.stringify({ success: false, error: "Tesista no encontrado." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )
    if (tesista.docente_id !== userId) return new Response(
      JSON.stringify({ success: false, error: "No tienes permiso sobre este tesista." }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{
          parts: [{ text:
            `Eres un asesor de tesis (nivel doctoral) del TecNM. Da retroalimentación sobre el avance de este tesista,
            basándote SOLO en la información de seguimiento disponible (no tienes el documento completo).

            TESISTA: ${tesista.nombre}
            TÍTULO DE TESIS: ${tesista.titulo_tesis}
            ETAPA ACTUAL: ${tesista.etapa} (${tesista.avance}% de avance reportado)
            ${tesista.fecha_defensa ? `FECHA DE DEFENSA ESTIMADA: ${tesista.fecha_defensa}` : ""}
            ${tesista.notas ? `NOTAS DEL ASESOR: ${tesista.notas}` : "Sin notas adicionales del asesor."}

            Da retroalimentación orientada al PROCESO de tesis (avance, gestión del tiempo, riesgos de la etapa
            actual), no al contenido académico específico que no puedes ver. Si no hay notas del asesor, sé
            explícito en que tus sugerencias son generales para la etapa, no un diagnóstico del trabajo real.

            JSON puro sin markdown:
            {"fortalezas":["..."],"areas_mejora":["..."],"preguntas_defensa":["..."],"siguiente_paso":"...","tiempo_estimado_siguiente_etapa":"..."}

            - fortalezas: 2-3 puntos, basados en el avance/etapa reportado.
            - areas_mejora: 2-3 puntos, riesgos típicos de la etapa actual dado el avance reportado.
            - preguntas_defensa: 3-5 preguntas típicas que un jurado haría en la etapa "${tesista.etapa}" para un
              trabajo titulado "${tesista.titulo_tesis}".
            - siguiente_paso: una acción concreta y accionable.
            - tiempo_estimado_siguiente_etapa: estimación breve (ej. "4-6 semanas").`
          }]
        }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.3 },
      },
      controller.signal,
    )

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson = await aiRes.json()
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error("Gemini devolvió respuesta vacía.")

    const parsed: TesisFeedback = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(parsed), {
      serviceClient, teacherId: userId, toolName: "generate_tesis_feedback", cors,
      errorBody: { success: false, error: "La retroalimentación no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (25s) generando retroalimentación." : err instanceof Error ? err.message : "Error interno."
    console.error("[GENERATE_TESIS_FEEDBACK]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
