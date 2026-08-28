// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

interface RawTask { id: string; t: string; d: string; p: string; completed: boolean }
interface AITaskAnalysis { id: string; pilar: string; prioridad_ieo: string; sugerencia_tactica: string }
interface AIResponse { analisisTareas: AITaskAnalysis[]; aiSummary: string }

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

  let action: string, payload: Record<string, unknown>
  try {
    const body = await req.json()
    action  = body.action  ?? ""
    payload = body.payload ?? {}
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Cuerpo inválido." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    })
  }

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
      body:    JSON.stringify({ secret: WEBHOOK_SECRET, action, payload }),
      signal:  controller.signal,
    })
    if (!googleRes.ok) throw new Error(`Apps Script respondió ${googleRes.status}`)
    const result = await googleRes.json()

    // Listas: no necesita Gemini, devuelve directo
    if (action === "obtenerListasTareas") {
      return new Response(JSON.stringify(result), {
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    // Tareas: aplicar triage IA solo a pendientes
    if (action === "obtenerTareasPorLista") {
      const rawTasks: RawTask[] = result.data || []
      const pending = rawTasks.filter((t) => !t.completed)

      if (pending.length === 0) {
        return new Response(JSON.stringify({
          success: true, data: rawTasks,
          aiSummary: "Lista despejada. No hay pendientes que requieran triage.",
        }), { headers: { ...cors, "Content-Type": "application/json" } })
      }

      const aiRes = await fetchGeminiWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
            contents: [{
              parts: [{ text:
                `Actúa como Oficial de Triage IEO de un Investigador del TecNM.
                Re-evalúa estas tareas pendientes.

                1. Asigna PILAR: DOCENCIA, INVESTIGACION, LABORATORIO, CAMPO, INSTITUCIONAL.
                2. Re-evalúa PRIORIDAD: "Alta", "Media" o "Baja".
                3. sugerencia_tactica muy breve (máx 10 palabras).
                4. aiSummary global de 1 línea.

                DATOS: ${JSON.stringify(pending.map((t) => ({ id: t.id, titulo: t.t, fecha: t.d })))}

                JSON puro: {"analisisTareas":[{"id":"...","pilar":"...","prioridad_ieo":"Alta","sugerencia_tactica":"..."}],"aiSummary":"..."}`
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
        serviceClient, teacherId: userId, toolName: "sync_tasks", cors,
        errorBody: { success: false, error: "El triage no pudo mostrarse por una regla de seguridad interna.", aiSummary: "Bloqueado por seguridad." },
      })
      if (guard.blocked) return guard.response

      const enriched = rawTasks.map((t) => {
        if (t.completed) return { ...t, pilar: "INSTITUCIONAL", sugerencia_tactica: "Completada" }
        const ai   = aiData.analisisTareas.find((a) => a.id === t.id)
        const pilar = ai?.pilar ?? "INSTITUCIONAL"
        return {
          ...t,
          pilar,
          color:              PILAR_COLORS[pilar] ?? PILAR_COLORS.INSTITUCIONAL,
          p:                  ai?.prioridad_ieo ?? t.p,
          sugerencia_tactica: ai?.sugerencia_tactica ?? "Pendiente de revisión",
        }
      })

      return new Response(JSON.stringify({ success: true, data: enriched, aiSummary: aiData.aiSummary }), {
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ success: false, error: `Acción no reconocida: ${action}` }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    })

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (25s)." : err instanceof Error ? err.message : "Error interno."
    console.error("[sync-tasks]", msg)
    return new Response(JSON.stringify({ success: false, error: msg, aiSummary: "Error de sincronización." }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    })
  } finally {
    clearTimeout(timeout)
  }
})
