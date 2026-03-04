import { serve } from "std/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tipado fuerte para evitar 'any'
interface RawTask {
  id: string;
  t: string; // Título
  d: string; // Fecha
  p: string; // Prioridad origen
  completed: boolean;
}

interface AITaskAnalysis {
  id: string;
  pilar: "DOCENCIA" | "INVESTIGACION" | "LABORATORIO" | "CAMPO" | "INSTITUCIONAL";
  prioridad_ieo: "Alta" | "Media" | "Baja";
  sugerencia_tactica: string;
}

interface AIResponse {
  analisisTareas: AITaskAnalysis[];
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
      throw new Error("ERR_ENV_MISSING: Faltan variables APPS_SCRIPT o GEMINI")
    }

    // 1. Obtención Atómica desde Google (Bridge)
    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    })

    if (!googleRes.ok) throw new Error("ERR_GOOGLE_BRIDGE_DOWN")
    const result = await googleRes.json()

    // Si solo pedimos las listas, no gastamos IA (Eficiencia)
    if (action === 'obtenerListasTareas') {
      return new Response(JSON.stringify(result), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
      })
    }

    // 2. Si pedimos tareas, aplicamos Triage IEO
    if (action === 'obtenerTareasPorLista') {
      const rawTasks: RawTask[] = result.data || []
      const pendingTasks = rawTasks.filter(t => !t.completed)

      if (pendingTasks.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          data: rawTasks,
          aiSummary: "Lista despejada. No hay tareas pendientes que requieran triage táctico."
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // 3. Ingeniería de Prompts (Gemini 2.5 Flash)
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

      const systemPrompt = `
        Actúa como el Oficial de Triage IEO de un Investigador del TecNM.
        Re-evalúa la siguiente lista de tareas pendientes.
        
        MISIONES:
        1. Asigna un PILAR a cada tarea: "DOCENCIA", "INVESTIGACION", "LABORATORIO", "CAMPO", "INSTITUCIONAL".
        2. Re-evalúa la PRIORIDAD (prioridad_ieo) basándote en urgencia académica y de investigación ("Alta", "Media", "Baja").
        3. Da una sugerencia_tactica MUY BREVE (máximo 10 palabras) de cómo delegar, optimizar o atacar la tarea.
        4. Genera un aiSummary global (1 línea) que dicte el enfoque operativo para esta lista.

        RESPONDE EXCLUSIVAMENTE EN ESTE FORMATO JSON PURO:
        {
          "analisisTareas": [
            { "id": "...", "pilar": "...", "prioridad_ieo": "Alta", "sugerencia_tactica": "..." }
          ],
          "aiSummary": "..."
        }
      `;

      // Solo mandamos las pendientes y campos mínimos para ahorrar tokens
      const compactData = pendingTasks.map(t => ({ id: t.id, titulo: t.t, fecha: t.d }));
      
      const aiResult = await model.generateContent([
        systemPrompt, 
        `Tareas Pendientes: ${JSON.stringify(compactData)}`
      ]);

      const text = aiResult.response.text().replace(/```json|```/g, "").trim();
      
      let aiData: AIResponse;
      try {
        aiData = JSON.parse(text);
      } catch (_e) { // Deno Linter Correction
        console.error("AI_PARSE_ERROR", text);
        throw new Error("ERR_AI_INVALID_FORMAT");
      }

      // 4. Enriquecer datos (Merge)
      const enrichedTasks = rawTasks.map((t: RawTask) => {
        if (t.completed) return { ...t, pilar: "INSTITUCIONAL", sugerencia_tactica: "Completada" };
        
        const analysis = aiData.analisisTareas.find((a) => a.id === t.id);
        const pilar = analysis?.pilar || "INSTITUCIONAL";
        
        return {
          ...t,
          pilar: pilar,
          color: PILAR_COLORS[pilar] || PILAR_COLORS["INSTITUCIONAL"],
          p: analysis?.prioridad_ieo || t.p, // Sobreescribimos con la prioridad IA
          sugerencia_tactica: analysis?.sugerencia_tactica || "Pendiente de revisión"
        };
      });

      return new Response(JSON.stringify({ 
        success: true, 
        data: enrichedTasks,
        aiSummary: aiData.aiSummary 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    // Fallback para otras acciones
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "ERR_UNKNOWN_SYNC";
    console.error(`[sync-tasks] ❌ ${msg}`);

    return new Response(JSON.stringify({ 
      success: false, 
      error: msg,
      aiSummary: "Fallo en la telemetría IEO. Mostrando datos crudos sin clasificar."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    })
  }
})