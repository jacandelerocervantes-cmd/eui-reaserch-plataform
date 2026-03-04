import { supabase } from './supabase';

/**
 * 🧠 FASE 1: OBTENER BORRADOR DE LA IEO
 * Llama al Orquestador para que razone, clasifique y redacte.
 */
export async function getAiDraft(prompt: string, scope: string) {
  try {
    const { data, error } = await supabase.functions.invoke('master-copilot-orchestrator', {
      body: { prompt, scope }
    });

    if (error) throw error;
    
    // Si la IA detecta un error en su propio análisis, lo lanzamos aquí
    if (data.error) throw new Error(data.error);

    return data; // Devuelve el JSON con triage_analisis, canvas_draft, etc.
  } catch (error: any) {
    console.error("Error en el razonamiento de la IEO:", error.message);
    throw error;
  }
}

/**
 * ⚡ FASE 2: EJECUTAR ACCIÓN MAESTRA
 * Toma el borrador aprobado/editado y lo envía al Gateway para impactar Google.
 */
export async function applyAIAction(functionName: string, modulo: string, payload: any) {
  try {
    const { data, error } = await supabase.functions.invoke('bridge-gateway', {
      body: { 
        action: functionName, 
        modulo: modulo, 
        data: payload 
      }
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error(`Fallo al ejecutar ${functionName} en el Gateway:`, error.message);
    throw error;
  }
}

/**
 * 📚 PRODUCCIÓN INTELECTUAL: PUBLICAR MATERIAL HÍBRIDO
 * Específico para el Gemini Canvas cuando se crea contenido extenso.
 */
export async function publishHybridMaterial(courseId: string, unitId: string, aiData: any, folderId: string) {
  try {
    // 1. Registro en Bóveda (Supabase)
    const { data: material, error: dbError } = await supabase
      .from('materiales_boveda')
      .insert([{
        materia_id: courseId,
        unit_id: unitId,
        titulo: aiData.titulo_profesional || aiData.title,
        contenido_json: aiData,
        es_hibrido_ia: true,
        es_visible: true
      }])
      .select()
      .single();

    if (dbError) throw dbError;

    // 2. Creación de archivo físico vía Gateway
    const googleRes = await applyAIAction('subirMaterialHibrido', 'DOCENCIA', {
      folderId: folderId,
      titulo: aiData.titulo_profesional || aiData.title,
      contenido: aiData.cuerpo_enriquecido || aiData.content
    });

    // 3. Actualizar URL de Drive
    if (googleRes?.success && googleRes.result?.file_url) {
      await supabase
        .from('materiales_boveda')
        .update({ archivo_url: googleRes.result.file_url })
        .eq('id', material.id);
    }

    return { success: true, materialId: material.id };
  } catch (error: any) {
    console.error("Error en publicación atómica:", error.message);
    throw error;
  }
}