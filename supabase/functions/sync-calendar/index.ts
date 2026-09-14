// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

interface RawEvent { id: string; titulo: string; diaSemana: number; horaInicio: string; horaFin?: string; ubicacion: string }
interface AIEventAnalysis { id: string; pilar: string; esConflicto: boolean }
interface AIResponse { analisisEventos: AIEventAnalysis[]; aiSummary: { hayConflictos: boolean; mensaje: string } }

const PILAR_COLORS: Record<string, string> = {
  DOCENCIA:      "#1B396A",
  INVESTIGACION: "#7C3AED",
  LABORATORIO:   "#10B981",
  CAMPO:         "#F59E0B",
  INSTITUCIONAL: "#64748b",
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const auth = await verifyUser(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
  const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET") ?? ""
  const GEMINI_KEY      = Deno.env.get("GEMINI_API_KEY")

  if (!APPS_SCRIPT_URL || !GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "Variables de entorno no configuradas." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ secret: WEBHOOK_SECRET, action: "obtenerEventosCalendario", payload: {} }),
      signal:  controller.signal,
    })
    if (!googleRes.ok) throw new Error(`Apps Script respondió ${googleRes.status}`)
    const result = await googleRes.json()
    const rawEvents: RawEvent[] = result.data || []

    if (rawEvents.length === 0) {
      return new Response(JSON.stringify({
        success: true, data: [],
        aiSummary: { hayConflictos: false, mensaje: "Agenda despejada. Momento ideal para investigación profunda." },
      }), { headers: { ...cors, "Content-Type": "application/json" } })
    }

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
          contents: [{
            parts: [{ text:
              `Actúa como Oficial de Triage IEO de un Investigador del TecNM.
              Analiza estos eventos semanales.

              1. Clasifica cada uno en PILAR: DOCENCIA, INVESTIGACION, LABORATORIO, CAMPO, INSTITUCIONAL.
              2. Detecta CONFLICTOS de horario (esConflicto: true/false).
              3. Genera aiSummary: hayConflictos (bool) + mensaje ejecutivo de 2 líneas.

              DATOS: ${JSON.stringify(rawEvents.map(e => ({ id: e.id, titulo: e.titulo, diaSemana: e.diaSemana, horaInicio: e.horaInicio, horaFin: e.horaFin, ubicacion: e.ubicacion })))}

              JSON puro: {"analisisEventos":[{"id":"...","pilar":"...","esConflicto":false}],"aiSummary":{"hayConflictos":false,"mensaje":"..."}}`
            }]
          }],
          generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
      },
      controller.signal,
    )
    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson  = await aiRes.json()
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error("Gemini devolvió respuesta vacía.")

    const aiData: AIResponse = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(aiData), {
      serviceClient, teacherId: userId, toolName: "sync_calendar", cors,
      errorBody: { success: false, error: "El análisis no pudo mostrarse por una regla de seguridad interna.", aiSummary: { hayConflictos: false, mensaje: "Bloqueado por seguridad." } },
    })
    if (guard.blocked) return guard.response

    const enriched = rawEvents.map((e) => {
      const analysis = aiData.analisisEventos.find((a) => a.id === e.id)
      const pilar = analysis?.pilar ?? "INSTITUCIONAL"
      return { ...e, pilar, esConflicto: analysis?.esConflicto ?? false, color: PILAR_COLORS[pilar] ?? PILAR_COLORS.INSTITUCIONAL }
    })

    return new Response(JSON.stringify({ success: true, data: enriched, aiSummary: aiData.aiSummary }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (25s)." : err instanceof Error ? err.message : "Error interno."
    console.error("[sync-calendar]", msg)
    return new Response(JSON.stringify({
      success: false, error: msg,
      aiSummary: { hayConflictos: true, mensaje: "Error al sincronizar agenda. Reintenta en un momento." },
    }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } })
  } finally {
    clearTimeout(timeout)
  }
})
