/**
 * Blueprint de fallback a un SLM local (self-hosted) cuando el circuit
 * breaker de Gemini está abierto (ver gemini.ts) — para instituciones que
 * quieran seguir operando sin depender de una API externa cuando Gemini
 * falla, se agota la cuota, o se corta la conexión a internet.
 *
 * DESACTIVADO POR DEFECTO. Si la variable de entorno LOCAL_SLM_URL no está
 * definida, esta función ni siquiera intenta conectarse — no es un
 * requisito para correr el proyecto, es una opción para quien decida montar
 * su propio servidor de inferencia. Ver
 * qa-05a-doublecheck/03-ROADMAP-DESPLIEGUE.md para el setup de ese servidor
 * (esto es infraestructura, no código — no es parte de este archivo).
 *
 * Contrato esperado del servidor local: API compatible con OpenAI Chat
 * Completions (`POST {LOCAL_SLM_URL}/v1/chat/completions`) — el mismo
 * contrato que ya implementan Ollama, LM Studio, vLLM y
 * text-generation-webui, entre otros. No se ató este blueprint a un
 * servidor específico a propósito: cualquiera de esos sirve con solo
 * apuntar LOCAL_SLM_URL a su dirección.
 *
 * LIMITACIÓN CONOCIDA (documentada a propósito, no oculta): SOLO texto. Las
 * ~25 funciones que llaman a Gemini a veces mandan `inline_data` (PDFs/
 * imágenes) junto con texto — esas partes NO se envían al SLM local (la
 * mayoría de modelos open-source pequeños tampoco son multimodales). Si el
 * prompt dependía enteramente del archivo adjunto (ej. "evalúa este PDF"),
 * la respuesta del SLM local va a ser peor que la de Gemini — es un
 * fallback de continuidad de servicio (que el sistema siga respondiendo
 * ALGO en vez de un error 500), no un reemplazo con paridad de capacidades.
 * Cada respuesta marca `_localSlmFallback: true` y `_droppedBinaryParts`
 * para que quien audite logs sepa cuándo se usó y qué se perdió.
 */

export interface GeminiPart {
  text?: string
  inline_data?: { mime_type: string; data: string }
}

export interface GeminiContent {
  role?: string
  parts: GeminiPart[]
}

export interface GeminiRequestBody {
  contents?: GeminiContent[]
  generationConfig?: { response_mime_type?: string; temperature?: number; [k: string]: unknown }
  systemInstruction?: GeminiContent
  [k: string]: unknown
}

/** true si hay un endpoint de SLM local configurado (env var presente). */
export function isLocalSlmConfigured(): boolean {
  return !!Deno.env.get("LOCAL_SLM_URL")
}

function extractText(body: GeminiRequestBody): { text: string; droppedBinaryParts: number } {
  let droppedBinaryParts = 0
  const chunks: string[] = []
  if (body.systemInstruction?.parts) {
    for (const p of body.systemInstruction.parts) if (p.text) chunks.push(`[Instrucción del sistema]\n${p.text}`)
  }
  for (const content of body.contents ?? []) {
    for (const part of content.parts ?? []) {
      if (part.text) chunks.push(part.text)
      else if (part.inline_data) droppedBinaryParts++
    }
  }
  return { text: chunks.join("\n\n"), droppedBinaryParts }
}

/**
 * Envía el subconjunto de texto de una petición con forma de Gemini a un
 * servidor OpenAI-compatible, y devuelve una Response con la MISMA forma
 * que la API de Gemini (`candidates[0].content.parts[0].text`) — así
 * ninguno de los ~25 callers de fetchGeminiWithRetry necesita saber si
 * respondió Gemini o el SLM local, ambos se parsean exactamente igual
 * (`aiJson.candidates?.[0]?.content?.parts?.[0]?.text`, el patrón que ya
 * usan todos ellos).
 */
export async function callLocalSlmAsGeminiShape(body: GeminiRequestBody, signal: AbortSignal): Promise<Response> {
  const url = Deno.env.get("LOCAL_SLM_URL")
  if (!url) {
    return new Response(
      JSON.stringify({ error: { message: "LOCAL_SLM_URL no configurado — no hay SLM local disponible como fallback." } }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )
  }
  const model = Deno.env.get("LOCAL_SLM_MODEL") ?? "llama3"
  const apiKey = Deno.env.get("LOCAL_SLM_API_KEY") // opcional — la mayoría de servidores locales no la piden

  const { text, droppedBinaryParts } = extractText(body)
  const wantsJson = body.generationConfig?.response_mime_type === "application/json"
  const messages = [
    ...(wantsJson
      ? [{ role: "system", content: "Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de markdown." }]
      : []),
    { role: "user", content: text },
  ]

  let res: Response
  try {
    res = await fetch(`${url.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model, messages, temperature: body.generationConfig?.temperature ?? 0.2 }),
      signal,
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: `SLM local inalcanzable en ${url}: ${err instanceof Error ? err.message : String(err)}` } }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    return new Response(
      JSON.stringify({ error: { message: `SLM local respondió ${res.status}: ${errText.slice(0, 500)}` } }),
      { status: res.status, headers: { "Content-Type": "application/json" } },
    )
  }

  let openaiJson: { choices?: { message?: { content?: string } }[] }
  try {
    openaiJson = await res.json()
  } catch {
    return new Response(
      JSON.stringify({ error: { message: "SLM local respondió un cuerpo que no es JSON válido." } }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )
  }
  const textOut = openaiJson.choices?.[0]?.message?.content ?? ""

  const geminiShaped = {
    candidates: [{ content: { parts: [{ text: textOut }], role: "model" }, finishReason: "STOP" }],
    _localSlmFallback: true, // marca honesta: quien inspeccione la respuesta cruda sabe que no vino de Gemini
    _droppedBinaryParts: droppedBinaryParts,
  }
  return new Response(JSON.stringify(geminiShaped), { status: 200, headers: { "Content-Type": "application/json" } })
}
