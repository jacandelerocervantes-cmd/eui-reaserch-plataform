import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { prompt, materiaContexto } = await req.json()
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // CONFIGURACIÓN PEDAGÓGICA (El "Cerebro" Certeza AIA)
    const systemInstruction = `
      Actúa como un Diseñador Instruccional experto para el Tecnológico Nacional de México. 
      Tu objetivo es generar un "Material Híbrido" de alta calidad para nivel ingeniería.
      
      Debes devolver UNICAMENTE un objeto JSON con esta estructura:
      {
        "title": "Título profesional del material",
        "summary": "Un resumen ejecutivo de 3 líneas",
        "content": "Contenido extenso en formato Markdown profesional con tablas, listas y ejemplos técnicos",
        "suggested_activity": "Una actividad práctica breve para reforzar el tema"
      }

      Contexto de la materia: ${materiaContexto || 'Ingeniería General'}
      Tema solicitado: ${prompt}
    `;

    const result = await model.generateContent(systemInstruction);
    const text = result.response.text();
    
    // Limpieza de formato markdown en el JSON
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const materialData = JSON.parse(cleanJson);

    return new Response(JSON.stringify(materialData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})