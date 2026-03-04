import { serve } from "std/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RawAppointment {
  id: string;
  name: string; // Título o nombre del alumno/contacto
  type: string; // Tipo original de Google
  date: string;
  time: string;
  email: string;
  meetLink?: string;
  location?: string; // Para citas físicas futuras
}

interface AIAppointmentAnalysis {
  id: string;
  pilar: "DOCENCIA" | "INVESTIGACION" | "LABORATORIO" | "CAMPO" | "INSTITUCIONAL";
  modalidad: "Virtual" | "Física";
  accion_sugerida: string;
}

interface AIResponse {
  analisisCitas: AIAppointmentAnalysis[];
  aiSummary: string;
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
    const { action, payload } = await req.json()
    const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL')
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

    if (!APPS_SCRIPT_URL || !GEMINI_API_KEY) {
      throw new Error("ERR_ENV_MISSING: Variables APPS_SCRIPT o GEMINI no configuradas")
    }

    // 1. Obtener Citas desde el Bridge (Google Apps Script)
    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action || 'obtenerCitas', payload })
    })

    if (!googleRes.ok) throw new Error("ERR_GOOGLE_BRIDGE_DOWN")
    const result = await googleRes.json()
    const rawAppointments: RawAppointment[] = result.data || []

    if (rawAppointments.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        data: [],
        aiSummary: "Sin citas programadas. Operativa despejada."
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // 2. Triage IEO (Gemini 2.5 Flash)
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const systemPrompt = `
      Actúa como el Oficial de Triage IEO de un Investigador del TecNM.
      Analiza las siguientes citas (asesorías, reuniones, revisiones).
      
      MISIONES:
      1. PILAR: Asigna "DOCENCIA" (alumnos/clases), "INVESTIGACION", "LABORATORIO", "CAMPO", o "INSTITUCIONAL".
      2. MODALIDAD: Determina si es "Virtual" (tiene meetLink o es online) o "Física" (revisión presencial, laboratorio, cubículo).
      3. ACCIÓN: Sugiere una acción preparatoria breve (ej. "Preparar rúbrica", "Revisar protocolo").
      4. RESUMEN: Da un aiSummary de 1 línea sobre el enfoque de las reuniones.

      FORMATO JSON ESTRICTO:
      {
        "analisisCitas": [
          { "id": "...", "pilar": "DOCENCIA", "modalidad": "Física", "accion_sugerida": "..." }
        ],
        "aiSummary": "..."
      }
    `;

    // Filtramos datos sensibles/pesados, solo enviamos contexto útil
    const compactData = rawAppointments.map(c => ({
      id: c.id, name: c.name, type: c.type, hasMeet: !!c.meetLink, location: c.location
    }));

    const aiResult = await model.generateContent([
      systemPrompt, 
      `Citas: ${JSON.stringify(compactData)}`
    ]);

    const text = aiResult.response.text().replace(/```json|```/g, "").trim();
    
    let aiData: AIResponse;
    try {
      aiData = JSON.parse(text);
    } catch (_e) { // Manejo de linter Deno
      console.error("AI_PARSE_ERROR", text);
      throw new Error("ERR_AI_INVALID_FORMAT");
    }

    // 3. Enriquecimiento de Datos
    const enrichedAppointments = rawAppointments.map((c: RawAppointment) => {
      const analysis = aiData.analisisCitas.find((a) => a.id === c.id);
      const pilar = analysis?.pilar || "INSTITUCIONAL";
      
      return {
        ...c,
        pilar: pilar,
        modalidad: analysis?.modalidad || (c.meetLink ? "Virtual" : "Física"),
        color: PILAR_COLORS[pilar] || PILAR_COLORS["INSTITUCIONAL"],
        accion_sugerida: analysis?.accion_sugerida || "Revisar detalles"
      };
    });

    return new Response(JSON.stringify({ 
      success: true, 
      data: enrichedAppointments,
      aiSummary: aiData.aiSummary 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "ERR_UNKNOWN_SYNC";
    console.error(`[sync-appointments] ❌ ${msg}`);

    return new Response(JSON.stringify({ 
      success: false, 
      error: msg,
      aiSummary: "Fallo en enlace satelital de citas. Mostrando datos crudos."
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 // 200 para evitar que explote el frontend
    })
  }
})