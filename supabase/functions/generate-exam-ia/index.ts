// @ts-nocheck
// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { cacheGet, cacheSet, checkRateLimit, sha256Hex } from "../_shared/cache.ts"
import { applyInputGuardrail, guardOutputOrBlock } from "../_shared/guardrail.ts"

// 6h (1.3 de docs/01_ARQUITECTURA_DEVOPS_FRUGAL.md)
const AI_RESPONSE_CACHE_TTL_SECONDS = 6 * 60 * 60
const RATE_LIMIT_MAX_CALLS = 15
const RATE_LIMIT_WINDOW_SECONDS = 60

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  // ── 1.b Rate limit por docente ──────────────────────────────────────────
  const rateLimit = await checkRateLimit(`ratelimit:generate-exam-ia:${userId}`, RATE_LIMIT_MAX_CALLS, RATE_LIMIT_WINDOW_SECONDS)
  if (!rateLimit.allowed) return new Response(
    JSON.stringify({ success: false, error: `Límite de ${RATE_LIMIT_MAX_CALLS} llamadas/min alcanzado. Intenta de nuevo en unos segundos.` }),
    { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) } }
  )

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)

  try {
    const contentType = req.headers.get("content-type") ?? ""
    let prompt = ""
    let instruction = ""
    let mode = "generate" // "generate" | "regenerate_single"
    let currentCount = 0
    let count = 5
    let difficulty = "intermedia"
    let questionTypes: string[] = []
    let currentQuestions: unknown[] = []
    let targetQuestion: Record<string, unknown> | null = null
    let filePart: { inlineData: { data: string; mimeType: string } } | null = null
    let extractedText = ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      prompt = String(formData.get("prompt") ?? "")
      instruction = String(formData.get("instruction") ?? prompt)
      mode = String(formData.get("mode") ?? "generate")
      currentCount = parseInt(String(formData.get("currentCount") ?? "0"), 10) || 0
      count = parseInt(String(formData.get("count") ?? "5"), 10) || 5
      difficulty = String(formData.get("difficulty") ?? "intermedia")

      try {
        questionTypes = JSON.parse(String(formData.get("question_types") ?? "[]"))
      } catch {
        questionTypes = []
      }

      try {
        currentQuestions = JSON.parse(String(formData.get("current_questions") ?? "[]"))
      } catch {
        currentQuestions = []
      }

      try {
        const qRaw = formData.get("question")
        targetQuestion = qRaw ? JSON.parse(String(qRaw)) : null
      } catch {
        targetQuestion = null
      }

      const file = formData.get("archivo") as File | null
      if (file) {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const fileName = file.name?.toLowerCase() ?? ""
          const mimeType = file.type?.toLowerCase() ?? ""

          const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf")
          const isImage = mimeType.startsWith("image/")
          const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".ods") || mimeType.includes("spreadsheet") || mimeType.includes("excel")
          const isDocx = fileName.endsWith(".docx") || mimeType.includes("wordprocessingml")

          if (isPdf || isImage) {
            const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
            filePart = { inlineData: { data: base64Data, mimeType: isPdf ? "application/pdf" : mimeType } }
          } else if (isExcel) {
            const XLSX = await import("https://esm.sh/xlsx@0.18.5")
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" })
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
            extractedText = XLSX.utils.sheet_to_csv(firstSheet)
          } else if (isDocx) {
            const mammoth = await import("https://esm.sh/mammoth@1.7.0")
            const result = await mammoth.extractRawText({ arrayBuffer })
            extractedText = result.value
          } else {
            extractedText = new TextDecoder().decode(arrayBuffer)
          }
        } catch (fileErr) {
          console.error("[GENERATE_EXAM_IA] Error extrayendo archivo adjunto:", fileErr)
          return new Response(
            JSON.stringify({
              success: false,
              unreadable_file: true,
              error: "No se pudo leer el archivo adjunto (puede estar protegido, dañado o no soportado). Puedes reintentar con otro archivo o continuar usando solo texto."
            }),
            { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
          )
        }
      }
    } else {
      const body = await req.json()
      prompt = body.prompt ?? ""
      instruction = body.instruction ?? prompt
      mode = body.mode ?? "generate"
      currentCount = body.currentCount ?? (Array.isArray(body.current_questions) ? body.current_questions.length : 0)
      count = body.count ?? 5
      difficulty = body.difficulty ?? "intermedia"
      questionTypes = Array.isArray(body.question_types) ? body.question_types : []
      currentQuestions = Array.isArray(body.current_questions) ? body.current_questions : []
      targetQuestion = body.question ?? null
    }

    // ── 2. MODO: REGENERAR PREGUNTA INDIVIDUAL AISLADA ───────────────────────
    if (mode === "regenerate_single" && targetQuestion) {
      const targetBloom = difficulty === "basica" ? "Recordar o Comprender" : difficulty === "avanzada" ? "Evaluar o Crear" : "Aplicar o Analizar"
      const safeSingleInstruction = instruction ? applyInputGuardrail(instruction, true).safeText : ""
      const singlePrompt = `Eres Diseñador Curricular certificado del TecNM especializado en evaluación por competencias.
Genera una variante pedagógica mejorada y rigurosa para el siguiente reactivo de examen universitario de ingeniería:

REACTIVO PREVIO:
${JSON.stringify(targetQuestion, null, 2)}

NIVEL DE DIFICULTAD / BLOOM SOLICITADO: ${targetBloom} (${difficulty})
${safeSingleInstruction ? `INSTRUCCIÓN ESPECÍFICA DEL DOCENTE: "${safeSingleInstruction}"` : "Genera una nueva versión de alta calidad técnica sobre el mismo concepto o los temas indicados."}

REGLAS ESTRICTAS:
1. Devuelve EXACTAMENTE 1 solo reactivo completo.
2. El campo "type" debe ser uno de estos 8 en inglés: multiple_choice, true_false, open, matching, short_answer, fill_blank, ordering, multi_select. (Conserva el tipo original a menos que la instrucción pida otro).
3. Lenguaje técnico preciso de ingeniería sin ambigüedades.
4. "points": conserva ${targetQuestion.points ?? 10} puntos.
5. "bloom": asigna el nivel de Bloom correspondiente ("Recordar", "Comprender", "Aplicar", "Analizar", "Evaluar", "Crear").

Devuelve ÚNICAMENTE un JSON puro sin bloques de código ni markdown:
{"question": {"type":"multiple_choice","content":"...","options":["A","B","C","D"],"answer":"A","points":${targetQuestion.points ?? 10},"bloom":"${targetBloom}"}}`

      const aiRes = await fetchGeminiWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          contents: [{ parts: [{ text: singlePrompt }] }],
          generationConfig: { response_mime_type: "application/json", temperature: 0.3 },
        },
        controller.signal,
      )

      if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
      const aiJson = await aiRes.json()
      const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
      if (!content) throw new Error("Gemini devolvió respuesta vacía.")

      const parsed = JSON.parse(content)
      const qResult = parsed.question || parsed

      const guard = await guardOutputOrBlock(JSON.stringify(qResult), {
        serviceClient, teacherId: userId, toolName: "generate_exam_ia_single", cors,
        errorBody: { success: false, error: "El reactivo no pudo mostrarse por una regla de seguridad interna." },
      })
      if (guard.blocked) return guard.response

      return new Response(
        JSON.stringify({ success: true, question: qResult }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 3. MODO: GENERACIÓN O AJUSTE MULTI-TURNO ───────────────────────────
    const finalInstruction = instruction || prompt
    if (!finalInstruction && !filePart && !extractedText) {
      return new Response(
        JSON.stringify({ success: false, error: "Se requiere un tema, instrucción o archivo adjunto." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const safeFinalInstruction = finalInstruction ? applyInputGuardrail(finalInstruction, true).safeText : ""
    let safeExtractedText = ""
    if (extractedText) {
      const extGuard = applyInputGuardrail(extractedText, false)
      if (extGuard.block) {
        return new Response(
          JSON.stringify({ success: false, error: "Contenido del archivo bloqueado por sospecha de inyección de prompt." }),
          { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
        )
      }
      safeExtractedText = extGuard.safeText
    }

    const hasCurrentQuestions = Array.isArray(currentQuestions) && currentQuestions.length > 0
    const pointsPerQuestion = Math.max(1, Math.round(100 / (hasCurrentQuestions ? currentQuestions.length : count)))

    const promptText = `Eres Diseñador Curricular certificado del TecNM especializado en evaluación por competencias.
Genera o ajusta reactivos de examen para nivel ingeniería universitaria superior.

${hasCurrentQuestions ? `REACTIVOS YA TRABAJADOS PREVIAMENTE EN EL CHAT (${currentQuestions.length} reactivos):\n${JSON.stringify(currentQuestions, null, 2)}\n\nPETICIÓN DEL DOCENTE EN ESTE TURNO:\n"${safeFinalInstruction}"\n\nREGLA CLAVE DE AJUSTE CONTEXTUAL:\nModifica, agrega o reemplaza reactivos según lo solicitado en este turno, pero CONSERVA todos los reactivos existentes no mencionados. Devuelve la lista completa actualizada de reactivos en "questions".` : `TEMA O DIRECTIVA DEL DOCENTE:\n"${safeFinalInstruction}"\nCANTIDAD DE REACTIVOS A GENERAR: ${count}\nDIFICULTAD GENERAL: ${difficulty}\nTIPOS DE REACTIVO SOLICITADOS: ${questionTypes.length > 0 ? questionTypes.join(", ") : "multiple_choice, true_false, open"}`}

${safeExtractedText ? `\nCONTENIDO EXTRAÍDO DEL DOCUMENTO ADJUNTO:\n${safeExtractedText.slice(0, 25000)}` : ""}
${filePart ? `\n(Se adjuntó un archivo/imagen de referencia. Úsalo como fuente de conceptos y temario para las preguntas).` : ""}

REGLAS DE GENERACIÓN — APLICA TODAS SIN EXCEPCIÓN:
1. Cantidad: si es generación inicial, genera exactamente ${count} reactivos. Si es un turno incremental de ajuste, aplica las modificaciones y mantén el total coherente.
2. Dificultad y Taxonomía de Bloom:
   - Dificultad "basica": enfatiza niveles Recordar y Comprender.
   - Dificultad "intermedia": ≥ 60% en Aplicar y Analizar.
   - Dificultad "avanzada": ≥ 50% en Evaluar y Diseñar/Crear.
3. Lenguaje técnico riguroso. Sin ambigüedades.
4. El campo "type" debe ser EXACTAMENTE uno de estos 8 valores en inglés (enum de base de datos):
   - "multiple_choice": 4 opciones en "options". "answer" debe coincidir con una de ellas.
   - "true_false": afirmación técnica clara. "answer": "Verdadero" o "Falso".
   - "open": "answer" es la GUÍA DE EVALUACIÓN para el docente (conceptos clave esperados).
   - "matching": "left" (conceptos), "right" (definiciones en mismo orden que left), "correct" (array [0, 1, 2...]).
   - "short_answer": "options" = array de variantes aceptadas (sinónimo técnico, con/sin acento).
   - "fill_blank": "content" con espacios como "___". "options" = respuestas por hueco en orden.
   - "ordering": "options" = elementos en su orden correcto.
   - "multi_select": "options" = 4-5 opciones, "correct" = array de opciones que son correctas.
5. "points": asigna un puntaje entero (por ejemplo ${pointsPerQuestion} pts por reactivo) de modo que todos sumen aproximadamente 100 puntos en total.
6. "bloom": nivel de Bloom ("Recordar", "Comprender", "Aplicar", "Analizar", "Evaluar", "Crear").

JSON puro sin markdown:
{"questions":[
  {"type":"multiple_choice","content":"Enunciado técnico...","options":["Opción A","Opción B","Opción C","Opción D"],"answer":"Opción A","points":${pointsPerQuestion},"bloom":"Aplicar"}
]}`

    const parts: unknown[] = filePart ? [filePart, { text: promptText }] : [{ text: promptText }]

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.3 },
      },
      controller.signal,
    )

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson = await aiRes.json()
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error("Gemini devolvió respuesta vacía.")

    const parsed = JSON.parse(content)
    const questionsList = Array.isArray(parsed.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : []

    const guard = await guardOutputOrBlock(JSON.stringify(questionsList), {
      serviceClient, teacherId: userId, toolName: "generate_exam_ia", cors,
      errorBody: { success: false, error: "Los reactivos no pudieron mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({ success: true, questions: questionsList }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (90s) generando reactivos." : err instanceof Error ? err.message : "Error interno."
    console.error("[GENERATE_EXAM_IA]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
