// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// URL de tu Router.gs en Google Apps Script
const GOOGLE_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL') || "https://script.google.com/macros/s/AKfycbxW7vzpsmXkvVzvcsAjScunCST6WgllKNnzsaC2xVLhg7xasEMH-cLqoC_BYSqaAiFx/exec";

// EL ID DE TU CARPETA MAESTRA
const MASTER_FOLDER_ID = "1NbyElQ90JlfaFnOgyoUigvh_phfBOZ09";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => null)
    if (!body) throw new Error("El cuerpo de la petición no es un JSON válido")
    
    const { courseId, title, clave } = body
    if (!courseId || !title) throw new Error("Faltan datos requeridos: courseId o title")

    // Llamada a Google Apps Script
    const googleResponse = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setupMateria',
        payload: { 
          nombre: title, 
          clave: clave || "IEO-2026",
          parentFolderId: MASTER_FOLDER_ID // Le pasamos a Google dónde guardar la materia
        } 
      })
    })

    if (!googleResponse.ok) {
      const text = await googleResponse.text()
      throw new Error(`Google Script falló con status ${googleResponse.status}: ${text.substring(0, 100)}...`)
    }

    const googleData = await googleResponse.json().catch(() => null)
    if (!googleData || !googleData.success) {
      throw new Error("Error lógico en Google Apps Script: " + JSON.stringify(googleData?.error || "Desconocido"))
    }

    const { drive_folder_id, google_sheet_id } = googleData.data

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) throw new Error("Faltan variables de entorno de Supabase")

    const supabaseClient = createClient(supabaseUrl, supabaseKey)

    const { error: dbError } = await supabaseClient
      .from('courses')
      .update({ drive_folder_id: drive_folder_id })
      .eq('id', courseId)

    if (dbError) throw dbError

    return new Response(JSON.stringify({ 
      success: true, 
      drive_id: drive_folder_id, 
      sheet_id: google_sheet_id 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error en Edge Function:", errorMessage)
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})