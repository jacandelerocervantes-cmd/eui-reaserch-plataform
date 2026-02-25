import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { prompt } = await req.json()
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // El "System Instruction" para que Gemini no alucine y devuelva JSON puro
    const systemPrompt = `
      Eres el motor de acciones de "Certeza AIA". Tu trabajo es convertir comandos de un profesor en objetos JSON.
      Solo puedes devolver 3 tipos de acciones: 'anuncio', 'actividad' o 'evaluacion'.
      
      Formato de salida esperado (JSON puro):
      {
        "type": "anuncio" | "actividad" | "evaluacion",
        "title": "Un título profesional",
        "content": "El contenido detallado siguiendo estándares académicos del TecNM"
      }

      Si el usuario pide una 'actividad' o 'evaluacion', incluye instrucciones claras o reactivos sugeridos en el 'content'.
    `;

    const result = await model.generateContent([systemPrompt, `Comando del profesor: ${prompt}`]);
    const response = await result.response;
    const text = response.text();
    
    // Limpieza de posibles marcas de markdown que ponga Gemini
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const actionData = JSON.parse(cleanJson);

    return new Response(JSON.stringify(actionData), {
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