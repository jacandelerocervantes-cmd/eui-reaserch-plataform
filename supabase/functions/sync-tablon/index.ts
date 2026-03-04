// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AvisoPayload {
  course_id: string; // Alineado a tu base de datos
  titulo?: string;
  contenido?: string;
  autor_id?: string;
}

serve(async (req: Request) => {
  // 1. Manejo de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Validación de Cuerpo Vacío (Evita crasheos de JSON.parse)
    const rawBody = await req.text();
    if (!rawBody) {
      console.error("Error 400: El cuerpo de la petición está vacío.");
      return new Response(JSON.stringify({ error: "El cuerpo de la petición está vacío." }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
      });
    }

    const { action, payload } = JSON.parse(rawBody) as { action: string, payload: AvisoPayload };
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ==========================================
    // ACCIÓN: OBTENER AVISOS
    // ==========================================
    if (action === 'fetchPosts') {
      const { course_id } = payload;
      
      // Validación de datos 400
      if (!course_id) {
        console.error("Error 400: Falta course_id en fetchPosts");
        return new Response(JSON.stringify({ error: "Falta course_id para obtener los avisos." }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
        });
      }

      const { data, error } = await supabase
        .from('course_announcements') // TU NUEVA TABLA (Asegúrate de haber corrido el SQL que te di)
        .select('*')
        .eq('course_id', course_id)
        .order('created_at', { ascending: false });

      // Manejo de Error de Base de Datos 500
      if (error) {
        console.error("Error 500 DB (fetchPosts):", error);
        return new Response(JSON.stringify({ error: `Error interno DB: ${error.message}` }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 
        });
      }
      
      return new Response(JSON.stringify({ success: true, data }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
      });
    }

    // ==========================================
    // ACCIÓN: PUBLICAR AVISO
    // ==========================================
    if (action === 'publishPost') {
      const { course_id, titulo, contenido, autor_id } = payload;

      // Validación estricta 400
      if (!course_id || !titulo || !contenido || !autor_id) {
        console.error("Error 400: Faltan datos obligatorios para publicar.", payload);
        return new Response(JSON.stringify({ error: "Faltan datos obligatorios (course_id, titulo, contenido o autor_id)." }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
        });
      }

      // Inserción en la BD
      const { data: aviso, error: dbError } = await supabase
        .from('course_announcements') // TU NUEVA TABLA
        .insert([{ course_id, title: titulo, content: contenido, author_id: autor_id }])
        .select()
        .single();

      // Error crítico de BD 500 (Ej. Si el author_id no existe en profiles)
      if (dbError) {
        console.error("Error 500 DB (publishPost):", dbError);
        return new Response(JSON.stringify({ error: `Error al guardar en BD: ${dbError.message}` }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 
        });
      }

      // --- Notificación a Google Apps Script (Try/Catch Aislado) ---
      // Si esto falla, el código sigue su curso y retorna éxito al usuario.
      try {
        const { data: course } = await supabase
          .from('courses')
          .select('title, drive_folder_id')
          .eq('id', course_id)
          .single();

        if (course?.drive_folder_id) {
          const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL');
          if (APPS_SCRIPT_URL) {
            // Ejecutamos fetch en background, no esperamos respuesta
            fetch(APPS_SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                action: 'notificarAviso', 
                payload: { titulo, contenido, materiaNombre: course.title, googleSheetId: course.drive_folder_id }
              })
            }).catch(e => console.error("Advertencia: Webhook de Apps Script falló (ignorado):", e)); 
          }
        }
      } catch (e) {
        console.error("Advertencia: Fallo al consultar metadata para Apps Script (ignorado):", e);
      }

      // Éxito Total 200
      return new Response(JSON.stringify({ success: true, data: aviso }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
      });
    }

    // 3. Acción no soportada (404 Not Found)
    console.error(`Error 404: Acción desconocida: ${action}`);
    return new Response(JSON.stringify({ error: `La acción '${action}' no existe.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404
    });

  } catch (error: any) {
    // 4. Captura Global de Excepciones de Runtime (500)
    console.error("Error 500 Global del Servidor:", error);
    return new Response(JSON.stringify({ error: `Fallo crítico del servidor: ${error.message}` }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 
    });
  }
});