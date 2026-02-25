// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { courseId, file } = await req.json(); // file viene en base64
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. LLAMADA A GEMINI PARA EXTRACCIÓN DE DATOS
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Extrae la lista de alumnos de este documento. Devuelve estrictamente un arreglo JSON de objetos con estos campos: matricula (string), nombres (string), apellido_paterno (string), apellido_materno (string o vacío), correo (string). No incluyas texto extra, solo el JSON." },
            { inline_data: { mime_type: "application/pdf", data: file } }
          ]
        }]
      })
    });

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates[0].content.parts[0].text;
    const studentsList = JSON.parse(rawText.replace(/```json|```/g, ""));

    // 2. INSERTAR EN SUPABASE
    const studentsToInsert = studentsList.map((s: any) => ({
      ...s,
      course_id: courseId
    }));

    const { data: insertedStudents, error: dbError } = await supabase
      .from('students')
      .insert(studentsToInsert)
      .select();

    if (dbError) throw dbError;

    // 3. SINCRONIZAR CON GOOGLE SHEETS (Llamada Masiva al Router)
    const { data: materia } = await supabase.from('materias').select('google_sheet_id').eq('id', courseId).single();

    if (materia?.google_sheet_id) {
      const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL');
      
      // Enviamos uno por uno para asegurar la consistencia en el Sheet
      for (const student of insertedStudents) {
        await fetch(APPS_SCRIPT_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'sincronizarAlumno', 
            payload: {
              googleSheetId: materia.google_sheet_id,
              mode: 'create',
              studentData: { ...student, team_name: "Sin equipo" }
            }
          })
        });
      }
    }

    return new Response(JSON.stringify({ success: true, count: insertedStudents.length }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error en importación IA";
    return new Response(JSON.stringify({ success: false, error: msg }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    });
  }
})