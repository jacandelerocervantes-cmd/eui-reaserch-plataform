import { serve } from "std/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RawEvent {
  id: string;
  titulo: string;
  diaSemana: number;
  horaInicio: string;
  horaFin?: string;
  ubicacion: string;
}

interface AIEventAnalysis {
  id: string;
  pilar: "DOCENCIA" | "INVESTIGACION" | "LABORATORIO" | "CAMPO" | "INSTITUCIONAL";
  esConflicto: boolean;
}

interface AIResponse {
  analisisEventos: AIEventAnalysis[];
  aiSummary: {
    hayConflictos: boolean;
    mensaje: string;
  };
}

const PILAR_COLORS: Record<string, string> = {
  DOCENCIA: "#3b82f6",
  INVESTIGACION: "#f59e0b",
  LABORATORIO: "#10b981",
  CAMPO: "#ea580c",
  INSTITUCIONAL: "#64748b"
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL')
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    
    if (!APPS_SCRIPT_URL || !GEMINI_API_KEY) {
      throw new Error("ERR_ENV_MISSING: Faltan variables APPS_SCRIPT o GEMINI")
    }

    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'obtenerEventosCalendario', payload: {} })
    })

    if (!googleRes.ok) throw new Error("ERR_GOOGLE_BRIDGE_DOWN")
    const result = await googleRes.json()
    const rawEvents: RawEvent[] = result.data || []

    if (rawEvents.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        data: [],
        aiSummary: { hayConflictos: false, mensaje: "Agenda despejada. Excelente momento para trabajo de investigación profundo." }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    
    // 🚀 CORRECCIÓN AQUÍ: Usamos Gemini 2.5 Flash 
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const systemPrompt = `
      Actúa como el Oficial de Triage IEO de un Investigador del TecNM.
      Analiza la siguiente lista de eventos semanales.
      
      MISIONES:
      1. Clasifica cada evento en un PILAR: "DOCENCIA", "INVESTIGACION", "LABORATORIO", "CAMPO", "INSTITUCIONAL".
      2. Detecta CONFLICTOS (esConflicto: true/false): Busca empalmes exactos de horario o eventos consecutivos en ubicaciones geográficamente incompatibles.
      3. Genera un RESUMEN EJECUTIVO (aiSummary):
         - hayConflictos: true si detectaste al menos un problema logístico.
         - mensaje: Un briefing ejecutivo (máximo 2 líneas) resumiendo la carga de la semana y aconsejando al investigador.

      RESPONDE EXCLUSIVAMENTE EN ESTE FORMATO JSON PURO:
      {
        "analisisEventos": [
          { "id": "...", "pilar": "...", "esConflicto": true }
        ],
        "aiSummary": {
          "hayConflictos": true,
          "mensaje": "..."
        }
      }
    `;

    const aiResult = await model.generateContent([
      systemPrompt, 
      `Agenda Semanal: ${JSON.stringify(rawEvents.map(e => ({ id: e.id, titulo: e.titulo, diaSemana: e.diaSemana, horaInicio: e.horaInicio, horaFin: e.horaFin, ubicacion: e.ubicacion })))}`
    ]);

    const text = aiResult.response.text().replace(/```json|```/g, "").trim();
    
    let aiData: AIResponse;
    try {
      aiData = JSON.parse(text);
    } catch (_e) { 
      console.error("AI_PARSE_ERROR", text);
      throw new Error("ERR_AI_INVALID_FORMAT");
    }

    const enrichedEvents = rawEvents.map((e: RawEvent) => {
      const analysis = aiData.analisisEventos.find((a) => a.id === e.id);
      const pilar = analysis?.pilar || "INSTITUCIONAL";
      
      return {
        ...e,
        pilar: pilar,
        esConflicto: analysis?.esConflicto || false,
        color: PILAR_COLORS[pilar] || PILAR_COLORS["INSTITUCIONAL"]
      };
    });

    return new Response(JSON.stringify({ 
      success: true, 
      data: enrichedEvents,
      aiSummary: aiData.aiSummary 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "ERR_UNKNOWN_SYNC";
    console.error(`[sync-calendar] ❌ ${msg}`);

    return new Response(JSON.stringify({ 
      success: false, 
      error: msg,
      aiSummary: { hayConflictos: true, mensaje: "Anomalía en la telemetría del calendario. Operando a ciegas." }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    })
  }
})