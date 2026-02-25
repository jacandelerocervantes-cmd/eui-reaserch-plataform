import { supabase } from './supabase';

export async function applyAIAction(type: string, courseId: string, data: any) {
  console.log(`Applying AI action: ${type} for course ${courseId}`, data);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  return { success: true };
}

/**
 * Genera contenido académico híbrido usando la Edge Function
 */
export async function generateHybridMaterial(prompt: string, courseId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('process-hybrid-material', {
      body: { 
        prompt: prompt,
        materiaContexto: `ID de Materia: ${courseId}` // Aquí podrías pasar más contexto si lo tienes
      },
    });

    if (error) throw error;
    return data; // Retorna { title, summary, content, suggested_activity }
  } catch (error) {
    console.error("Error al generar material híbrido:", error);
    throw error;
  }
}

/**
 * Publica el material generado: Guarda en DB y crea archivo en Drive
 */
export async function publishHybridMaterial(courseId: string, unitId: string, aiData: any, folderId: string) {
  try {
    // 1. Crear el registro inicial en Supabase (Bóveda)
    const { data: material, error: dbError } = await supabase
      .from('materiales_boveda')
      .insert([{
        materia_id: courseId,
        unit_id: unitId,
        titulo: aiData.title,
        contenido_json: aiData, // Guardamos el objeto completo de la IA
        es_hibrido_ia: true,
        es_visible: true
      }])
      .select()
      .single();

    if (dbError) throw dbError;

    // 2. Llamar al puente de Google para crear el archivo físico
    const googleRes = await supabase.functions.invoke('provision-course-environment', {
      body: { 
        action: 'subirMaterialHibrido',
        payload: {
          folderId: folderId, // El ID de la subcarpeta '01_Materiales'
          titulo: aiData.title,
          contenido: aiData.content
        }
      }
    });

    // 3. Actualizar el registro con la URL real de Drive
    if (googleRes.data?.success) {
      await supabase
        .from('materiales_boveda')
        .update({ archivo_url: googleRes.data.file_url })
        .eq('id', material.id);
    }

    return { success: true, materialId: material.id };
  } catch (error) {
    console.error("Fallo en la publicación atómica:", error);
    throw error;
  }
}