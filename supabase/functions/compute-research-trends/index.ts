// deno-lint-ignore-file no-import-prefix
/**
 * compute-research-trends
 * Igual que compute-student-risk-signals pero para el dominio Investigación:
 * tendencia suavizada (Kalman) de burn rate financiero (fondos_investigacion)
 * y de avance de tesis reportado (tesistas.avance) para el usuario
 * autenticado. Recálculo por lotes bajo demanda, no trigger automático.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { applyKalman } from "../_shared/kalmanStore.ts"

const BURN_RATE_Q = 500, BURN_RATE_R = 5000 // en pesos/mes, magnitud depende del proyecto
const AVANCE_Q = 2, AVANCE_R = 25            // avance en % (0-100)

// Mismo criterio que compute-student-risk-signals: con menos de esto el
// "suavizado" es casi la lectura cruda, no una tendencia real.
const MIN_OBSERVATIONS = 3

interface Fondo { tipo: "entrada" | "gasto"; monto_total: number; fecha_inicio: string | null }
interface Tesista { id: string; nombre: string; avance: number; created_at: string }

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    // ── Burn rate mensual: acumular gasto mes a mes y pasarlo por Kalman ────
    const { data: fondosRaw } = await serviceClient
      .from("fondos_investigacion")
      .select("tipo, monto_total, fecha_inicio")
      .eq("docente_id", userId)
      .order("fecha_inicio", { ascending: true })

    const gastosPorMes = new Map<string, number>()
    for (const f of (fondosRaw ?? []) as Fondo[]) {
      if (f.tipo !== "gasto" || !f.fecha_inicio) continue
      const mes = f.fecha_inicio.slice(0, 7) // "YYYY-MM"
      gastosPorMes.set(mes, (gastosPorMes.get(mes) ?? 0) + f.monto_total)
    }
    const mesesOrdenados = [...gastosPorMes.keys()].sort()

    let burnRateState: { x: number; p: number } | null = null
    for (const mes of mesesOrdenados) {
      const result = await applyKalman(serviceClient, {
        domain: "investigacion", entityType: "researcher_burn_rate", entityId: userId, signalName: "burn_rate_mensual",
        measurement: gastosPorMes.get(mes)!, processNoiseQ: BURN_RATE_Q, measurementNoiseR: BURN_RATE_R,
      })
      burnRateState = result.state
    }
    const burnRateConfianzaInsuficiente = mesesOrdenados.length < MIN_OBSERVATIONS

    // ── Avance de tesis por tesista: Kalman sobre el % reportado ─────────────
    // NOTA: tesistas solo guarda el avance ACTUAL (una fila por tesista, sin
    // historial de cambios) — el filtro aquí solo tiene UN punto de medición
    // por tesista hasta que exista una bitácora de avance con fecha por
    // registro. Se aplica igual (arranca con esa medición como estimación
    // inicial) para dejar el mecanismo listo en cuanto haya historial real.
    const { data: tesistasRaw } = await serviceClient
      .from("tesistas")
      .select("id, nombre, avance, created_at")
      .eq("docente_id", userId)

    // NOTA n_observaciones: cada tesista solo tiene UN punto de medición
    // (ver comentario arriba) — hoy `confianza_insuficiente` va SIEMPRE en
    // true para todos. Se calcula por fila (no hardcoded a `true`) para que
    // esto se corrija solo en cuanto exista una bitácora de avance con
    // historial real y n_observaciones empiece a subir de forma natural.
    const tesistasResult: { tesista_id: string; nombre: string; avance_suavizado: number; n_observaciones: number; confianza_insuficiente: boolean }[] = []
    for (const t of (tesistasRaw ?? []) as Tesista[]) {
      const result = await applyKalman(serviceClient, {
        domain: "investigacion", entityType: "tesista_avance", entityId: t.id, signalName: "avance_pct",
        measurement: t.avance, processNoiseQ: AVANCE_Q, measurementNoiseR: AVANCE_R,
      })
      const nObservaciones = 1 // una sola medición por tesista hasta que exista bitácora histórica
      tesistasResult.push({
        tesista_id: t.id, nombre: t.nombre, avance_suavizado: result.state.x,
        n_observaciones: nObservaciones, confianza_insuficiente: nObservaciones < MIN_OBSERVATIONS,
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          burn_rate_mensual_suavizado: burnRateState?.x ?? null,
          burn_rate_n_observaciones: mesesOrdenados.length,
          burn_rate_confianza_insuficiente: burnRateConfianzaInsuficiente,
          burn_rate_por_mes: mesesOrdenados.map((mes) => ({ mes, gasto: gastosPorMes.get(mes) })),
          tesistas: tesistasResult,
        },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[COMPUTE_RESEARCH_TRENDS]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
