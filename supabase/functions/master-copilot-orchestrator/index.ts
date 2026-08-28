// deno-lint-ignore-file no-import-prefix
/**
 * master-copilot-orchestrator
 * Cerebro conversacional del Master Copilot. Recibe el historial de la
 * conversación + contexto (materia/unidad actual) y responde SIEMPRE en uno
 * de tres formatos: pregunta lo que falta, propone una herramienta concreta
 * lista para confirmar, o solo informa. Nunca ejecuta nada directamente —
 * eso lo hace copilot-execute-tool, y solo después de que el docente confirma.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { COPILOT_TOOLS, findTool, missingParams } from "../_shared/copilotTools.ts"
import { fetchCourseContext, formatCourseContextBlock } from "../_shared/retriever.ts"
import { applyInputGuardrail, applyOutputGuardrail } from "../_shared/guardrail.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { serviceClient } = auth.ctx

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ type: "info", message: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const { messages, scope, course_id, categories, pending_proposal, default_unit_id, preferred_tool } = await req.json()
    if (!messages?.length) throw new Error("Se requiere 'messages'.")

    const effectiveScope = scope ?? "DOCENCIA"
    const availableTools = COPILOT_TOOLS.filter((t) =>
      t.scopes.includes(effectiveScope) && (!categories?.length || categories.includes(t.category))
    )

    // Contexto real de la materia — para resolver "unidad 3" / "el examen de
    // redes" a IDs reales en vez de que la IA los invente. (Recuperador,
    // docs/04_Multi_Agente_MCP.md §2: consulta determinística, sin IA.)
    let contextBlock = ""
    if (course_id) {
      const courseContext = await fetchCourseContext(serviceClient, course_id)
      contextBlock = formatCourseContextBlock(courseContext, default_unit_id)
    }

    const toolsBlock = availableTools.map((t) =>
      `- "${t.name}": ${t.description}\n  Parámetros: ${t.params.map((p) => `${p.name} (${p.type}${p.required ? ', obligatorio' : ', opcional'}): ${p.description}`).join('; ')}`
    ).join('\n')

    // Guardrail de entrada: redacta PII del historial antes de que llegue a
    // Gemini (docs/04_Multi_Agente_MCP.md §3). trustedActor=true porque el
    // remitente ya pasó verifyDocente arriba — no se bloquea, solo se redacta
    // y se deja constancia si hubiese patrones de inyección para revisión.
    const guardrailReasons: string[] = []
    const sanitizedMessages = (messages as { role: string; content: string }[]).map((m) => {
      const scan = applyInputGuardrail(m.content ?? "", true)
      if (scan.reasons.length) guardrailReasons.push(...scan.reasons)
      return { role: m.role, content: scan.safeText }
    })
    const conversationBlock = sanitizedMessages.map((m) => `${m.role === 'user' ? 'DOCENTE' : 'COPILOT'}: ${m.content}`).join('\n')

    const pendingBlock = pending_proposal
      ? `\nPROPUESTA EN EDICIÓN (todavía no se ejecutó nada): ${JSON.stringify(pending_proposal)}\nEl último mensaje del docente es una reacción a ESTA propuesta. Si pide ajustes ("hazlo más corto", "cambia el color", "agrega una sección de..."), modifica esta misma propuesta (mismo tool_name, params ajustados) y devuélvela de nuevo como "proposal". Si en cambio pide algo completamente distinto, ignora esta propuesta y atiende lo nuevo.`
      : ""

    const preferredToolBlock = preferred_tool
      ? `\nEl docente YA eligió en la interfaz qué quiere crear: "${preferred_tool}". Usa esa herramienta directamente — NO preguntes ni propongas otra. Solo pide los parámetros que aún falten para esa herramienta específica.`
      : ""

    const promptText = `Eres el Master Copilot del TecNM: ejecutas acciones reales en la plataforma a partir de instrucciones en lenguaje natural del docente. Módulo activo: ${effectiveScope}.

HERRAMIENTAS DISPONIBLES (la ÚNICA lista de acciones posibles — nunca inventes otras):
${toolsBlock}
${contextBlock}

CONVERSACIÓN HASTA AHORA:
${conversationBlock}
${pendingBlock}
${preferredToolBlock}

INSTRUCCIONES:
1. Si el último mensaje del docente no tiene información suficiente para alguna herramienta, o es ambiguo (ej. no se sabe a qué unidad se refiere), responde tipo "question" pidiendo SOLO lo que falta — una pregunta concisa, no un cuestionario completo.
2. Si ya tienes TODOS los parámetros obligatorios de una herramienta, responde tipo "proposal" listo para confirmar.
3. Si el docente solo está conversando, pidiendo información, o lo que pide no corresponde a ninguna herramienta de la lista, responde tipo "info" explicando qué sí puedes hacer.
4. NUNCA respondas tipo "proposal" si falta un parámetro obligatorio — pregunta primero.
5. CONTROL DE CALIDAD (hazlo tú mismo aquí, no hay una segunda revisión después): los parámetros de texto libre (titulo, contenido, descripcion, tema) deben quedar redactados de forma profesional y propia de un docente universitario — corrígelos tú directamente en el JSON de salida, sin preguntar. Si la instrucción del docente es ofensiva, inapropiada o claramente ajena a un contexto académico, NO generes la propuesta: responde tipo "info" explicando que no puedes redactar eso.
6. Para "crear_rubrica_sheet": diseña tú mismo los "criterios" como especialista en evaluación por competencias. Entre 3 y 5 criterios únicos (sin repetir conceptos), pesos que sumen EXACTAMENTE 100 (no los repartas todos iguales, pondera según importancia pedagógica), y "description" con indicadores de desempeño observables y medibles (mínimo 15 palabras cada uno).
7. Para "crear_material_boveda" y "crear_presentacion_slides": investiga y desarrolla el contenido real sobre el tema — definiciones precisas, ejemplos concretos, datos o cifras cuando aplique. NUNCA dejes puntos vacíos o genéricos tipo "hablar de X" o "explicar Y": cada punto/párrafo debe llevar la información real, lista para leer/exponer. Cuando una cifra, dato o afirmación específica amerite respaldo bibliográfico, NO inventes una cita ni una fuente — inserta el marcador literal "[CITA]" inmediatamente después de esa frase, para que el docente coloque ahí la referencia real.

JSON puro sin markdown, exactamente uno de estos 3 formatos:
{"type":"question","message":"..."}
{"type":"proposal","tool_name":"...","params":{...},"summary":"resumen breve y claro de lo que se va a hacer"}
{"type":"info","message":"..."}`

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
      },
      controller.signal,
    )

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson = await aiRes.json()
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error("Gemini devolvió respuesta vacía.")

    const parsed = JSON.parse(content)

    // Salvaguarda: si propone una herramienta inexistente o le faltan
    // parámetros obligatorios, se baja a pregunta en vez de confiar ciego.
    if (parsed.type === "proposal") {
      const tool = findTool(parsed.tool_name)
      if (!tool) {
        return new Response(
          JSON.stringify({ type: "info", message: "No tengo una herramienta para eso todavía." }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        )
      }
      const missing = missingParams(tool, parsed.params ?? {})
      if (missing.length > 0) {
        return new Response(
          JSON.stringify({ type: "question", message: `Para continuar, necesito: ${missing.join(', ')}.` }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        )
      }
    }

    // Validador (docs/04_Multi_Agente_MCP.md §2/§3): revisa la salida cruda
    // de Gemini antes de devolverla — fuga del propio prompt de sistema se
    // bloquea siempre; una propuesta marcada para revisión humana no se
    // descarta (el docente igual la confirma o no) pero sí queda evidenciada.
    const outputText = JSON.stringify(parsed)
    const outputScan = applyOutputGuardrail(outputText)
    if (!outputScan.allow) {
      guardrailReasons.push(...outputScan.reasons.map((r) => `output:${r}`))
      await serviceClient.from("ai_action_log").insert({
        teacher_id: auth.ctx.userId, tool_name: "master_copilot_orchestrator",
        success: false, metadata: { guardrail_block_output: true, reasons: guardrailReasons },
      }).then(() => {}, () => {})
      return new Response(
        JSON.stringify({ type: "info", message: "La respuesta generada no pudo mostrarse por una regla de seguridad interna. Intenta reformular tu solicitud." }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }
    if (outputScan.requiresHumanReview) guardrailReasons.push(...outputScan.reasons.map((r) => `output_review:${r}`))

    if (guardrailReasons.length) {
      await serviceClient.from("ai_action_log").insert({
        teacher_id: auth.ctx.userId, tool_name: "master_copilot_orchestrator",
        success: true, metadata: { guardrail_reasons: guardrailReasons },
      }).then(() => {}, () => {})
    }

    return new Response(JSON.stringify(parsed), { headers: { ...cors, "Content-Type": "application/json" } })

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout al procesar la solicitud." : err instanceof Error ? err.message : "Error interno."
    console.error("[MASTER_COPILOT_ORCHESTRATOR]", msg)
    return new Response(
      JSON.stringify({ type: "info", message: `Error: ${msg}` }),
      { status: isTimeout ? 504 : 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
