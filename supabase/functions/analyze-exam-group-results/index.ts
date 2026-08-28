// deno-lint-ignore-file no-import-prefix
/**
 * Punto 9 de qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md:
 * psicometría clásica DETERMINISTA (dificultad/discriminación por reactivo)
 * calculada en JS puro ANTES de pedirle a Gemini que interprete — estos dos
 * índices son estadística cerrada de hace décadas, no algo que un LLM deba
 * "opinar" o recalcular. Gemini recibe los números ya calculados como
 * contexto fijo (mismo patrón de anclaje que graphrag-query) y solo
 * redacta el diagnóstico/recomendación sobre ellos.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length)
  if (n < 3) return null
  const xs = a.slice(0, n), ys = b.slice(0, n)
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX, dy = ys[i] - meanY
    num += dx * dy; denX += dx * dx; denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null
  return num / Math.sqrt(denX * denY)
}

interface QuestionRow { id: string; content: string; q_type: string; points: number | null }
interface ResponseRow { score_ia: number | null; final_score: number | null; metadata: { question_scores?: Record<string, number> } | null }

/**
 * Índice de dificultad ($p$-value clásico) e índice de discriminación
 * (correlación punto-biserial simplificada: fracción obtenida en el
 * reactivo vs. puntaje total de la respuesta) por reactivo. Requiere que
 * `evaluation_responses.metadata.question_scores` ya tenga el desglose por
 * reactivo (lo escribe bulk-evaluate-exams). Reactivos sin suficientes
 * respuestas (<3) se omiten, no se fabrica un número con poca evidencia.
 */
function computeItemPsychometrics(questions: QuestionRow[], responses: ResponseRow[]) {
  return questions.map((q) => {
    const fractions: number[] = []
    const totals: number[] = []
    for (const r of responses) {
      const qScore = r.metadata?.question_scores?.[q.id]
      if (qScore === undefined || qScore === null || !q.points) continue
      fractions.push(qScore / q.points)
      totals.push(r.final_score ?? r.score_ia ?? 0)
    }
    if (fractions.length < 3) return { id: q.id, content: q.content, n: fractions.length, dificultad: null, discriminacion: null }
    const dificultad = Math.round((fractions.reduce((a, b) => a + b, 0) / fractions.length) * 100) / 100
    const discriminacion = pearsonCorrelation(fractions, totals)
    return {
      id: q.id, content: q.content, n: fractions.length,
      dificultad, // 0=nadie lo acertó, 1=todos — NO "qué tan difícil se ve", es el % de aciertos real
      discriminacion: discriminacion !== null ? Math.round(discriminacion * 100) / 100 : null, // -1 a 1
    }
  })
}

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
    const { examId } = await req.json()
    if (!examId) return new Response(
      JSON.stringify({ error: "Se requiere 'examId'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── 2. Datos del examen (tabla correcta: exams) ───────────────────────
    const { data: exam } = await serviceClient
      .from("exams")
      .select("title")
      .eq("id", examId)
      .single()

    // ── 3. Reactivos ──────────────────────────────────────────────────────
    const { data: questions } = await serviceClient
      .from("questions")
      .select("content, q_type, points")
      .eq("exam_id", examId)

    // ── 4. Respuestas del grupo ───────────────────────────────────────────
    const { data: responses } = await serviceClient
      .from("evaluation_responses")
      .select("score_ia, final_score, metadata")
      .eq("exam_id", examId)

    if (!responses?.length) {
      return new Response(
        JSON.stringify({ insight: "Aún no hay suficientes entregas para generar un análisis grupal." }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 4.5. Psicometría clásica determinista (dificultad/discriminación) ──
    const itemStats = computeItemPsychometrics((questions ?? []) as QuestionRow[], responses as ResponseRow[])
    const reactivosBajaDiscriminacion = itemStats.filter((it) => it.discriminacion !== null && it.discriminacion < 0.1)

    // ── 5. Análisis IA ────────────────────────────────────────────────────
    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
          contents: [{
            parts: [{ text:
              `Eres Coordinador Académico del TecNM con expertise en análisis de resultados grupales.
              Analiza el desempeño del grupo en este examen y genera un reporte diagnóstico ejecutivo.

              EXAMEN: "${exam?.title ?? "Sin título"}"
              TOTAL DE ALUMNOS EVALUADOS: ${responses.length}

              REACTIVOS:
              ${JSON.stringify(questions, null, 2)}

              RESULTADOS DEL GRUPO (score_ia = puntuación IA, final_score = puntuación final del docente si existe):
              ${JSON.stringify(responses, null, 2)}

              PSICOMETRÍA YA CALCULADA POR REACTIVO (NO la recalcules ni la contradigas — dificultad es el %
              real de aciertos [0=nadie acertó, 1=todos acertaron]; discriminación es la correlación entre
              acertar ese reactivo y el puntaje total del examen [-1 a 1; cercano a 0 o negativo significa que
              el reactivo NO distingue entre quien domina el tema y quien no — puede tener redacción ambigua
              o estar mal calibrado, más allá de si el grupo lo entendió]):
              ${JSON.stringify(itemStats, null, 2)}
              Reactivos con discriminación < 0.1 (posible problema de REDACCIÓN del reactivo, no solo de
              dominio del tema por el grupo): ${JSON.stringify(reactivosBajaDiscriminacion.map((r) => r.content))}

              ANÁLISIS REQUERIDO:
              1. Calcula el promedio grupal y la distribución aproximada (cuántos están en rango alto/medio/bajo).
              2. Identifica el tema o reactivo con mejor desempeño del grupo (dificultad más alta = más aciertos).
              3. Identifica el tema o reactivo con mayor tasa de error (dificultad más baja) — este es el dato
                 más importante. Si además tiene baja discriminación, dilo explícitamente: sugiere revisar la
                 REDACCIÓN del reactivo, no solo reforzar el tema.
              4. Formula UNA recomendación pedagógica concreta y ejecutable para la siguiente sesión.

              REGLAS DE SALIDA:
              - Máximo 280 palabras en total.
              - Tono: informe ejecutivo académico. Profesional, directo, sin saludos ni cierres formales.
              - Usa datos numéricos cuando los tengas (promedios, porcentajes).
              - La recomendación debe ser específica al tema problemático identificado, no genérica.
              - Estructura con estos encabezados exactos (sin asteriscos ni markdown):
                DIAGNÓSTICO GRUPAL | FORTALEZA COLECTIVA | BRECHA CRÍTICA | ACCIÓN PEDAGÓGICA`
            }]
          }],
          generationConfig: { temperature: 0.2 },
      },
      controller.signal,
    )

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson = await aiRes.json()
    const insight = aiJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "Sin análisis disponible."

    const guard = await guardOutputOrBlock(insight, {
      serviceClient, teacherId: userId, toolName: "analyze_exam_group_results", cors,
      errorBody: { error: "El análisis no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({ insight, item_stats: itemStats }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (25s) generando análisis grupal." : err instanceof Error ? err.message : "Error interno."
    console.error("[ANALYZE_EXAM_GROUP_RESULTS]", msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
