// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

interface Email { id: string; from: string; subject: string; snippet: string }
interface AIClassification { id: string; categoria: string; prioridad: number; resumen_ejecutivo: string }

const CATEGORY_COLORS: Record<string, string> = {
  DOCENCIA:      "#1B396A",
  INVESTIGACION: "#7C3AED",
  INSTITUCIONAL: "#64748b",
  PERSONAL:      "#94a3b8",
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

  if (!APPS_SCRIPT_URL) return new Response(
    JSON.stringify({ success: false, error: "APPS_SCRIPT_URL no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  // ── 2. AbortController cubre ambas llamadas externas ──────────────────────
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    // a) Obtener correos desde Apps Script
    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ secret: WEBHOOK_SECRET, action: "obtenerCorreos", payload: {} }),
      signal:  controller.signal,
    })
    if (!googleRes.ok) throw new Error(`Apps Script respondió ${googleRes.status}`)
    const result = await googleRes.json()
    const emails: Email[] = result.data || []

    if (emails.length === 0) {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    // b) Clasificar con Gemini
    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
          contents: [{
            parts: [{ text:
              `Actúa como Oficial de Triage IEO de un Investigador del TecNM.
              Clasifica estos correos en: DOCENCIA (alumnos, aulas), INVESTIGACION (papers, tesis, convocatorias), INSTITUCIONAL (avisos TecNM, nóminas), PERSONAL (spam, externo).

              DATOS: ${JSON.stringify(emails.map(e => ({ id: e.id, from: e.from, subject: e.subject, snippet: e.snippet })))}

              Responde JSON puro: [{"id":"...","categoria":"...","prioridad":1-5,"resumen_ejecutivo":"..."}]`
            }]
          }],
          generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
      },
      controller.signal,
    )
    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)

    const aiJson   = await aiRes.json()
    const content  = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error("Gemini devolvió respuesta vacía.")

    const classifications: AIClassification[] = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(classifications), {
      serviceClient, teacherId: userId, toolName: "sync_correo", cors,
      errorBody: { success: false, error: "La clasificación no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    const enriched = emails.map((m) => {
      const ai = classifications.find((c) => c.id === m.id)
      const categoria = ai?.categoria ?? "PERSONAL"
      return {
        ...m,
        aiCategory: categoria,
        priority:   ai?.prioridad ?? 3,
        brief:      ai?.resumen_ejecutivo ?? m.snippet,
        color:      CATEGORY_COLORS[categoria] ?? CATEGORY_COLORS.PERSONAL,
      }
    })

    return new Response(JSON.stringify({ success: true, data: enriched }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (25s) al contactar Google." : err instanceof Error ? err.message : "Error interno."
    console.error("[sync-correo]", msg)
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    })
  } finally {
    clearTimeout(timeout)
  }
})
