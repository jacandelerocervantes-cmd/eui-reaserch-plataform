const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxW7vzpsmXkvVzvcsAjScunCST6WgllKNnzsaC2xVLhg7xasEMH-cLqoC_BYSqaAiFx/exec";

/**
 * Función Maestra para comunicar Next.js con Google Apps Script
 */
export async function callGoogleService(action: string, payload: any) {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors", // Importante para evitar bloqueos de CORS en Apps Script
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: action,
        payload: payload,
      }),
    });

    // Nota: Con mode 'no-cors', no podemos leer la respuesta directamente por seguridad del navegador.
    // Si necesitas leer los IDs de retorno (drive_id, sheet_id), 
    // lo ideal es usar un Proxy o configurar un endpoint intermedio.
    
    return { success: true };
  } catch (error) {
    console.error("Error en Google Service Bridge:", error);
    throw error;
  }
}

/**
 * Acción específica para crear el entorno de una materia
 */
export async function setupGoogleCourse(clave: string, nombre: string) {
  return await callGoogleService("setupMateria", {
    clave: clave,
    nombre: nombre,
  });
}