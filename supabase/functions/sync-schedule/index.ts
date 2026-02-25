// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, payload } = await req.json()
    
    // Conexión a DB interna
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (action === 'guardarHorario') {
      // 1. Guardamos en la base de datos de Supabase para que sea permanente
      const { error: dbError } = await supabase
        .from('horarios_docente')
        .insert(payload.materias.map((m: any) => ({
            materia: m.materia,
            tipo: m.tipo || 'DOCENCIA', // Aquí capturamos la diferenciación
            dias: m.dias,
            hora_inicio: m.hora.split(' - ')[0],
            hora_fin: m.hora.split(' - ')[1],
            salon: m.salon
        })))

      if (dbError) throw dbError

      // 2. Opcional: Mandamos a Apps Script para bloquear el calendario
      const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL')
      await fetch(APPS_SCRIPT_URL!, {
        method: 'POST',
        body: JSON.stringify({ action, payload })
      })

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})