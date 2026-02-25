// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StudentPayload {
  courseId: string;
  mode: 'create' | 'edit' | 'delete';
  studentId?: string;
  studentData: {
    matricula: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno?: string;
    correo?: string;
    team_id?: string;
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { courseId, mode, studentId, studentData } = await req.json() as StudentPayload;
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let result;
    let finalStudentData = { ...studentData };

    // --- 1. OPERACIÓN EN BASE DE DATOS ---
    if (mode === 'create') {
      const { data, error } = await supabase
        .from('students')
        .insert([{ ...studentData, course_id: courseId }])
        .select()
        .single();
      if (error) throw error;
      result = data;
    } 
    else if (mode === 'edit' && studentId) {
      const { data, error } = await supabase
        .from('students')
        .update(studentData)
        .eq('id', studentId)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } 
    else if (mode === 'delete' && studentId) {
      // Antes de borrar, obtenemos los datos para el Sheet
      const { data: st } = await supabase.from('students').select('*').eq('id', studentId).single();
      if (st) finalStudentData = st;

      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
      result = { message: "Eliminado" };
    }

    // --- 2. SINCRONIZACIÓN CON GOOGLE SHEETS ---
    // Obtenemos el google_sheet_id de la tabla materias
    const { data: materia } = await supabase
      .from('materias')
      .select('nombre, google_sheet_id')
      .eq('id', courseId)
      .single();

    if (materia?.google_sheet_id) {
      // Obtenemos el nombre del equipo si existe
      let teamName = "Sin equipo";
      if (finalStudentData.team_id) {
        const { data: team } = await supabase.from('teams').select('name').eq('id', finalStudentData.team_id).single();
        if (team) teamName = team.name;
      }

      const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL');
      await fetch(APPS_SCRIPT_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'sincronizarAlumno', 
          payload: {
            googleSheetId: materia.google_sheet_id,
            mode,
            studentData: { ...finalStudentData, team_name: teamName }
          }
        })
      });
    }

    return new Response(JSON.stringify({ success: true, data: result }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ success: false, error: msg }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    });
  }
})