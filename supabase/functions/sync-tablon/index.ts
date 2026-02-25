// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Interfaz para definir la estructura de los avisos y evitar el tipo 'any'
interface AvisoPayload {
  materia_id: string;
  titulo: string;
  contenido: string;
}

serve(async (req: Request) => {
  // 1. Manejo de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json() as { action: string, payload: AvisoPayload };
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- ACCIÓN: PUBLICAR AVISO ---
    if (action === 'publishPost') {
      const { materia_id, titulo, contenido } = payload;

      const { data: aviso, error: dbError } = await supabase
        .from('materias_avisos')
        .insert([{ materia_id, titulo, contenido }])
        .select()
        .single();

      if (dbError) throw dbError;

      // Obtener datos de la materia para notificación
      const { data: materia } = await supabase
        .from('materias')
        .select('nombre, google_sheet_id')
        .eq('id', materia_id)
        .single();

      if (materia?.google_sheet_id) {
        const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL');
        await fetch(APPS_SCRIPT_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'notificarAviso', 
            payload: {
              titulo,
              contenido,
              materiaNombre: materia.nombre,
              googleSheetId: materia.google_sheet_id
            }
          })
        });
      }

      return new Response(JSON.stringify({ success: true, data: aviso }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // --- ACCIÓN: OBTENER AVISOS ---
    if (action === 'fetchPosts') {
      const { materia_id } = payload;
      const { data, error } = await supabase
        .from('materias_avisos')
        .select('*')
        .eq('materia_id', materia_id)
        .order('creado_en', { ascending: false });

      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true, data }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // SOLUCIÓN AL ERROR 1: Si no coincide ninguna acción, devolvemos un 404
    return new Response(JSON.stringify({ error: "Acción no encontrada" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404
    });

  } catch (error) {
    // SOLUCIÓN AL ERROR 2: Manejo de errores sin usar 'any'
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ success: false, error: mensaje }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    });
  }
});