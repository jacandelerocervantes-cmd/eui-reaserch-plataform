import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { questions, answers, studentName } = await req.json()
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // PROMPT: Análisis de brechas de aprendizaje
    const prompt = `
      Actúa como un Tutor de Inteligencia Artificial del TecNM.
      Nombre del Estudiante: ${studentName}
      Examen: ${JSON.stringify(questions)}
      Respuestas dadas: ${JSON.stringify(answers)}

      Tarea:
      1. Identifica qué temas domina el estudiante.
      2. Identifica en qué temas falló o tuvo dudas.
      3. Genera un "Plan de Refuerzo Inteligente" breve (máximo 400 caracteres) que sea motivador y técnico.
      4. Sugiere una fortaleza y un tema a repasar.

      FORMATO DE SALIDA (JSON ESTRICTO):
      {
        "plan": "texto del plan...",
        "fortaleza": "tema dominado",
        "repaso": "tema a reforzar"
      }
    `

    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json|```/g, "").trim()

    return new Response(text, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})