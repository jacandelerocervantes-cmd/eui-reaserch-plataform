// deno-lint-ignore-file no-import-prefix
/**
 * intelligent-file-parser
 * Extrae la estructura de un Syllabus (PDF/Word) usando Gemini 2.5 Flash.
 * Devuelve unidades, criterios de evaluación y competencias.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { validateFileBytes, type DeclaredKind } from "../_shared/fileValidation.ts"
import { applyInputGuardrail, guardOutputOrBlock } from "../_shared/guardrail.ts"
import { extractTextWithOcr } from "../_shared/ocrClient.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const auth = await verifyUser(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

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
    const bytes       = new Uint8Array(arrayBuffer)

    // El input del frontend solo acepta .pdf/.doc/.docx — se verifica que
    // los bytes reales coincidan antes de gastar una llamada a Gemini con
    // contenido que puede no ser lo que dice ser.
    const mimeType = file.type?.toLowerCase() ?? ""
    const fileName = file.name?.toLowerCase() ?? ""
    const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf")
    const declaredKind: DeclaredKind = isPdf ? "pdf" : "office"
    const fileCheck = validateFileBytes(bytes, declaredKind)
    if (!fileCheck.ok) throw new Error(fileCheck.reason)

    const base64Data  = btoa(String.fromCharCode(...bytes))

    // ── OCR previo (docs/05_OCR_Unlimited_Integracion.md) ─────────────────
    // Si el cliente OCR está disponible (breaker cerrado, dentro del rate
    // limit diario), se usa para extraer texto plano y correr el guardrail
    // de ENTRADA sobre él — algo antes imposible porque el archivo viaja
    // como binario directo a Gemini (ver docs/04_Multi_Agente_MCP.md §4.6).
    // trustedActor=true: quien sube el syllabus ya pasó verifyUser, así que
    // solo se redacta PII (para logging), nunca se bloquea por esto — mismo
    // criterio que master-copilot-orchestrator/iot-copilot. Si el OCR NO
    // está disponible (no configurado, breaker abierto, rate limit
    // agotado, o el archivo no es PDF), el comportamiento es EXACTAMENTE el
    // de antes: el binario se manda directo a Gemini sin este paso extra.
    if (isPdf) {
      const ocrResult = await extractTextWithOcr(bytes, controller.signal)
      if (ocrResult.available) {
        const guard = applyInputGuardrail(ocrResult.text, true)
        if (guard.reasons.length) {
          await serviceClient.from("ai_action_log").insert({
            teacher_id: userId, tool_name: "intelligent_file_parser",
            success: true, metadata: { guardrail_reasons: guard.reasons.map((r) => `ocr_input:${r}`) },
          }).then(() => {}, () => {})
        }
      }
    }

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
          contents: [{
            parts: [
              { text:
                `Analiza este Syllabus oficial del TecNM y extrae su estructura académica completa.

                Devuelve JSON puro con este formato exacto:
                {
                  "nombre": "Nombre oficial de la materia",
                  "clave": "Clave (ej. AEF-1001)",
                  "unidades": [
                    {
                      "id": 1,
                      "nombre": "Nombre de la unidad",
                      "criterios": [
                        { "nombre": "Nombre del criterio de evaluación", "peso": 30 }
                      ]
                    }
                  ],
                  "competencias": ["Competencia 1", "Competencia 2"]
                }

                Si no encuentras algún campo, usa un string vacío o array vacío según corresponda.
                Los pesos de criterios deben sumar 100 por unidad.
                Sin texto adicional ni markdown.`
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

    const parsed = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(parsed), {
      serviceClient, teacherId: userId, toolName: "intelligent_file_parser", cors,
      errorBody: { success: false, error: "La estructura extraída no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (30s) al procesar el syllabus." : err instanceof Error ? err.message : "Error interno."
    console.error("[intelligent-file-parser]", msg)
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 502, headers: { ...cors, "Content-Type": "application/json" },
    })
  } finally {
    clearTimeout(timeout)
  }
})
