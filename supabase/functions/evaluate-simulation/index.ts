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
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    const { questions, answers } = await req.json()
    if (!questions?.length) return new Response(
      JSON.stringify({ error: "Se requieren 'questions'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
          contents: [{
            parts: [{ text:
              `Eres un Tutor Académico Adaptativo del TecNM experto en aprendizaje por competencias.
              Analiza el desempeño de este estudiante en su simulacro de examen y genera retroalimentación personalizada.

              REACTIVOS DEL EXAMEN:
              ${JSON.stringify(questions, null, 2)}

              RESPUESTAS DEL ESTUDIANTE:
              ${JSON.stringify(answers, null, 2)}

              ANÁLISIS REQUERIDO:
              1. Calcula mentalmente qué reactivos respondió correctamente vs incorrectamente.
              2. Identifica el PATRÓN: ¿falló en comprensión teórica, aplicación práctica, o cálculo?
              3. Determina su fortaleza más clara y su brecha más crítica.

              REGLAS DE SALIDA:
              - plan: Plan de Refuerzo Inteligente. Máximo 400 caracteres. Tono motivador pero técnico.
                Debe incluir: qué repasar (tema específico), cómo (recurso o estrategia concreta), y para qué (competencia que desarrollará).
                Ejemplo de tono: "Refuerza [tema] revisando [recurso]. Dominar esto te permitirá [aplicación real]."
              - fortaleza: El tema o competencia donde el estudiante demostró mayor solidez. Máximo 60 caracteres.
              - repaso: El tema con mayor brecha de aprendizaje que debe priorizar. Máximo 60 caracteres.
              - score_percent: Porcentaje estimado de respuestas correctas (0-100, número entero).

              JSON puro sin markdown:
              {"plan":"Plan de refuerzo personalizado...","fortaleza":"Tema dominado","repaso":"Tema a reforzar","score_percent":75}`
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
    const parsed = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(parsed), {
      serviceClient, teacherId: userId, toolName: "evaluate_simulation", cors,
      errorBody: { error: "La retroalimentación no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (25s) en simulación." : err instanceof Error ? err.message : "Error interno."
    console.error("[EVALUATE_SIMULATION]", msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
