// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 28_000)

  try {
    // Acepta JSON normal (solo título/descripción) o multipart/form-data si
    // el docente adjunta un archivo de la actividad (con puntajes, etc.) para
    // que la IA lo lea y lo use de contexto extra al sugerir la rúbrica.
    const contentType = req.headers.get("content-type") ?? ""
    let title = ""
    let description = ""
    let filePart: { inlineData: { data: string; mimeType: string } } | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      title = String(formData.get("title") ?? "")
      description = String(formData.get("description") ?? "")
      const file = formData.get("archivo") as File | null

      if (file) {
        const arrayBuffer = await file.arrayBuffer()
        const base64Data  = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        const mimeType    = file.type || "application/pdf"
        filePart = { inlineData: { data: base64Data, mimeType } }
      }
    } else {
      const body = await req.json()
      title = body.title ?? ""
      description = body.description ?? ""
    }

    if (!title) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'title'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const promptText =
      `Eres especialista en diseño instruccional por competencias del Tecnológico Nacional de México (TecNM).
      Diseña una rúbrica analítica para evaluar la siguiente actividad de nivel ingeniería.

      ACTIVIDAD: ${title}
      DESCRIPCIÓN: ${description || "Sin instrucciones adicionales. Infiere criterios apropiados del título."}
      ${filePart ? "\nADJUNTO: el docente adjuntó el documento original de la actividad (instrucciones, puntajes y/o rúbrica previa, si tenía). Léelo completo y usa su contenido real como base — si ya trae una distribución de puntos, respétala lo más posible en vez de inventar una nueva." : ""}

      REQUISITOS ESTRICTOS:
      - Entre 3 y 5 criterios únicos. Cada criterio mide una competencia distinta; no repitas conceptos.
      - Ejemplos de dimensiones válidas: fundamentación teórica, aplicación metodológica, análisis crítico, claridad expositiva, uso de fuentes.
      - Los pesos deben sumar EXACTAMENTE 100. Si son 4 criterios no pongas todos en 25; distribuye según importancia pedagógica.
      - "description" de cada criterio: describe los indicadores de desempeño observables (qué hace el alumno para obtener el puntaje máximo). Mínimo 15 palabras.
      - Nombres de criterio: sustantivos profesionales concretos (ej: "Fundamentación Teórica", no "Teoría").
      - No incluyas criterios de formato o presentación a menos que la actividad lo requiera explícitamente.

      JSON puro sin markdown, array de criterios:
      [{"id":1,"name":"Nombre del Criterio","description":"Indicadores de desempeño observables y medibles para este criterio.","weight":35}]`

    const parts: unknown[] = filePart ? [filePart, { text: promptText }] : [{ text: promptText }]

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
      },
      controller.signal,
    )

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson = await aiRes.json()
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error("Gemini devolvió respuesta vacía.")

    const rubrics = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(rubrics), {
      serviceClient, teacherId: userId, toolName: "generate_rubric_ia", cors,
      errorBody: { success: false, error: "La rúbrica no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({ success: true, rubrics }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout generando rúbrica." : err instanceof Error ? err.message : "Error interno."
    console.error("[GENERATE_RUBRIC_IA]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
