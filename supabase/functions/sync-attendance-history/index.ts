// supabase/functions/sync-attendance-history/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { courseId, payload } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Obtenemos el Google Sheet ID
    const { data: materia } = await supabase.from('materias').select('google_sheet_id').eq('id', courseId).single();

    if (materia?.google_sheet_id) {
      const response = await fetch(Deno.env.get('APPS_SCRIPT_URL')!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'actualizarHistorialCompleto', 
          payload: { googleSheetId: materia.google_sheet_id, alumnos: payload.alumnos }
        })
      });
      const result = await response.json();
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error("Materia sin Google Sheet vinculado");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});