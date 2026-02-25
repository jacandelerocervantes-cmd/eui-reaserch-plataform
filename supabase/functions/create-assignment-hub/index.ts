// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let workspaceUrl = null;

    // Si el docente eligió Google Workspace (doc, sheet, slide)
    if (['doc', 'sheet', 'slide'].includes(payload.submission_type)) {
      
      // 1. Obtenemos los correos de los alumnos inscritos para darles acceso
      const { data: students } = await supabase
        .from('students')
        .select('correo') // Asegúrate de que esta columna exista (o 'email')
        .eq('course_id', payload.course_id);
      
      const studentEmails = students?.map(s => s.correo).filter(Boolean) || [];

      // 2. Llamamos al Google Apps Script
      const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL');
      if (!appsScriptUrl) throw new Error("APPS_SCRIPT_URL no configurada en Supabase.");

      const scriptResponse = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'crearEntornoWorkspace',
          payload: {
            title: payload.title,
            description: payload.description,
            documentType: payload.submission_type,
            emails: studentEmails,
            rubric: payload.rubric_json
          }
        })
      });

      const scriptResult = await scriptResponse.json();
      if (!scriptResult.success) throw new Error(scriptResult.error || "Error en Drive");
      
      workspaceUrl = scriptResult.data.fileUrl;
    }

    // 3. Guardamos la Actividad en Supabase
    const dbPayload = {
      course_id: payload.course_id,
      unit_id: payload.unit_id,
      activity_id: payload.activity_id,
      title: payload.title,
      description: payload.description,
      format: payload.format,
      submission_type: payload.submission_type,
      soft_deadline: payload.soft_deadline,
      hard_deadline: payload.hard_deadline,
      late_penalty_percent: payload.late_penalty_percent,
      rubric_json: payload.rubric_json,
      requiere_sesion_id: payload.requiere_sesion_id,
      workspace_url: workspaceUrl // Guardamos el link de Drive si existe
    };

    const { data: assignment, error } = await supabase.from('assignments').insert([dbPayload]).select().single();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data: assignment }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});