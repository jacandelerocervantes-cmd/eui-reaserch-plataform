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
    const { courseId, nombre, clave } = await req.json()

    // 2. Llamar a Google Apps Script (Servidor a Servidor)
    const googleResponse = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setupMateria',
        payload: { nombre, clave }
      })
    })

    const googleData = await googleResponse.json()
    if (!googleData.success) throw new Error("Error en Google Apps Script: " + googleData.error)

    const { drive_folder_id, google_sheet_id } = googleData.data

    // 3. Inicializar Cliente Supabase con Service Role (para saltar RLS si es necesario)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})