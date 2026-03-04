import { serve } from "std/server"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- TIPADO ESTRICTO (Cero 'any') ---
type ModuloOperativo = "DOCENCIA" | "INVESTIGACION" | "LABORATORIO" | "CAMPO";

interface ActionData {
  titulo?: string;
  contenido?: string;
  destinatario?: string;
  fecha?: string;
  [key: string]: unknown;
}

interface GatewayRequest {
  action: string;      // Ej: "SEND_EMAIL", "CREATE_EVENT", "POST_ANNOUNCEMENT"
  modulo: ModuloOperativo;
  data: ActionData;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const APPS_SCRIPT_URL = Deno.env.get('APPS_SCRIPT_URL');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!APPS_SCRIPT_URL || !GEMINI_API_KEY) {
      throw new Error("CONFIG_ERROR: Variables de entorno no configuradas en Supabase.");
    }

    const { action, modulo, data }: GatewayRequest = await req.json();

    // 1. VALIDACIÓN DE CONTEXTO OPERATIVO
    const modulosPermitidos: ModuloOperativo[] = ["DOCENCIA", "INVESTIGACION", "LABORATORIO", "CAMPO"];
    if (!modulosPermitidos.includes(modulo)) {
      throw new Error(`BLOQUEO_SEGURIDAD: El módulo '${modulo}' no está autorizado para acciones de ejecución.`);
    }

    // 2. FILTRO DE CALIDAD (Evitar solicitudes someras/superficiales)
    // Exigimos un mínimo de profundidad técnica para el contenido
    if (data.contenido && data.contenido.length < 30) {
      throw new Error("RECHAZO_POR_CALIDAD: El contenido es demasiado somero. Se requiere mayor precisión técnica o académica.");
    }

    // 3. CAPA DE REFINAMIENTO CON GEMINI 2.5 FLASH
    // Antes de ir a Google, la IA valida que el tono sea de Posgrado/Investigador
    const validationPrompt = `
      Actúa como Auditor de Protocolo Académico.
      Tarea: Valida y formatea esta acción para Google Workspace.
      Módulo: ${modulo}
      Acción: ${action}
      Contenido: ${data.contenido || data.titulo}

      REGLA: Si el contenido es informal o impropio de un Investigador de Posgrado, devuelve un error.
      Si es correcto, limpia el texto y optimízalo para su ejecución.
    `;

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: validationPrompt }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
      })
    });

    const aiResult = await aiRes.json();
    const isApproved = aiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!isApproved) throw new Error("ERROR_VALIDACION_IA: La IA no pudo procesar la integridad de la acción.");

    // 4. EJECUCIÓN FINAL EN GOOGLE APPS SCRIPT
    // Enviamos el paquete de datos ya auditado al "Soldado" (Apps Script)
    const googleResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action,
        payload: {
          ...data,
          contexto: modulo,
          audit_stamp: new Date().toISOString(),
          investigador_level: "POSGRADO"
        }
      })
    });

    if (!googleResponse.ok) {
      throw new Error(`GOOGLE_EXECUTION_FAIL: Error en servidor de Google (${googleResponse.status})`);
    }

    const finalResult = await googleResponse.json();

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Acción ejecutada con rigor profesional",
      result: finalResult 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'FALLO_DESCONOCIDO_GATEWAY';
    console.error(`[bridge-gateway] ❌ ERROR: ${msg}`);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: msg,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});