import { serve } from "std/server"
import { createClient } from "@supabase/supabase-js"
import { GoogleGenerativeAI } from "@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MateriaPayload {
  materia: string;
  tipo: "DOCENCIA" | "INVESTIGACION" | "INSTITUCIONAL";
  dias: string[];
  hora: string;
  salon: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const contentType = req.headers.get('content-type') || '';

    // ============================================================================
    // RUTA 1: EXTRACCIÓN MULTIMODAL CON GEMINI 2.5 FLASH (Recibe Archivo)
    // ============================================================================
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      
      if (!file) throw new Error("ERR_NO_FILE: No se detectó la carga horaria.");

      const arrayBuffer = await file.arrayBuffer();
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) throw new Error("ERR_ENV_MISSING: GEMINI_API_KEY no configurada.");

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        Actúa como Oficial de Triage IEO de un Investigador del TecNM.
        Extrae el horario del documento adjunto y devuélvelo en formato JSON estricto.
        
        REGLAS Y 3 PILARES DE CLASIFICACIÓN:
        1. Asigna un "tipo" a cada bloque evaluando estrictamente estos 3 pilares: "DOCENCIA", "INVESTIGACION" o "INSTITUCIONAL".
        2. "dias" debe ser un array de strings (ej. ["Lunes", "Miércoles"]).
        3. "hora" debe tener el formato exacto "HH:MM - HH:MM".
        4. Si el salón no está explícito en el documento, asigna "Por definir".

        FORMATO JSON REQUERIDO:
        {
          "materias": [
            {
              "materia": "Nombre de la materia o actividad",
              "tipo": "DOCENCIA",
              "dias": ["Lunes", "Miércoles"],
              "hora": "10:00 - 12:00",
              "salon": "K-4"
            }
          ]
        }
      `;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: file.type } }
      ]);

      const text = result.response.text();
      const cleanJson = text.replace(/```json|```/g, "").trim();
      
      let scheduleData;
      try {
        scheduleData = JSON.parse(cleanJson);
      } catch (_e) { // Corrección del linter de Deno
        console.error("AI_PARSE_ERROR", text);
        throw new Error("ERR_AI_INVALID_FORMAT");
      }

      return new Response(JSON.stringify({ success: true, data: scheduleData.materias }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ============================================================================
    // RUTA 2: GUARDADO EN SUPABASE Y GOOGLE APPS SCRIPT (Recibe JSON)
    // ============================================================================
    if (contentType.includes('application/json')) {
      const { action, payload } = await req.json();
      
      if (action === 'guardarHorario') {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
           throw new Error("ERR_ENV_MISSING: Credenciales de Base de Datos incompletas.");
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Formatear los datos para la DB basándonos en tu código
        const materiasAInsertar = payload.materias.map((m: MateriaPayload) => {
          const [hora_inicio, hora_fin] = m.hora.split(' - ');
          return {
            materia: m.materia,
            tipo: m.tipo || 'DOCENCIA', 
            dias: m.dias,
            hora_inicio: hora_inicio?.trim(),
            hora_fin: hora_fin?.trim(),
            salon: m.salon
          };
        });

        // 1. Inserción en DB Interna
        const { error: dbError } = await supabase
          .from('horarios_docente')
          .insert(materiasAInsertar);

        if (dbError) throw dbError;

        // 2. Sincronización al Gateway (Google Calendar)
        const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL');
        if (APPS_SCRIPT_URL) {
          await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload })
          });
        }

        return new Response(JSON.stringify({ success: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 
        });
      }
      
      throw new Error("ERR_UNKNOWN_ACTION: Comando no reconocido.");
    }

    throw new Error("ERR_INVALID_CONTENT_TYPE: La IEO no soporta este formato de datos.");

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "ERR_UNKNOWN_SCHEDULE_SYNC";
    console.error(`[sync-schedule] ❌ ${msg}`);
    return new Response(JSON.stringify({ success: false, error: msg }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    });
  }
})