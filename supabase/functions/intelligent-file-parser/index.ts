import { serve } from "std/http/server.ts"
import { GoogleGenerativeAI } from "@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Recibir el archivo (enviado como multipart/form-data)
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) throw new Error("No se recibió ningún archivo.")

    // 2. Convertir el archivo a Base64 para Gemini
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // 3. Prompt de extracción con reglas del TecNM
    const prompt = `
      Analiza este documento (lista de alumnos). 
      Extrae la información y devuélvela UNICAMENTE en formato JSON plano (un array de objetos).
      Si hay datos faltantes, deja el string vacío.

      Campos requeridos por objeto:
      "matricula": (Solo números/letras según formato TecNM),
      "nombres": (Solo nombres),
      "apellido_paterno": (Primer apellido),
      "apellido_materno": (Segundo apellido),
      "correo": (Correo institucional o personal si existe)

      Ejemplo de salida:
      [{"matricula": "18120001", "nombres": "JUAN ANTONIO", "apellido_paterno": "CANDELERO", "apellido_materno": "CERVANTES", "correo": "l18120001@villahermosa.tecnm.mx"}]
    `;

    // 4. Llamada a Gemini con soporte para archivos
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
    const studentData = JSON.parse(cleanJson);

    return new Response(JSON.stringify({ students: studentData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})