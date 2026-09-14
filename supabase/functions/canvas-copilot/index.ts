// deno-lint-ignore-file no-import-prefix
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { buildCorsHeaders, errorResponse, verifyDocente } from '../_shared/auth.ts'
import { fetchGeminiWithRetry } from '../_shared/gemini.ts'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)

  const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
  if (!GEMINI_KEY) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY no configurado' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 28_000)

  try {
    const { titulo, contenido, modo } = await req.json()

    if (!modo || !['sugerencia', 'revision'].includes(modo)) {
      return new Response(
        JSON.stringify({ error: "modo debe ser 'sugerencia' o 'revision'" }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    let prompt: string

    if (modo === 'sugerencia') {
      prompt = `Eres un asistente de escritura académica para investigadores universitarios mexicanos.
El investigador está redactando un artículo científico o reporte de investigación.

Título del manuscrito: ${titulo ?? 'Sin título'}

Contenido actual:
---
${contenido ?? '(vacío)'}
---

Tu tarea: Genera un párrafo académico de continuación que sea coherente con el texto anterior.
El párrafo debe tener entre 80 y 150 palabras, nivel de lenguaje académico-científico, en español de México.
NO uses encabezados ni listas. Solo texto continuo.

Responde ÚNICAMENTE con el párrafo, sin introducción ni explicación.`

    } else {
      // modo === 'revision'
      prompt = `Eres un revisor de journals científicos internacionales de alto impacto.
Evalúa el siguiente manuscrito de un investigador mexicano con máxima objetividad académica.

Título: ${titulo ?? 'Sin título'}

Contenido:
---
${contenido ?? '(vacío)'}
---

Evalúa en función de: rigor metodológico, claridad del argumento, profundidad del análisis, pertinencia de las afirmaciones y calidad del lenguaje académico.

Responde ÚNICAMENTE con este JSON (sin markdown):
{
  "score": <número entero del 0 al 100, probabilidad de aceptación en journal Q1>,
  "critica": "<párrafo de máximo 100 palabras con los puntos débiles y recomendaciones específicas>"
}`
    }

    const geminiRes = await fetchGeminiWithRetry(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: modo === 'sugerencia' ? 0.8 : 0.3,
        maxOutputTokens: modo === 'sugerencia' ? 512 : 256,
        ...(modo === 'revision' ? { responseMimeType: 'application/json' } : {}),
      },
    }, controller.signal)

    if (!geminiRes.ok) {
      const txt = await geminiRes.text()
      throw new Error(`Gemini ${geminiRes.status}: ${txt}`)
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (modo === 'sugerencia') {
      return new Response(
        JSON.stringify({ parrafo: rawText.trim() }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    } else {
      let parsed: { score: number; critica: string }
      try {
        parsed = JSON.parse(rawText)
      } catch {
        parsed = { score: 50, critica: rawText.trim() }
      }
      return new Response(
        JSON.stringify(parsed),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } finally {
    clearTimeout(timer)
  }
})
