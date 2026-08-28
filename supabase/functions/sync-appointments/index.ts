// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

interface RawAppointment { id: string; name: string; type: string; date: string; time: string; email: string; meetLink?: string; location?: string }
interface AIAnalysis { id: string; pilar: string; modalidad: "Virtual" | "Física"; accion_sugerida: string }
interface AIResponse { analisisCitas: AIAnalysis[]; aiSummary: string }

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
      body:    JSON.stringify({ secret: WEBHOOK_SECRET, action: "obtenerCitas", payload: {} }),
      signal:  controller.signal,
    })
    if (!googleRes.ok) throw new Error(`Apps Script respondió ${googleRes.status}`)
    const result = await googleRes.json()
    const rawApps: RawAppointment[] = result.data || []

    if (rawApps.length === 0) {
      return new Response(JSON.stringify({
        success: true, data: [], aiSummary: "Sin citas programadas. Operativa despejada.",
      }), { headers: { ...cors, "Content-Type": "application/json" } })
    }

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
          contents: [{
            parts: [{ text:
              `Actúa como Oficial de Triage IEO de un Investigador del TecNM.
              Analiza estas citas/asesorías.

              1. PILAR: DOCENCIA, INVESTIGACION, LABORATORIO, CAMPO o INSTITUCIONAL.
              2. MODALIDAD: "Virtual" (si tiene meetLink o es online) o "Física".
              3. ACCIÓN preparatoria breve (máx 8 palabras).
              4. aiSummary global de 1 línea.

              DATOS: ${JSON.stringify(rawApps.map((c) => ({ id: c.id, name: c.name, type: c.type, hasMeet: !!c.meetLink, location: c.location })))}

              JSON puro: {"analisisCitas":[{"id":"...","pilar":"...","modalidad":"...","accion_sugerida":"..."}],"aiSummary":"..."}`
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
      serviceClient, teacherId: userId, toolName: "sync_appointments", cors,
      errorBody: { success: false, error: "El análisis no pudo mostrarse por una regla de seguridad interna.", aiSummary: "Bloqueado por seguridad." },
    })
    if (guard.blocked) return guard.response

    const enriched = rawApps.map((c) => {
      const ai    = aiData.analisisCitas.find((a) => a.id === c.id)
      const pilar = ai?.pilar ?? "INSTITUCIONAL"
      return {
        ...c,
        pilar,
        modalidad:       ai?.modalidad ?? (c.meetLink ? "Virtual" : "Física"),
        color:           PILAR_COLORS[pilar] ?? PILAR_COLORS.INSTITUCIONAL,
        accion_sugerida: ai?.accion_sugerida ?? "Revisar detalles previos.",
      }
    })

    return new Response(JSON.stringify({ success: true, data: enriched, aiSummary: aiData.aiSummary }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (25s)." : err instanceof Error ? err.message : "Error interno."
    console.error("[sync-appointments]", msg)
    return new Response(JSON.stringify({
      success: false, error: msg, aiSummary: "Error al sincronizar citas.",
    }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } })
  } finally {
    clearTimeout(timeout)
  }
})
