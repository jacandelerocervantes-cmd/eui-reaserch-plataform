import { serve } from "std/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Email {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  time?: string;
  unread?: boolean;
}

interface AIClassification {
  id: string;
  categoria: "DOCENCIA" | "INVESTIGACION" | "INSTITUCIONAL" | "PERSONAL";
  prioridad: number;
  resumen_ejecutivo: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL')
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    
    if (!APPS_SCRIPT_URL || !GEMINI_API_KEY) {
      throw new Error("ERR_ENV_MISSING: Verifique APPS_SCRIPT_URL y GEMINI_API_KEY")
    }

    // 1. Obtención Atómica desde Google (Bridge)
    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'obtenerCorreos', payload: {} })
    })

    if (!googleRes.ok) throw new Error("ERR_GOOGLE_BRIDGE_DOWN")
    const result = await googleRes.json()
    const emails: Email[] = result.data || []

    if (emails.length === 0) {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Ingeniería de Prompts IEO (Chief of Staff Persona)
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    
    // 🚀 CORRECCIÓN: Modelo IEO de Alto Nivel (Gemini 2.5 Flash)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const systemPrompt = `
      Actúa como el Oficial de Triage IEO de un Investigador del TecNM.
      Analiza la siguiente lista de correos y clasifícalos con rigor operativo.
      
      CATEGORÍAS:
      - DOCENCIA: Consultas de alumnos, tareas, avisos de Classroom.
      - INVESTIGACION: Papers, convocatorias, redes científicas, protocolos.
      - INSTITUCIONAL: Avisos oficiales del TecNM, nóminas, circulares.
      - PERSONAL: Todo lo externo, spam o no académico.

      RESPONDE EXCLUSIVAMENTE EN JSON (Array de objetos):
      [{"id": "...", "categoria": "...", "prioridad": 1-5, "resumen_ejecutivo": "..."}]
    `;

    const aiResult = await model.generateContent([
      systemPrompt, 
      `Datos: ${JSON.stringify(emails.map(e => ({ id: e.id, from: e.from, subject: e.subject, snippet: e.snippet })))}`
    ]);

    const text = aiResult.response.text().replace(/```json|```/g, "").trim();
    
    let classifications: AIClassification[];
    try {
      classifications = JSON.parse(text);
    } catch (_e) { // <-- Corrección del linter de Deno
      console.error("AI_PARSE_ERROR", text);
      throw new Error("ERR_AI_INVALID_FORMAT");
    }

    // 3. Enriquecimiento de Datos (Cruzar Bridge + IA)
    const enrichedEmails = emails.map((m: Email) => {
      const aiData = classifications.find((c) => c.id === m.id);
      return {
        ...m,
        aiCategory: aiData?.categoria || "PERSONAL",
        priority: aiData?.prioridad || 3,
        brief: aiData?.resumen_ejecutivo || m.snippet
      };
    });

    return new Response(JSON.stringify({ success: true, data: enrichedEmails }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "ERR_UNKNOWN_SYNC";
    console.error(`[sync-correo] ❌ ${msg}`);

    return new Response(JSON.stringify({ 
      success: false, 
      error: msg,
      triage_status: "FALLO_OPERATIVO" 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    })
  }
})