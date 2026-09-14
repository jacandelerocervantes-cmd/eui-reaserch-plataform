// deno-lint-ignore-file no-import-prefix
/**
 * inicio-bridge
 * Puerta de entrada del Dashboard: lee datos de Google (con caché de 5 min),
 * los clasifica con Gemini, y expone acciones de escritura rápida.
 */
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos — evita llamar a Gemini en cada carga

type Category = "DOCENCIA" | "INVESTIGACION" | "LABORATORIO" | "CAMPO" | "EXTERNO"
const COLORS: Record<Category, string> = {
  DOCENCIA:      "#1B396A",
  INVESTIGACION: "#7C3AED",
  LABORATORIO:   "#10B981",
  CAMPO:         "#F59E0B",
  EXTERNO:       "#64748b",
}

async function callAppsScript(
  action: string,
  payload: unknown,
  signal: AbortSignal,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const url    = Deno.env.get("APPS_SCRIPT_URL")
  const secret = Deno.env.get("APPS_SCRIPT_SECRET") ?? ""
  if (!url) throw new Error("APPS_SCRIPT_URL no configurado.")

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ secret, action, payload }),
    signal,
  })
  if (!res.ok) throw new Error(`Apps Script respondió ${res.status}`)
  return res.json()
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } })

  // ── 1. Autenticación JWT ──────────────────────────────────────────────────
  const auth = await verifyUser(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient: svc } = auth.ctx

  // ── 2. Parseo del body ────────────────────────────────────────────────────
  let action: string, payload: Record<string, unknown>
  try {
    const body = await req.json()
    action  = body.action  ?? ""
    payload = body.payload ?? {}
  } catch {
    return json({ error: "Cuerpo de la petición no es JSON válido." }, 400)
  }
  if (!action) return json({ error: "Falta el campo 'action'." }, 400)

  // ── 3. getDashboardData — con caché ──────────────────────────────────────
  if (action === "getDashboardData") {
    // Verificar si hay datos frescos en caché (evita llamar a Gemini innecesariamente)
    const { data: cached } = await svc
      .from("dashboard_cache")
      .select("data, cached_at")
      .eq("user_id", userId)
      .single()

    if (cached && Date.now() - new Date(cached.cached_at).getTime() < CACHE_TTL_MS) {
      return json({ success: true, data: cached.data, fromCache: true })
    }

    // AbortController cubre AMBAS llamadas externas (Apps Script + Gemini)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 28_000)

    try {
      // a) Obtener datos crudos de Google vía Apps Script
      const googleResult = await callAppsScript("getDashboardData", {}, controller.signal)
      if (!googleResult.success) throw new Error("Apps Script: " + googleResult.error)

      // b) Clasificar con Gemini 2.5 Flash
      const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
      if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY no configurado.")

      const aiRes = await fetchGeminiWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
            contents: [{
              parts: [{ text:
                `Actúa como Jefe de Gabinete para un Investigador de Posgrado en México.
                Clasifica los siguientes datos de Google en categorías IEO.

                DATOS: ${JSON.stringify(googleResult.data)}

                CATEGORÍAS:
                - DOCENCIA: clases, alumnos, actas, tutorías
                - INVESTIGACION: papers, tesis, convocatorias científicas
                - LABORATORIO: equipos, protocolos, seguridad
                - CAMPO: visitas técnicas, muestreo, prácticas
                - EXTERNO: personal, financiero, spam — marcar para filtrar

                Devuelve JSON puro con tres arrays:
                "emails"  → [{titulo, remitente, categoria, urgencia (1-5)}]
                "agenda"  → [{titulo, time (HH:mm), categoria}]
                "tasks"   → [{titulo, categoria}]
                Sin texto adicional ni markdown.`
              }]
            }],
            generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
        },
        controller.signal, // mismo budget de 28s
      )
      if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)

      const aiJson  = await aiRes.json()
      const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
      if (!content) throw new Error("Gemini devolvió respuesta vacía.")

      const parsed = JSON.parse(content)

      const guard = await guardOutputOrBlock(JSON.stringify(parsed), {
        serviceClient: svc, teacherId: userId, toolName: "inicio_bridge", cors,
        errorBody: { success: false, error: "Los datos no pudieron mostrarse por una regla de seguridad interna." },
      })
      if (guard.blocked) return guard.response

      const cleanData = {
        emails: (parsed.emails ?? [])
          .filter((i: { categoria: string }) => i.categoria !== "EXTERNO")
          .map((i: { categoria: Category;[k: string]: unknown }) => ({
            ...i, color: COLORS[i.categoria] ?? COLORS.EXTERNO,
          })),
        agenda: (parsed.agenda ?? [])
          .filter((i: { categoria: string }) => i.categoria !== "EXTERNO")
          .map((i: { categoria: Category;[k: string]: unknown }) => ({
            ...i, color: COLORS[i.categoria] ?? COLORS.EXTERNO,
          })),
        tasks: (parsed.tasks ?? [])
          .filter((i: { categoria: string }) => i.categoria !== "EXTERNO")
          .map((i: { categoria: Category;[k: string]: unknown }) => ({
            ...i, color: COLORS[i.categoria] ?? COLORS.EXTERNO,
          })),
      }

      // c) Guardar en caché por user_id
      await svc.from("dashboard_cache").upsert({
        user_id:   userId,
        data:      cleanData,
        cached_at: new Date().toISOString(),
      })

      return json({ success: true, data: cleanData })

    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === "AbortError"
      const msg = isTimeout
        ? "Timeout: Google o Gemini no respondieron en 28s."
        : err instanceof Error ? err.message : "Error interno."
      console.error("[inicio-bridge:getDashboardData]", msg)

      // Fallback: Si Google o Gemini fallan temporalmente, devolver lo que haya en caché
      // o estructura vacía en vez de romper la pantalla completa del docente.
      const { data: staleCache } = await svc
        .from("dashboard_cache")
        .select("data")
        .eq("user_id", userId)
        .single()

      if (staleCache?.data) {
        return json({ success: true, data: staleCache.data, stale: true })
      }

      return json({
        success: true,
        data: { emails: [], agenda: [], tasks: [] },
        fallback: true
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  // ── 4. Acciones de escritura rápida ───────────────────────────────────────
  if (action === "crearTareaRapida" || action === "crearReunionRapida") {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const result = await callAppsScript(action, payload, controller.signal)
      return json({ success: true, data: result })
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === "AbortError"
      const msg = isTimeout ? "Timeout (15s)." : err instanceof Error ? err.message : "Error."
      console.error(`[inicio-bridge:${action}]`, msg)
      return json({ success: false, error: msg }, 502)
    } finally {
      clearTimeout(timeout)
    }
  }

  return json({ error: `Acción no reconocida: ${action}` }, 404)
})
