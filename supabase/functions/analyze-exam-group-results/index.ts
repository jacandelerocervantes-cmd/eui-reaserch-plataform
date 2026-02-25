import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { examId } = await req.json()

    // 1. Inicializar Supabase con Service Role para leer todas las respuestas
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Obtener la definición del examen (los reactivos)
    const { data: exam } = await supabaseClient
      .from('evaluations')
      .select('title, reactivos_json')
      .eq('id', examId)
      .single()

    // 3. Obtener todas las respuestas de los alumnos
    const { data: responses } = await supabaseClient
      .from('evaluation_responses')
      .select('score_ia, metadata')
      .eq('evaluation_id', examId)

    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ insight: "Aún no hay suficientes entregas para generar un análisis." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Configurar Gemini
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = `
      Actúa como un Coordinador Académico experto del TecNM.
      Examen: "${exam.title}"
      Reactivos Originales: ${JSON.stringify(exam.reactivos_json)}
      Resultados del Grupo (Puntajes y respuestas): ${JSON.stringify(responses)}

      Tarea: Analiza los resultados y genera un resumen ejecutivo breve (máximo 300 caracteres).
      Debes identificar:
      1. En qué tema les fue mejor.
      2. Qué tema o pregunta específica causó más problemas.
      3. Una recomendación pedagógica concreta para la siguiente clase.
      
      Importante: El tono debe ser profesional y directo. No uses saludos, ve al grano.
    `

    const result = await model.generateContent(prompt)
    const insight = result.response.text().trim()

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})