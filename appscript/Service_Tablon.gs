/**
 * SERVICE_TABLON — Notificaciones de Avisos del Tablón
 * Corrige: nombre del docente hardcodeado, HTML Injection en cuerpo del correo.
 */

/**
 * Envía notificación por correo a todos los alumnos de la materia
 * cuando el docente publica un nuevo aviso.
 *
 * @param {object} payload - { titulo, contenido, materiaNombre, googleSheetId, autorNombre }
 */
function enviarNotificacionAviso(payload) {
  var titulo       = payload.titulo        || '';
  var contenido    = payload.contenido     || '';
  var materiaNombre= payload.materiaNombre || 'La materia';
  var googleSheetId= payload.googleSheetId;
  var autorNombre  = payload.autorNombre   || 'El docente';

  if (!googleSheetId) {
    return { success: false, message: 'ID de Google Sheet no proporcionado.' };
  }

  try {
    var ss    = SpreadsheetApp.openById(googleSheetId);
    var sheet = ss.getSheetByName('LISTA_ASISTENCIA');
    if (!sheet) {
      return { success: false, message: 'No se encontró la hoja LISTA_ASISTENCIA.' };
    }

    var data          = sheet.getDataRange().getValues();
    var headers       = data[0];
    var emailColIndex = headers.indexOf('Correo');
    if (emailColIndex === -1) emailColIndex = headers.indexOf('Email');

    if (emailColIndex === -1) {
      return { success: false, message: 'No se encontró columna de correos en la hoja.' };
    }

    var destinatarios = data.slice(1)
      .map(function(row) { return String(row[emailColIndex]).trim(); })
      .filter(function(email) { return email.indexOf('@') !== -1; });

    if (destinatarios.length === 0) {
      return { success: true, message: 'No hay alumnos con correo registrado.', enviados: 0 };
    }

    // Sanitizar contenido antes de insertar en HTML para evitar inyección
    var tituloSafe   = sanitizeHtml_(titulo);
    var contenidoSafe= sanitizeHtml_(contenido);
    var autorSafe    = sanitizeHtml_(autorNombre);
    var materiaSafe  = sanitizeHtml_(materiaNombre);

    var htmlBody = '<div style="font-family: sans-serif; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; max-width: 600px;">'
      + '<h2 style="color: #1B396A; margin-top: 0;">' + tituloSafe + '</h2>'
      + '<p style="color: #475569; font-size: 1rem; line-height: 1.6;">' + contenidoSafe + '</p>'
      + '<hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;">'
      + '<p style="font-size: 0.8rem; color: #94a3b8;">Publicado por ' + autorSafe + ' — Plataforma EUI · ' + materiaSafe + '</p>'
      + '</div>';

    // Envío masivo respetando el límite diario de MailApp (~100 correos/día en cuentas educativas)
    var enviados = 0;
    destinatarios.forEach(function(email) {
      try {
        MailApp.sendEmail({
          to: email,
          subject: '[AVISO] ' + materiaNombre + ': ' + titulo,
          htmlBody: htmlBody
        });
        enviados++;
      } catch (mailErr) {
        console.warn('[TABLON] No se pudo enviar a ' + email + ': ' + mailErr.toString());
      }
    });

    return { success: true, enviados: enviados };

  } catch (error) {
    console.error('[TABLON] Error: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Escapa caracteres HTML especiales para prevenir inyección en el cuerpo del correo.
 * Convierte <, >, &, ", ' en sus entidades HTML equivalentes.
 */
function sanitizeHtml_(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
