import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { examKey, responses } = await req.json()
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // Prompt para calificar preguntas abiertas y dar feedback
    const prompt = `
      Actúa como un profesor experto del TecNM. 
      Examen Original (Clave): ${JSON.stringify(examKey)}
      Respuestas del Alumno: ${JSON.stringify(responses)}
      
      Calcula el puntaje para cada respuesta. 
      Si es opción múltiple, 100% o 0%. 
      Si es abierta, evalúa semánticamente según la respuesta esperada.
      Devuelve un JSON con: { "score": total, "feedback": "breve comentario" }
    `

    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json|```/g, "").trim()

    return new Response(text, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})