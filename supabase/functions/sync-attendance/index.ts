// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AttendancePayload {
  courseId: string;
  asistenciaMap: Record<string, number>; // UUID -> valor (1, 0.5, 0)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { courseId, asistenciaMap } = await req.json() as AttendancePayload;
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Obtener las matrículas reales de los alumnos involucrados
    const studentIds = Object.keys(asistenciaMap);
    const { data: perfiles, error: profilesError } = await supabase
      .from('perfiles')
      .select('id, matricula_rfc')
      .in('id', studentIds);

    if (profilesError) throw profilesError;

    // Crear un mapa de Matrícula -> Valor para Apps Script
    const asistenciaConMatricula: Record<string, number> = {};
    perfiles?.forEach(p => {
      asistenciaConMatricula[p.matricula_rfc] = asistenciaMap[p.id];
    });

    // 2. Obtener el ID de la Sábana de la materia
    const { data: materia, error: courseError } = await supabase
      .from('materias')
      .select('google_sheet_id')
      .eq('id', courseId)
      .single();

    if (courseError) throw courseError;

    // 3. Disparar la sincronización en Google Apps Script
    if (materia?.google_sheet_id) {
      const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL');
      if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurada");

      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'registrarAsistencia', 
          payload: {
            googleSheetId: materia.google_sheet_id,
            asistenciaMap: asistenciaConMatricula
          }
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Error en Apps Script");
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ success: false, error: msg }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    });
  }
});