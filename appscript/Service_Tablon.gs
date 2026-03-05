/**
 * Servicio para gestionar las notificaciones del Tablón de la Materia
 */
function enviarNotificacionAviso(payload) {
  const { titulo, contenido, materiaNombre, googleSheetId } = payload;
  
  if (!googleSheetId) throw new Error("ID de Google Sheet no proporcionado");

  try {
    const ss = SpreadsheetApp.openById(googleSheetId);
    const sheet = ss.getSheetByName("LISTA_ASISTENCIA");
    if (!sheet) throw new Error("No se encontró la hoja LISTA_ASISTENCIA");

    // Obtenemos los datos de los alumnos (asumiendo que los correos están en una columna)
    // Si aún no tienes la columna de correo, el sistema fallará con gracia
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailColIndex = headers.indexOf("Correo") !== -1 ? headers.indexOf("Correo") : headers.indexOf("Email");

    if (emailColIndex === -1) {
      return { success: false, message: "No se encontró columna de correos en la hoja de control." };
    }

    const destinatarios = data.slice(1)
      .map(row => row[emailColIndex])
      .filter(email => email && email.includes("@"));

    if (destinatarios.length === 0) return { success: true, message: "No hay alumnos con correo registrado." };

    // Envío de correos masivo
    destinatarios.forEach(email => {
      MailApp.sendEmail({
        to: email,
        subject: `[AVISO] ${materiaNombre}: ${titulo}`,
        htmlBody: `
          <div style="font-family: sans-serif; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px;">
            <h2 style="color: #1B396A;">${titulo}</h2>
            <p style="color: #475569; font-size: 1.1rem;">${contenido}</p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;">
            <p style="font-size: 0.8rem; color: #94a3b8;">Publicado por Prof. Juan Antonio en la Plataforma EUI.</p>
          </div>
        `
      });
    });

    return { success: true, enviados: destinatarios.length };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}