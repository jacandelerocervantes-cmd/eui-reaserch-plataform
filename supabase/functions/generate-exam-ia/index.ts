// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { cacheGet, cacheSet, sha256Hex } from "../_shared/cache.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

// 6h (1.3 de docs/01_ARQUITECTURA_DEVOPS_FRUGAL.md): evita volver a pagar/
// esperar la generación si dos docentes piden el mismo prompt+conteo — no
// tan largo como para servir contenido obsoleto si el docente reformula.
const AI_RESPONSE_CACHE_TTL_SECONDS = 6 * 60 * 60

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

  // 90s: con el reintento automático ante 503/429 (hasta 2 reintentos), una
  // petición grande puede encadenar hasta 3 llamadas a Gemini — el timeout
  // total debe cubrir ese peor caso, no solo una llamada.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)

  try {
    const { prompt, currentCount } = await req.json()
    if (!prompt) return new Response(
      JSON.stringify({ error: "Se requiere 'prompt'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const cacheKey = `ai:generate-exam-ia:${await sha256Hex(JSON.stringify({ prompt, currentCount: currentCount ?? 0 }))}`
    const cached = await cacheGet<Record<string, unknown>>(cacheKey)
    if (cached) {
      clearTimeout(timeout)
      return new Response(
        JSON.stringify(cached),
        { headers: { ...cors, "Content-Type": "application/json", "X-Cache": "HIT" } }
      )
    }

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
          contents: [{
            parts: [{ text:
              `Eres Diseñador Curricular certificado del TecNM especializado en evaluación por competencias.
              Genera reactivos de examen para nivel ingeniería universitaria.

              ESTADO ACTUAL DEL EXAMEN: ${currentCount ?? 0} preguntas ya existentes.
              DIRECTIVA DEL DOCENTE: ${prompt}

              REGLAS DE GENERACIÓN — APLICA TODAS SIN EXCEPCIÓN:
              1. Crea EXACTAMENTE el número de reactivos solicitados. Ni uno más, ni uno menos.
              2. NO repitas temas de los reactivos existentes; el examen tiene ${currentCount ?? 0} preguntas previas.
              3. Distribución de Taxonomía de Bloom obligatoria:
                 - ≥ 60% de los reactivos en niveles APLICAR, ANALIZAR o EVALUAR.
                 - ≤ 40% en RECORDAR o COMPRENDER.
                 - Usa CREAR solo si el docente lo solicita explícitamente.
              4. Lenguaje técnico preciso. Evita términos ambiguos como "a veces", "generalmente", "siempre".
              5. El campo "type" debe ser EXACTAMENTE uno de estos 8 valores en inglés (son el enum real de la base de datos, no traduzcas ni inventes otros). Usa principalmente multiple_choice/true_false/open, y los demás solo cuando el docente los pida explícitamente o el tema se preste naturalmente:
                 - "multiple_choice": exactamente 4 opciones en "options". La opción correcta va en "answer" (debe coincidir textualmente con una de "options"). Los 3 distractores deben ser plausibles técnicamente.
                 - "true_false": el enunciado debe ser una afirmación técnica clara, no una opinión. "answer" debe ser exactamente "Verdadero" o "Falso".
                 - "open": el campo "answer" es la GUÍA DE EVALUACIÓN del docente (2-3 líneas con los conceptos clave que debe mencionar el alumno).
                 - "matching": relación de columnas. Usa "left" (array de conceptos) y "right" (array de definiciones EN EL MISMO ORDEN que su pareja correcta en "left"), y "correct" (array de índices: correct[i] = índice en "right" que corresponde a left[i]).
                 - "short_answer": respuesta corta exacta (fecha, fórmula, término técnico preciso, etc., NO algo subjetivo). "options" = array con la(s) respuesta(s) aceptada(s) (incluye variantes razonables: con/sin acento, sinónimo técnico equivalente).
                 - "fill_blank": "content" debe traer cada hueco marcado como "___". "options" = array con la respuesta correcta de cada hueco, EN EL MISMO ORDEN en que aparecen en "content".
                 - "ordering": el alumno ordena pasos/elementos de un proceso o algoritmo. "options" = los elementos EN SU ORDEN CORRECTO.
                 - "multi_select": como multiple_choice pero con varias correctas. "options" = 4-5 opciones, "correct" = array con las que son correctas (subconjunto de "options").
              6. "points": 10 por defecto. Ajusta solo si el docente especifica ponderación diferente.

              JSON puro sin markdown. Ejemplos de cada tipo:
              {"questions":[
                {"type":"multiple_choice","content":"Enunciado técnico claro y sin ambigüedades","options":["Opción A","Opción B","Opción C","Opción D"],"answer":"Opción A","points":10,"bloom":"Aplicar"},
                {"type":"true_false","content":"Afirmación técnica a evaluar","answer":"Verdadero","points":10,"bloom":"Comprender"},
                {"type":"open","content":"Pregunta abierta","answer":"Conceptos clave que debe mencionar el alumno","points":10,"bloom":"Analizar"},
                {"type":"matching","content":"Relaciona cada concepto con su definición","left":["TCP","UDP"],"right":["Protocolo orientado a conexión","Protocolo sin conexión"],"correct":[0,1],"points":10,"bloom":"Comprender"},
                {"type":"short_answer","content":"¿Qué capa del modelo OSI gestiona el direccionamiento lógico?","options":["Red","Capa de red"],"points":10,"bloom":"Recordar"},
                {"type":"fill_blank","content":"El protocolo ___ es orientado a conexión, mientras que ___ no lo es.","options":["TCP","UDP"],"points":10,"bloom":"Comprender"},
                {"type":"ordering","content":"Ordena las fases del ciclo de vida del software.","options":["Análisis","Diseño","Implementación","Pruebas","Mantenimiento"],"points":10,"bloom":"Aplicar"},
                {"type":"multi_select","content":"¿Cuáles de los siguientes son protocolos de la capa de transporte?","options":["TCP","UDP","IP","HTTP"],"correct":["TCP","UDP"],"points":10,"bloom":"Comprender"}
              ]}`
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
      serviceClient, teacherId: userId, toolName: "generate_exam_ia", cors,
      errorBody: { error: "Los reactivos no pudieron mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    await cacheSet(cacheKey, parsed, AI_RESPONSE_CACHE_TTL_SECONDS)

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...cors, "Content-Type": "application/json", "X-Cache": "MISS" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (90s) generando reactivos." : err instanceof Error ? err.message : "Error interno."
    console.error("[GENERATE_EXAM_IA]", msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
