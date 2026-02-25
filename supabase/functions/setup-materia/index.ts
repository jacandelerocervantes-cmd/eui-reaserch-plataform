// deno-lint-ignore no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// deno-lint-ignore no-import-prefix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS para llamadas desde el navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { courseData } = await req.json()
    const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL')

    if (!APPS_SCRIPT_URL) throw new Error("Falta la variable APPS_SCRIPT_URL")

    // 1. Pedir a Apps Script que cree la carpeta y el Sheet
    const scriptResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setupMateria', // La clave para el Router de Apps Script
        payload: {
          nombre: courseData.nombre,
          clave: courseData.clave
        }
      })
    })

    const scriptResult = await scriptResponse.json()
    if (!scriptResult.success) throw new Error(scriptResult.error)

    const { drive_folder_id, google_sheet_id } = scriptResult.data

    // 2. Conectar a Supabase como el usuario autenticado (el docente)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error("No hay usuario autenticado")

    // 3. Insertar la nueva materia en la tabla 'materias'
    const { data: nuevaMateria, error: materiaError } = await supabaseClient
      .from('materias')
      .insert({
        docente_id: user.id,
        nombre: courseData.nombre,
        semestre: courseData.clave, 
        drive_folder_id: drive_folder_id,
        google_sheet_id: google_sheet_id
      })
      .select()
      .single()

    if (materiaError) throw materiaError

    // Retornamos éxito al front-end
    return new Response(
      JSON.stringify({ 
        success: true, 
        materia: nuevaMateria 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    // Solución al error 'unknown' de TypeScript
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})