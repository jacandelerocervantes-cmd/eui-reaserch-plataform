import { serve } from "std/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- TIPADO ESTRICTO DE LA RESPUESTA ---
interface AIResponse {
  triage_analisis: string;
  pilar_operativo: "DOCENCIA" | "INVESTIGACION" | "LABORATORIO" | "CAMPO";
  canvas_draft: {
    titulo_profesional: string;
    cuerpo_enriquecido: string;
    metadata_academica: string;
  };
  ejecucion_sugerida: {
    function_name: string;
    action_button_label: string;
  };
  urgencia_tecnica: number;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { prompt, scope } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    
    if (!apiKey) throw new Error("CONFIG_ERROR: API Key de Gemini no configurada.")

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    // --- PROMPT DE SOBERANÍA ACADÉMICA (IEO) ---
    const systemPrompt = `
      Eres la Inteligencia Estratégica Operativa (IEO) de Certeza AIA. 
      Actúas como Chief of Staff de un Investigador de Posgrado y Catedrático del TecNM.

      I. EL FILTRO DE EXCELENCIA:
      - Rechaza lo somero. Si el comando es breve, expande con rigor científico (IEEE, ACM, ISO).
      - Toda propuesta debe incluir Objetivos, Protocolo Técnico y KPIs Académicos.

      II. MATRIZ DE CAPACIDADES:
      Propón el uso de estas herramientas según el caso:
      - [enroll-manual, import-ia-students, setup-materia, create-assignment-hub]
      - [generate-exam-ia, generate-rubric-ia, process-hybrid-material]
      - [evaluate-submissions-ia, evaluate-simulation, bulk-evaluate-exams]
      - [sync-calendar, sync-tasks, sync-tablon, sync-attendance]
      - [analyze-exam-group-results, intelligent-file-parser]

      III. GOBERNANZA DE CONTEXTO:
      - DOCENCIA: Foco en competencias TecNM.
      - INVESTIGACIÓN: Foco en metodología científica e IoT.
      - LABORATORIO: Foco en protocolos técnicos.
      - CAMPO: Foco en logística y recolección in-situ.

      RESPUESTA EXCLUSIVA EN JSON PURO (Sin markdown).
    `;

    const result = await model.generateContent([
      systemPrompt, 
      `Contexto (Scope): ${scope}. Comando del Investigador: ${prompt}`
    ]);
    
    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Validación de integridad
    const validatedData: AIResponse = JSON.parse(cleanJson);

    return new Response(JSON.stringify(validatedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "FALLO_SISTEMA_ORQUESTADOR";
    return new Response(JSON.stringify({ 
      error: msg, 
      success: false,
      triage_analisis: "Error crítico en el motor de razonamiento técnico." 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    })
  }
})