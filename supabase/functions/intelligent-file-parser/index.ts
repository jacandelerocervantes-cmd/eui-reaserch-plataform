import { serve } from "std/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyllabusData {
  nombre: string;
  clave: string;
  unidades: {
    id: number;
    nombre: string;
    criterios: { nombre: string; peso: number }[];
  }[];
  competencias: string[];
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Recepción del Archivo (PDF/Word)
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) throw new Error("ERR_NO_FILE: No se detectó ningún documento en la transmisión.")

    // 2. Transformación a Base64
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error("ERR_ENV_MISSING: GEMINI_API_KEY no configurada.")

    // 3. Inicialización IEO con Gemini 2.5 Flash
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    // 4. Ingeniería de Prompts (Extracción Académica)
    const prompt = `
      Actúa como el Oficial de Extracción IEO de un Investigador del TecNM.
      Analiza el documento adjunto, que representa un Programa de Estudios (Syllabus).
      Tu misión es extraer la arquitectura de la materia y estructurarla en un formato JSON plano, listo para desplegar infraestructura en Google Drive/Sheets.

      FORMATO JSON ESTRICTO REQUERIDO:
      {
        "nombre": "Nombre de la materia",
        "clave": "Clave (ej. SCD-1021)",
        "unidades": [
          {
            "id": 1,
            "nombre": "Nombre del tema o unidad",
            "criterios": [
              { "nombre": "Ej. Examen Teórico, Prácticas, Tareas", "peso": 50 }
            ]
          }
        ],
        "competencias": [
          "Competencia específica a desarrollar 1",
          "Competencia específica a desarrollar 2"
        ]
      }

      REGLAS DE OPERACIÓN:
      - Los 'pesos' dentro de los criterios de cada unidad deben sumar exactamente 100. Si el documento no especifica porcentajes, divídelos equitativamente de forma lógica.
      - Responde ÚNICAMENTE con el objeto JSON puro. Nada de formato Markdown ni saludos.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type
        }
      }
    ]);

    const text = result.response.text();
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let courseData: SyllabusData;
    try {
      courseData = JSON.parse(cleanJson);
    } catch (_e) { // Control estricto Deno
      console.error("AI_PARSE_ERROR", text);
      throw new Error("ERR_AI_INVALID_FORMAT");
    }

    return new Response(JSON.stringify({ success: true, data: courseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "ERR_UNKNOWN_PARSE";
    console.error(`[intelligent-file-parser] ❌ ${msg}`);

    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Mantenemos 200 para que el frontend maneje la alerta
    })
  }
})