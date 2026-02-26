import { serve } from "std/http/server.ts"
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxW7vzpsmXkvVzvcsAjScunCST6WgllKNnzsaC2xVLhg7xasEMH-cLqoC_BYSqaAiFx/exec";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Recibir datos del curso desde el Frontend
    const body = await req.json().catch(() => null)
    if (!body) throw new Error("El cuerpo de la petición no es un JSON válido")
    
    const { courseId, nombre, clave } = body
    if (!courseId || !nombre) throw new Error("Faltan datos requeridos: courseId o nombre")

    // 2. Llamar a Google Apps Script (Servidor a Servidor)
    const googleResponse = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setupMateria',
        payload: { nombre, clave }
      })
    })

    if (!googleResponse.ok) {
      const text = await googleResponse.text()
      throw new Error(`Google Script falló con status ${googleResponse.status}: ${text.substring(0, 100)}...`)
    }

    const googleData = await googleResponse.json().catch(() => null)
    if (!googleData) throw new Error("Google Script no devolvió un JSON válido")
    if (!googleData.success) throw new Error("Error lógico en Google Apps Script: " + JSON.stringify(googleData.error))

    const { drive_folder_id, google_sheet_id } = googleData.data

    // 3. Inicializar Cliente Supabase con Service Role (para saltar RLS si es necesario)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) throw new Error("Faltan variables de entorno de Supabase")

    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    // 4. Actualizar la tabla 'materias' con los nuevos IDs
    const { error: dbError } = await supabaseClient
      .from('materias')
      .update({
        drive_folder_id: drive_folder_id,
        google_sheet_id: google_sheet_id,
        // Guardamos las subcarpetas en un campo JSONB si existe, o solo los IDs principales
      })
      .eq('id', courseId)

    if (dbError) throw dbError

    return new Response(JSON.stringify({ 
      success: true, 
      drive_id: drive_folder_id, 
      sheet_id: google_sheet_id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error en Edge Function:", error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})