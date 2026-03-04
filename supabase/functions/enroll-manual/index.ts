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
    const rawBody = await req.text();
    if (!rawBody) throw new Error("Petición vacía");
    
    const { courseId, mode, studentId, studentData } = JSON.parse(rawBody) as StudentPayload;
    
    if (!courseId || !mode) {
      return new Response(JSON.stringify({ error: "Faltan courseId o mode" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let result;
    const finalStudentData = { 
      ...studentData, 
      team_id: studentData?.team_id?.trim() === "" ? null : studentData?.team_id 
    };

    // --- 1. OPERACIÓN EN BASE DE DATOS ---
    try {
      if (mode === 'create') {
        const { data, error } = await supabase
          .from('students')
          .insert([{ ...finalStudentData, course_id: courseId }])
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } 
      else if (mode === 'edit' && studentId) {
        const { data, error } = await supabase
          .from('students')
          .update(finalStudentData)
          .eq('id', studentId)
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      } 
      else if (mode === 'delete' && studentId) {
        const { error } = await supabase.from('students').delete().eq('id', studentId);
        if (error) throw error;
        result = { message: "Eliminado" };
      }
    } catch (dbError: unknown) {
      // Manejo seguro sin usar 'any'
      const err = dbError as { code?: string; message?: string };
      
      if (err?.code === '23505') {
        return new Response(JSON.stringify({ success: false, error: "Ya existe un alumno con esta matrícula." }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 
        });
      }
      console.error("Error BD:", err);
      return new Response(JSON.stringify({ success: false, error: "Error en base de datos: " + (err?.message || "Desconocido") }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 
      });
    }

    // --- 2. SINCRONIZACIÓN CON GOOGLE SHEETS (AISLADA) ---
    try {
      const { data: course } = await supabase
        .from('courses')
        .select('title, drive_folder_id')
        .eq('id', courseId)
        .single();

      if (course?.drive_folder_id) {
        let teamName = "Sin equipo";
        if (finalStudentData.team_id) {
          const { data: team } = await supabase.from('teams').select('name').eq('id', finalStudentData.team_id).single();
          if (team) teamName = team.name;
        }

        const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL');
        if (APPS_SCRIPT_URL) {
          fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'sincronizarAlumno', 
              payload: {
                googleSheetId: course.drive_folder_id,
                mode,
                studentData: { ...finalStudentData, team_name: teamName },
                materiaNombre: course.title
              }
            })
          }).catch(e => console.error("Fallo silencioso en Webhook de Google:", e));
        }
      }
    } catch (webhookError: unknown) {
      console.error("Error aislado al preparar Webhook:", webhookError);
    }

    // --- 3. RESPUESTA EXITOSA ---
    return new Response(JSON.stringify({ success: true, data: result }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });

  } catch (globalError: unknown) {
    // Manejo seguro sin usar 'any'
    const err = globalError as { message?: string };
    console.error("Fallo Global:", err);
    return new Response(JSON.stringify({ success: false, error: err?.message || "Fallo crítico del servidor" }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
    });
  }
});