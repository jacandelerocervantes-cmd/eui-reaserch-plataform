/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai"

// Configuración de CORS para permitir llamadas desde el Frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Manejo de pre-flight request de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Inicialización de Clientes (Supabase y Gemini)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseKey)
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // 2. Parseo del Payload (Recibimos lote de IDs y el ID de la actividad)
    const { submission_ids, assignment_id } = await req.json()

    // 3. Obtener la rúbrica de la actividad desde la base de datos
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('rubric_json')
      .eq('id', assignment_id)
      .single()

    if (assignmentError || !assignment) {
      throw new Error("No se pudo obtener la rúbrica de la actividad.")
    }

    // 4. Procesamiento de cada entrega en el lote
    for (const id of submission_ids) {
      // Obtener datos de la entrega
      const { data: sub } = await supabase
        .from('submissions')
        .select(`*, students(nombres, apellido_paterno)`)
        .eq('id', id)
        .single()

      if (!sub?.file_path) continue

      // Descargar el PDF desde el Storage de Supabase
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('evidencias')
        .download(sub.file_path)

      if (downloadError || !fileData) continue

      // Convertir el archivo a Base64 para Gemini
      const arrayBuffer = await fileData.arrayBuffer()
      const base64File = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      // 5. Configurar el Prompt Maestro con la Rúbrica
      const prompt = `
        Actúa como un evaluador académico estricto y justo.
        Analiza el documento PDF adjunto y califícalo basándote ÚNICAMENTE en esta rúbrica:
        ${JSON.stringify(assignment.rubric_json)}

        Instrucciones de formato:
        Devuelve la respuesta estrictamente en formato JSON plano (sin markdown) con las siguientes llaves:
        {
          "ai_score": (número del 0 al 100),
          "ai_feedback": (resumen ejecutivo de la retroalimentación),
          "criteria_scores": (objeto con el puntaje obtenido en cada criterio de la rúbrica)
        }
      `

      // 6. Llamada a Gemini 1.5 Flash (Optimizado para volumen)
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64File,
            mimeType: "application/pdf"
          }
        },
        prompt
      ])
      
      const response = await result.response
      const text = response.text().replace(/```json|```/g, "").trim()
      const evaluation = JSON.parse(text)

      // 7. Actualizar la entrega en la base de datos
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          ai_score: evaluation.ai_score,
          ai_feedback: evaluation.ai_feedback,
          status: 'ai_draft', // Se guarda como borrador para revisión del docente
          metadata: evaluation.criteria_scores,
          evaluated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) console.error(`Error actualizando ID ${id}:`, updateError)

      // 8. Descontar crédito de IA del docente (RPC SQL)
      await supabase.rpc('deduct_ai_credit') 
    }

    return new Response(
      JSON.stringify({ success: true, message: "Lote procesado correctamente" }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido en el motor de IA"
    return new Response(
      JSON.stringify({ error: msg }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})