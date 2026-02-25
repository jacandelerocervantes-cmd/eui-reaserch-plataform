// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { title, description } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) throw new Error("API Key de Gemini no configurada");

    const prompt = `
      Eres un experto en diseño instruccional y pedagogía universitaria.
      Necesito que crees una rúbrica de evaluación detallada para una actividad académica.
      
      TÍTULO: ${title}
      INSTRUCCIONES: ${description}
      
      Genera exactamente entre 3 y 5 criterios de evaluación.
      El peso sumado de todos los criterios debe dar EXACTAMENTE 100.
      
      RESPONDE ÚNICA Y EXCLUSIVAMENTE CON UN ARREGLO JSON VÁLIDO. 
      No incluyas texto antes ni después, ni bloques de código markdown (\`\`\`json).
      Estructura exacta esperada:
      [
        { "id": 1, "name": "Nombre del Criterio", "description": "Qué se evalúa...", "weight": 30 },
        { "id": 2, "name": "Otro Criterio", "description": "...", "weight": 70 }
      ]
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 } 
      })
    });

    const data = await response.json();
    const textResponse = data.candidates[0].content.parts[0].text.trim();
    
    // Limpieza de formato markdown por seguridad
    const cleanJson = textResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    const rubricArray = JSON.parse(cleanJson);

    return new Response(JSON.stringify({ success: true, rubrics: rubricArray }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: unknown) {
    // Solución al error 'no-explicit-any'
    const errorMessage = error instanceof Error ? error.message : "Error desconocido al procesar la IA";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});