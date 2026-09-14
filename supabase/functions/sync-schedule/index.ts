// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

interface MateriaPayload {
  materia: string
  tipo: "DOCENCIA" | "INVESTIGACION" | "INSTITUCIONAL"
  dias: string[]
  hora: string
  salon: string
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const auth = await verifyUser(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient: svc } = auth.ctx

  const contentType = req.headers.get("content-type") ?? ""

  // ── RUTA A: Extracción multimodal con Gemini (recibe archivo) ─────────────
  if (contentType.includes("multipart/form-data")) {
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
    if (!GEMINI_KEY) return new Response(
      JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    try {
      const formData = await req.formData()
      const file = formData.get("file") as File
      if (!file) throw new Error("No se recibió ningún archivo.")

      const arrayBuffer = await file.arrayBuffer()
      const base64Data  = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      const aiRes = await fetchGeminiWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
            contents: [{
              parts: [
                { text:
                  `Extrae el horario académico de este documento y devuélvelo en JSON.

                  REGLAS:
                  - "tipo": "DOCENCIA" (clases), "INVESTIGACION" (laboratorio/tesis), "INSTITUCIONAL" (reuniones).
                  - "dias": array de strings ["Lunes","Miércoles"].
                  - "hora": formato "HH:MM - HH:MM".
                  - "salon": extraer del documento o "Por definir".

                  JSON puro: {"materias":[{"materia":"...","tipo":"DOCENCIA","dias":["..."],"hora":"HH:MM - HH:MM","salon":"..."}]}`
                },
                { inlineData: { data: base64Data, mimeType: file.type } },
              ],
            }],
            generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
        },
        controller.signal,
      )
      if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
      const aiJson  = await aiRes.json()
      const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
      if (!content) throw new Error("Gemini devolvió respuesta vacía.")

      const scheduleData = JSON.parse(content)

      const guard = await guardOutputOrBlock(JSON.stringify(scheduleData), {
        serviceClient: svc, teacherId: userId, toolName: "sync_schedule_extract", cors,
        errorBody: { success: false, error: "La extracción no pudo mostrarse por una regla de seguridad interna." },
      })
      if (guard.blocked) return guard.response

      return new Response(JSON.stringify({ success: true, data: scheduleData.materias }), {
        headers: { ...cors, "Content-Type": "application/json" },
      })

    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === "AbortError"
      const msg = isTimeout ? "Timeout (30s) al procesar el archivo." : err instanceof Error ? err.message : "Error interno."
      console.error("[sync-schedule:extract]", msg)
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  // ── RUTA B: Guardar horario confirmado en DB ───────────────────────────────
  if (contentType.includes("application/json")) {
    let action: string, payload: { materias?: MateriaPayload[] }
    try {
      const body = await req.json()
      action  = body.action  ?? ""
      payload = body.payload ?? {}
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Cuerpo inválido." }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    if (action !== "guardarHorario") return new Response(
      JSON.stringify({ success: false, error: `Acción no reconocida: ${action}` }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const materiasAInsertar = (payload.materias ?? []).map((m: MateriaPayload) => {
      const [hora_inicio, hora_fin] = m.hora.split(" - ")
      return {
        teacher_id:  userId,          // siempre del JWT — nunca del cliente
        materia:     m.materia,
        tipo:        m.tipo || "DOCENCIA",
        dias:        m.dias,
        hora_inicio: hora_inicio?.trim(),
        hora_fin:    hora_fin?.trim(),
        salon:       m.salon,
      }
    })

    const { error: dbError } = await svc.from("horarios_docente").insert(materiasAInsertar)
    if (dbError) {
      console.error("[sync-schedule:guardar]", dbError)
      return new Response(JSON.stringify({ success: false, error: dbError.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  return new Response(
    JSON.stringify({ success: false, error: "Content-Type no soportado." }),
    { status: 415, headers: { ...cors, "Content-Type": "application/json" } }
  )
})
