import { serve } from "std/server"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- DEFINICIÓN DE TIPOS (Para eliminar los errores de Deno) ---
type CategoriaMódulo = "DOCENCIA" | "INVESTIGACION" | "LABORATORIO" | "CAMPO" | "EXTERNO";

interface EmailItem {
  titulo: string;
  remitente: string;
  categoria: CategoriaMódulo;
  urgencia: number;
  color?: string;
}

interface AgendaItem {
  titulo: string;
  time: string;
  categoria: CategoriaMódulo;
  color?: string;
}

interface TaskItem {
  titulo: string;
  categoria: CategoriaMódulo;
  color?: string;
}

interface DashboardData {
  emails: EmailItem[];
  agenda: AgendaItem[];
  tasks: TaskItem[];
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 🛡️ CONTROL DE TIMEOUT INTERNO (25 segundos)
  // Esto evita que la función se quede colgada y alcance el límite de 150s de Supabase, 
  // lanzando un error controlado antes de que ocurra el 546.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!APPS_SCRIPT_URL || !GEMINI_API_KEY) {
      throw new Error("CONFIG_ERROR: Variables de entorno no configuradas.");
    }

    // 1. OBTENCIÓN DE DATOS CRUDOS DESDE EL BRIDGE
    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getDashboardData', payload: {} }),
      signal: controller.signal // Conectamos la señal de aborto aquí
    });

    clearTimeout(timeoutId); // Si responde a tiempo, cancelamos el temporizador

    if (!googleRes.ok) throw new Error(`GOOGLE_API_ERROR: ${googleRes.status}`);
    const rawData = await googleRes.json();

    // 2. PROMPT DE CLASIFICACIÓN IEO (Gemini 2.5 Flash)
    const prompt = `
      Actúa como Jefe de Gabinete para un Investigador de Posgrado. 
      Clasifica estos datos: ${JSON.stringify(rawData.data)}

      CATEGORÍAS:
      1. DOCENCIA: Clases, alumnos, actas, tutorías.
      2. INVESTIGACION: Papers, tesis, IoT, convocatorias científicas.
      3. LABORATORIO: Equipos, protocolos, seguridad.
      4. CAMPO: Salidas técnicas, muestreo, visitas productoras.

      FILTRO: Etiqueta como "EXTERNO" cualquier tema personal, financiero o ruido (promociones).
      
      RESPUESTA: JSON PURO con arrays "emails", "agenda", "tasks". 
      Campos: titulo, categoria (DOCENCIA|INVESTIGACION|LABORATORIO|CAMPO|EXTERNO), urgencia(1-5), time(solo agenda).
    `;

    // 3. PROCESAMIENTO CON GEMINI (Direct Fetch al Endpoint 2.5 Flash)
    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
      })
    });

    const aiData = await aiRes.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("AI_EMPTY_RESPONSE");

    const filteredData: DashboardData = JSON.parse(content);

    // 4. MAPEADO DE COLORES Y FILTRADO FINAL (Sin 'any')
    const categoryColors: Record<CategoriaMódulo, string> = {
      "DOCENCIA": "#1B396A",
      "INVESTIGACION": "#7C3AED",
      "LABORATORIO": "#10B981",
      "CAMPO": "#F59E0B",
      "EXTERNO": "#64748b"
    };

    const cleanData = {
      emails: (filteredData.emails || [])
        .filter((i: EmailItem) => i.categoria !== "EXTERNO")
        .map((i: EmailItem) => ({ ...i, color: categoryColors[i.categoria] })),
      
      agenda: (filteredData.agenda || [])
        .filter((i: AgendaItem) => i.categoria !== "EXTERNO")
        .map((i: AgendaItem) => ({ ...i, color: categoryColors[i.categoria] })),
      
      tasks: (filteredData.tasks || [])
        .filter((i: TaskItem) => i.categoria !== "EXTERNO")
        .map((i: TaskItem) => ({ ...i, color: categoryColors[i.categoria] }))
    };

    return new Response(JSON.stringify({ success: true, data: cleanData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    clearTimeout(timeoutId);
    let msg = 'FALLO_CRITICO';
    
    if (error instanceof Error) {
      // Manejamos específicamente el error de timeout para que el UI sepa qué pasó
      msg = error.name === 'AbortError' 
        ? "El Bridge de Google tardó demasiado en responder (Timeout)." 
        : error.message;
    }

    console.error(`[inicio-bridge] ❌ ${msg}`);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});