// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const { prompt, materiaContexto } = await req.json()
    if (!prompt) return new Response(
      JSON.stringify({ error: "Se requiere 'prompt'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
          contents: [{
            parts: [{ text:
              `Eres Diseñador Instruccional certificado del TecNM especializado en producción de materiales de nivel ingeniería.
              Crea un Material Híbrido de alta calidad académica.

              MATERIA / CONTEXTO ACADÉMICO: ${materiaContexto || "Ingeniería (especificar según el tema)"}
              TEMA SOLICITADO: ${prompt}

              ESTÁNDARES DE PRODUCCIÓN:
              - El material debe cumplir con el rigor académico del TecNM: fundamentación teórica, aplicación práctica, y alineación con competencias de ingeniería.
              - "content" debe estar en Markdown profesional e incluir obligatoriamente:
                • Objetivo de aprendizaje claro (1-2 oraciones).
                • Fundamento teórico con definiciones precisas y referencias al estándar o norma correspondiente (IEEE, ISO, NOM, etc.) si aplica.
                • Al menos 1 ejemplo técnico resuelto o caso de aplicación real.
                • Al menos 1 tabla o lista estructurada con datos técnicos relevantes.
                • Extensión mínima: 400 palabras.
              - "summary": resumen ejecutivo de 2-3 oraciones. Debe responder: ¿qué aprenderá el alumno y para qué le sirve?
              - "suggested_activity": actividad práctica concreta (laboratorio, resolución de problema, análisis de caso). Especifica: qué hace el alumno, con qué herramientas, y cuál es el entregable esperado. Máximo 80 palabras.

              JSON puro sin markdown ni bloques de código:
              {"title":"Título profesional del material","summary":"Resumen ejecutivo de 2-3 oraciones...","content":"# Título\\n\\n**Objetivo:** ...\\n\\n## Fundamento Teórico\\n...","suggested_activity":"Descripción de actividad práctica con entregable definido."}`
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
    const materialData = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(materialData), {
      serviceClient, teacherId: userId, toolName: "process_hybrid_material", cors,
      errorBody: { error: "El material no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify(materialData),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (30s) generando material." : err instanceof Error ? err.message : "Error interno."
    console.error("[PROCESS_HYBRID_MATERIAL]", msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: isTimeout ? 504 : 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
