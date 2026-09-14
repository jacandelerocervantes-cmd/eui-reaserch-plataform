// deno-lint-ignore-file no-import-prefix
/**
 * iot-copilot
 * Asistente conversacional de IoT para el módulo de Laboratorio. A diferencia
 * de ingest-telemetry (que solo recibe lecturas), esta función AYUDA A
 * DISEÑAR, CONFIGURAR Y PROGRAMAR sensores: qué hardware usar, cómo cablearlo,
 * y código real (Arduino/ESP32/MicroPython/Raspberry Pi) ya listo para
 * publicar hacia el endpoint ingest-telemetry de esta misma plataforma —
 * no consejos genéricos desconectados del stack real del docente.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { applyInputGuardrail, guardOutputOrBlock } from "../_shared/guardrail.ts"

type ChatMessage = { role: "user" | "assistant"; content: string }

const MAX_MESSAGES = 40
const MAX_MESSAGE_LENGTH = 4000

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Método no permitido, usa POST." }),
      { status: 405, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { serviceClient, user, userId } = auth.ctx

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 28_000)

  try {
    // ── 1. Validación de entrada ────────────────────────────────────────────
    let body: { messages?: ChatMessage[] }
    try {
      body = await req.json()
    } catch {
      throw new Error("Body inválido: se esperaba JSON.")
    }

    const messages = body?.messages as ChatMessage[] | undefined
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Se requiere 'messages' (arreglo no vacío de {role, content}).")
    }
    if (messages.length > MAX_MESSAGES) {
      throw new Error(`Conversación demasiado larga (máx. ${MAX_MESSAGES} mensajes). Inicia un chat nuevo.`)
    }
    for (const m of messages) {
      if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
        throw new Error("Cada mensaje debe tener role 'user'|'assistant' y content de tipo string.")
      }
      if (m.content.length > MAX_MESSAGE_LENGTH) {
        throw new Error(`Un mensaje excede ${MAX_MESSAGE_LENGTH} caracteres.`)
      }
    }

    // ── 2. Contexto real del laboratorio del docente ───────────────────────
    // Para que el copiloto pueda referirse a sensores/lecturas reales en vez
    // de inventar sensor_ids, y para poder diagnosticar anomalías reales.
    let contextBlock = ""
    try {
      const [{ data: equipos }, { data: lecturas }] = await Promise.all([
        serviceClient
          .from("equipos_lab")
          .select("id, nombre, tipo, estado")
          .eq("docente_responsable_id", user.id)
          .limit(30),
        serviceClient
          .from("telemetria_iot")
          .select("sensor_id, tipo, valor, unidad, alert_level, created_at")
          .order("created_at", { ascending: false })
          .limit(15),
      ])

      contextBlock = `
EQUIPO DE LABORATORIO REGISTRADO POR EL DOCENTE: ${JSON.stringify(equipos ?? [])}
ÚLTIMAS LECTURAS DE TELEMETRÍA REALES (más reciente primero): ${JSON.stringify(lecturas ?? [])}
Si el docente pregunta por qué un sensor marca alerta, o pide ayuda para depurar uno en específico, usa estos datos reales — no inventes valores ni sensor_id que no aparezcan aquí.`
    } catch (ctxErr) {
      // El contexto es un plus, no un requisito — si falla la consulta de
      // contexto, seguimos igual sin bloquear la conversación por eso.
      console.error("[IOT_COPILOT] contexto no disponible:", ctxErr)
      contextBlock = "\n(No se pudo cargar el inventario/telemetría real en este momento; responde en términos generales y acláraselo al docente si es relevante.)"
    }

    // Guardrail de entrada: redacta PII del historial (trustedActor=true, ya
    // pasó verifyDocente arriba — mismo criterio que master-copilot-orchestrator).
    const sanitizedMessages = messages.map((m) => ({ ...m, content: applyInputGuardrail(m.content, true).safeText }))
    const conversationBlock = sanitizedMessages
      .map((m) => `${m.role === "user" ? "DOCENTE" : "COPILOTO"}: ${m.content}`)
      .join("\n")

    // ── 3. Prompt ───────────────────────────────────────────────────────────
    const promptText = `Eres un ingeniero especialista en IoT y electrónica aplicada, copiloto del módulo de Laboratorio de una plataforma educativa (EUI, TecNM Tizimín). Tu trabajo NO es solo explicar telemetría — es ayudar activamente a DISEÑAR, CONFIGURAR, CABLEAR y PROGRAMAR sensores físicos reales para que el docente los ponga a funcionar.

CONTRATO REAL DE INGESTA DE ESTA PLATAFORMA (úsalo siempre que generes código):
El endpoint "ingest-telemetry" recibe POST con body JSON:
  { "sensor_id": "string (ej. SEN-001)", "tipo": "temp|humidity|cpu|ph|<otro>", "valor": number, "unidad": "string (ej. °C, %, pH)" }
Cualquier código que generes para un microcontrolador o script debe terminar posteando a ese endpoint con ese esquema exacto, usando HTTPS y encabezado "Content-Type: application/json". Nunca inventes un esquema distinto.
${contextBlock}

CONVERSACIÓN HASTA AHORA:
${conversationBlock}

CÓMO DEBES AYUDAR (según lo que pida el último mensaje del docente):
1. SELECCIÓN DE HARDWARE: si el docente describe qué quiere medir (temperatura, humedad, pH, gas, movimiento, luz, etc.) pero no un sensor específico, recomienda 1-2 modelos reales y económicos (ej. DHT22, DS18B20, BH1750, MQ-135, sondas de pH con módulo amplificador, HC-SR04), explicando brevemente el porqué y sus limitaciones reales (rango, precisión, calibración necesaria).
2. CABLEADO/CONEXIÓN: cuando ayudes a conectar un sensor a un microcontrolador (ESP32, ESP8266, Arduino, Raspberry Pi Pico W), da el conexionado de pines exacto (VCC, GND, señal/datos, resistencias pull-up si aplica) en texto claro, no solo código.
3. CÓDIGO FUNCIONAL: genera código completo y compilable (no fragmentos incompletos) en el lenguaje apropiado al hardware (C++ Arduino/ESP-IDF, MicroPython, o Python para Raspberry Pi), incluyendo: lectura real del sensor, conexión WiFi si aplica, y el POST a ingest-telemetry con el esquema de arriba. Usa nombres de red/credenciales como placeholders claros (ej. TU_SSID, TU_PASSWORD) — nunca inventes credenciales reales.
4. DEPURACIÓN: si el docente pega código o describe un síntoma (lecturas erráticas, sensor no responde, alert_level inesperado), diagnostica causas probables (alimentación insuficiente, pull-up faltante, intervalo de muestreo muy corto, ruido eléctrico, sensor dañado, error de unidades) antes de proponer código corregido.
5. CALIBRACIÓN: si preguntan cómo calibrar (especialmente sensores de pH o gas), da el procedimiento paso a paso con soluciones/valores de referencia reales.
6. Si la pregunta no tiene relación con sensores/IoT/hardware de laboratorio, redirige amablemente explicando que este copiloto es especialmente para eso.
7. Sé técnicamente preciso. Si no estás seguro de una especificación exacta (ej. un pin específico de una variante poco común de placa), dilo explícitamente en vez de inventar un dato que podría dañar hardware real.

Responde en español, en formato markdown (usa bloques de código con el lenguaje correcto, ej. \`\`\`cpp o \`\`\`python). No devuelvas JSON — responde directo en markdown como lo haría un ingeniero explicando por chat.`

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.3 },
      },
      controller.signal,
    )

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "")
      throw new Error(`Gemini respondió ${aiRes.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`)
    }

    const aiJson = await aiRes.json()
    const reply = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!reply) throw new Error("Gemini devolvió una respuesta vacía.")

    const guard = await guardOutputOrBlock(reply, {
      serviceClient, teacherId: userId, toolName: "iot_copilot", cors,
      errorBody: { success: false, error: "La respuesta no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({ success: true, reply }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Tiempo de espera agotado. Intenta con una pregunta más corta o inténtalo de nuevo." : err instanceof Error ? err.message : "Error interno."
    console.error("[IOT_COPILOT]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: isTimeout ? 504 : 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
