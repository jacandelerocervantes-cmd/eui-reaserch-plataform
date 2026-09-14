// deno-lint-ignore-file no-import-prefix
/**
 * run-rag-benchmark
 *
 * Corre el mismo conjunto de preguntas (tabla `rag_benchmark_questions`)
 * contra graphrag-query (casero, pgvector) y vertex-search-query (Vertex AI
 * Search, crédito "GenAI App Builder"), y guarda ambos resultados en
 * `rag_benchmark_results` para comparación manual posterior — ver
 * `manual_relevance_score` en la migración: el veredicto de calidad es
 * lectura humana, no una heurística automática.
 *
 * No inventa preguntas ni evalúa cuál sistema "ganó" — solo ejecuta y
 * registra. El análisis (para el caso de estudio del Módulo 10 del manual
 * maestro) se hace después, leyendo `rag_benchmark_results`.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!

interface BenchmarkQuestion {
  id: string
  domain: "docencia" | "investigacion"
  course_id: string | null
  question: string
}

async function callGraphrag(authHeader: string, q: BenchmarkQuestion): Promise<{ answer: string | null; sources: unknown; latencyMs: number; error: string | null }> {
  const started = Date.now()
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/graphrag-query`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ domain: q.domain, course_id: q.course_id ?? undefined, query: q.question }),
    })
    const latencyMs = Date.now() - started
    const json = await res.json()
    if (!res.ok || !json.success) return { answer: null, sources: null, latencyMs, error: json.error ?? `HTTP ${res.status}` }
    return { answer: json.data.answer, sources: json.data.sources, latencyMs, error: null }
  } catch (err) {
    return { answer: null, sources: null, latencyMs: Date.now() - started, error: err instanceof Error ? err.message : "Error desconocido" }
  }
}

async function callVertexSearch(authHeader: string, q: BenchmarkQuestion): Promise<{ answer: string | null; sources: unknown; latencyMs: number; error: string | null }> {
  const started = Date.now()
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/vertex-search-query`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ domain: q.domain, question: q.question }),
    })
    const latencyMs = Date.now() - started
    const json = await res.json()
    if (!res.ok) return { answer: null, sources: null, latencyMs, error: json.error ?? `HTTP ${res.status}` }
    return { answer: json.answer, sources: json.citations, latencyMs, error: null }
  } catch (err) {
    return { answer: null, sources: null, latencyMs: Date.now() - started, error: err instanceof Error ? err.message : "Error desconocido" }
  }
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { serviceClient } = auth.ctx
  const authHeader = req.headers.get("Authorization")!

  let body: { questionIds?: string[] }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  let query = serviceClient.from("rag_benchmark_questions").select("id, domain, course_id, question")
  if (body.questionIds?.length) query = query.in("id", body.questionIds)
  const { data: questions, error: qErr } = await query

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    })
  }
  if (!questions?.length) {
    return new Response(JSON.stringify({ error: "No hay preguntas en rag_benchmark_questions para correr." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const summary: Array<{ questionId: string; question: string; graphrag: unknown; vertexSearch: unknown }> = []

  for (const q of questions as BenchmarkQuestion[]) {
    // Secuencial a propósito (no Promise.all): esto es un benchmark de
    // investigación de bajo volumen, no tráfico de producción — no hay
    // razón para pelear por el semáforo de concurrencia de fetchGeminiWithRetry
    // que graphrag-query usa internamente.
    const [graphragResult, vertexResult] = await Promise.all([
      callGraphrag(authHeader, q),
      callVertexSearch(authHeader, q),
    ])

    await serviceClient.from("rag_benchmark_results").insert([
      { question_id: q.id, system: "graphrag", answer: graphragResult.answer, sources: graphragResult.sources, latency_ms: graphragResult.latencyMs, error: graphragResult.error },
      { question_id: q.id, system: "vertex_search", answer: vertexResult.answer, sources: vertexResult.sources, latency_ms: vertexResult.latencyMs, error: vertexResult.error },
    ])

    summary.push({ questionId: q.id, question: q.question, graphrag: graphragResult, vertexSearch: vertexResult })
  }

  return new Response(JSON.stringify({ ranQuestions: summary.length, results: summary }), {
    headers: { ...cors, "Content-Type": "application/json" },
  })
})
