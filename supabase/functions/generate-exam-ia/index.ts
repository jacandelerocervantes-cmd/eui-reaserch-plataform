/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { prompt, currentCount } = await req.json()
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // PROMPT MAESTRO: Aquí está la "interactividad"
    const systemInstruction = `
      Actúa como un Diseñador Curricular experto para el TecNM.
      Tu tarea es generar o modificar reactivos de examen basados en la instrucción del usuario.
      
      FORMATO DE SALIDA (ESTRICTAMENTE JSON):
      {
        "questions": [
          {
            "type": "opcion_multiple" | "verdadero_falso" | "abierta",
            "content": "Texto de la pregunta",
            "options": ["opcion A", "opcion B", "opcion C", "opcion D"],
            "answer": "La respuesta correcta exacta",
            "points": 10,
            "bloom": "Recordar" | "Comprender" | "Aplicar" | "Analizar"
          }
        ]
      }

      REGLAS INTERACTIVAS:
      1. Si el usuario pide "genera más", crea reactivos nuevos que no sean repetitivos.
      2. Si el usuario pide "cambia la pregunta X", devuelve el objeto corregido.
      3. Mantén un lenguaje técnico académico de nivel ingeniería.
      4. No incluyas texto fuera del JSON.
    `

    const result = await model.generateContent([
      systemInstruction,
      `Contexto: El examen tiene actualmente ${currentCount} preguntas. Instrucción: ${prompt}`
    ])

    const response = await result.response
    const text = response.text().replace(/```json|```/g, "").trim()
    
    return new Response(text, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})