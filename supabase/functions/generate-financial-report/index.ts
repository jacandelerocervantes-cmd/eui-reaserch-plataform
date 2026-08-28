// deno-lint-ignore-file no-import-prefix
/**
 * generate-financial-report
 * Informe financiero de investigación vía Gemini, sobre los movimientos
 * reales del docente autenticado (fondos_investigacion). El burn rate
 * mensual se calcula determinísticamente en JS (no se le pide a Gemini que
 * haga aritmética); Gemini solo redacta el análisis narrativo sobre esos
 * números ya calculados. Invocada desde
 * app/(investigacion)/investigacion/financiamiento/page.tsx.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

interface Fondo {
  nombre: string; tipo: "entrada" | "gasto"; monto_total: number
  fecha_inicio: string | null; fecha_fin: string | null; fuente: string | null
}

interface FinancialReport {
  resumen_ejecutivo: string
  alertas: string[]
  recomendaciones: string[]
  proyeccion: string
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
    const { data: fondosRaw } = await serviceClient
      .from("fondos_investigacion")
      .select("nombre, tipo, monto_total, fecha_inicio, fecha_fin, fuente")
      .eq("docente_id", userId)

    const fondos = (fondosRaw ?? []) as Fondo[]
    if (fondos.length === 0) return new Response(
      JSON.stringify({ success: false, error: "No hay movimientos registrados para generar un informe." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── Aritmética determinista en JS — Gemini no calcula, solo redacta ──────
    const totalEntradas = fondos.filter((f) => f.tipo === "entrada").reduce((s, f) => s + f.monto_total, 0)
    const totalGastos = fondos.filter((f) => f.tipo === "gasto").reduce((s, f) => s + f.monto_total, 0)
    const saldo = totalEntradas - totalGastos

    const fechasGasto = fondos.filter((f) => f.tipo === "gasto" && f.fecha_inicio).map((f) => new Date(f.fecha_inicio!).getTime())
    const mesesConGasto = fechasGasto.length
      ? Math.max(1, (Date.now() - Math.min(...fechasGasto)) / (1000 * 60 * 60 * 24 * 30))
      : 1
    const burnRateMensual = Number((totalGastos / mesesConGasto).toFixed(2))

    const vencenPronto = fondos.filter((f) => f.fecha_fin && new Date(f.fecha_fin) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{
          parts: [{ text:
            `Eres asesor financiero de proyectos de investigación académica (TecNM). Redacta un informe breve
            a partir de estos números YA CALCULADOS (no recalcules nada, solo interprétalos):

            Total entradas: $${totalEntradas.toFixed(2)} MXN
            Total gastos: $${totalGastos.toFixed(2)} MXN
            Saldo disponible: $${saldo.toFixed(2)} MXN
            Burn rate mensual estimado: $${burnRateMensual.toFixed(2)} MXN/mes
            Fondos que vencen en 30 días: ${vencenPronto.length > 0 ? vencenPronto.map((f) => `${f.nombre} (${f.fuente ?? "sin fuente"})`).join(", ") : "ninguno"}
            Número total de movimientos: ${fondos.length}

            JSON puro sin markdown:
            {"resumen_ejecutivo":"...","alertas":["..."],"recomendaciones":["..."],"proyeccion":"..."}

            - resumen_ejecutivo: 2-3 frases, tono profesional, en español.
            - alertas: 0-4 puntos. Solo incluye alertas si los números realmente lo justifican (saldo negativo,
              fondos por vencer, burn rate alto relativo al saldo) — no inventes riesgos si no los hay.
            - recomendaciones: 2-4 acciones concretas y accionables.
            - proyeccion: 1 frase sobre cuántos meses dura el saldo al burn rate actual (si saldo <= 0, dilo
              explícitamente en vez de una proyección positiva).`
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

    const report: FinancialReport = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(report), {
      serviceClient, teacherId: userId, toolName: "generate_financial_report", cors,
      errorBody: { success: false, error: "El informe no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({ success: true, data: { report, raw_numbers: { burn_rate_mensual: burnRateMensual, total_entradas: totalEntradas, total_gastos: totalGastos, saldo } } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (25s) generando informe financiero." : err instanceof Error ? err.message : "Error interno."
    console.error("[GENERATE_FINANCIAL_REPORT]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
