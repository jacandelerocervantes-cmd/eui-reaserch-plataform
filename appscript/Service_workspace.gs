/**
 * SERVICIO DE GOOGLE WORKSPACE (Docs, Sheets, Slides)
 * Crea entornos colaborativos para las actividades de los alumnos.
 */

/**
 * Quita el acceso de edición de un archivo (queda en solo lectura para los
 * alumnos) — usado cuando pasa la fecha límite de una actividad, para que
 * ya no se puedan seguir haciendo cambios después de la hora de cierre.
 */
function revocarAccesoArchivo(payload) {
  const { fileId } = payload;
  if (!fileId) return { success: false, error: "Falta fileId." };
  try {
    const file = DriveApp.getFileById(fileId);
    const editors = file.getEditors();
    editors.forEach(function (editor) {
      const email = editor.getEmail();
      file.addViewer(email);
      file.removeEditor(email);
    });
    return { success: true, revoked: editors.length };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Devuelve el texto plano actual de un Doc/Sheet — solo lectura. Usado para
 * comparar entregas entre sí y detectar plagio cruzado entre alumnos.
 */
function obtenerTextoPlano(payload) {
  const { fileId } = payload;
  if (!fileId) return { success: false, error: "Falta fileId." };
  try {
    const file = DriveApp.getFileById(fileId);
    const mime = file.getMimeType();
    let text = "";
    if (mime === MimeType.GOOGLE_DOCS) {
      text = DocumentApp.openById(fileId).getBody().getText();
    } else if (mime === MimeType.GOOGLE_SHEETS) {
      const sheet = SpreadsheetApp.openById(fileId).getActiveSheet();
      text = sheet.getDataRange().getValues().map(function (row) { return row.join(" "); }).join("\n");
    } else {
      return { success: false, error: "Tipo de archivo no soportado para extracción de texto." };
    }
    return { success: true, text: text };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Mueve un archivo YA EXISTENTE a una carpeta. Usado por el retry para sanar
 * archivos que quedaron huérfanos en la raíz porque su carpeta destino no
 * existía todavía cuando se crearon (carpeta y archivo resueltos en ciclos
 * distintos). No crea nada nuevo, solo reubica.
 */
function moverArchivoACarpeta(payload) {
  const { fileId, folderId } = payload;
  if (!fileId || !folderId) return { success: false, error: "Faltan fileId o folderId." };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var folder = DriveApp.getFolderById(folderId);
    var file = DriveApp.getFileById(fileId);
    file.moveTo(folder);

    var parents = file.getParents();
    var quedoEnCarpeta = false;
    while (parents.hasNext()) {
      if (parents.next().getId() === folderId) { quedoEnCarpeta = true; break; }
    }
    if (!quedoEnCarpeta) file.moveTo(folder);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Diff simple por palabras (subsecuencia común más larga) — determina cuántas
 * palabras de "actual" son nuevas respecto a "anterior". No es un diff óptimo
 * a nivel de carácter, pero basta para atribuir contribución aproximada por
 * autor entre dos revisiones consecutivas de un mismo documento.
 */
function palabrasAgregadas_(anteriorWords, actualWords) {
  var n = anteriorWords.length, m = actualWords.length;
  var dp = [];
  for (var i = 0; i <= n; i++) { dp.push(new Array(m + 1).fill(0)); }
  for (var i = 1; i <= n; i++) {
    for (var j = 1; j <= m; j++) {
      if (anteriorWords[i - 1] === actualWords[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  var matchedActual = new Array(m).fill(false);
  var i = n, j = m;
  while (i > 0 && j > 0) {
    if (anteriorWords[i - 1] === actualWords[j - 1]) { matchedActual[j - 1] = true; i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) { i--; }
    else { j--; }
  }
  var agregadas = 0;
  for (var k = 0; k < m; k++) if (!matchedActual[k]) agregadas++;
  return agregadas;
}

/**
 * Analiza el historial de revisiones de un Doc/Sheet para:
 * 1. Atribuir cuántas palabras agregó cada colaborador (% de contribución).
 * 2. Detectar "pegados masivos" — muchas palabras agregadas en muy poco
 *    tiempo desde la revisión anterior, algo físicamente imposible de teclear.
 * Requiere el servicio avanzado "Drive API" habilitado en el proyecto
 * (Editor → Servicios → + → Drive API).
 */
function analizarHistorialEntrega(payload) {
  const { fileId } = payload;
  if (!fileId) return { success: false, error: "Falta fileId." };

  try {
    const revisions = Drive.Revisions.list(fileId, { fields: "revisions(id,modifiedTime,lastModifyingUser,exportLinks)" }).revisions;
    if (!revisions || revisions.length === 0) return { success: true, contributions: [], suspiciousPastes: [], totalRevisions: 0 };

    // Cap de revisiones analizadas — cada una implica una descarga + un diff
    // O(n*m); 40 es de sobra para detectar el patrón de contribución/pegado
    // sin arriesgar el tiempo de ejecución del trigger.
    const recent = revisions.slice(Math.max(0, revisions.length - 40));
    const token = ScriptApp.getOAuthToken();

    const totals = {};
    const suspiciousPastes = [];
    let previousWords = [];
    let previousTime = null;

    recent.forEach(function (rev) {
      const exportUrl = rev.exportLinks && (rev.exportLinks['text/plain'] || rev.exportLinks['text/csv']);
      if (!exportUrl) return; // revisión sin texto exportable (ej. Slides)

      let text = "";
      try {
        const res = UrlFetchApp.fetch(exportUrl, { headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true });
        text = res.getContentText();
      } catch (e) { return; }

      const currentWords = text.split(/\s+/).filter(Boolean);
      const agregadas = palabrasAgregadas_(previousWords, currentWords);
      const email = rev.lastModifyingUser && rev.lastModifyingUser.emailAddress;
      const currentTime = new Date(rev.modifiedTime);

      if (email && agregadas > 0) {
        totals[email] = (totals[email] || 0) + agregadas;

        if (previousTime) {
          const segundos = (currentTime.getTime() - previousTime.getTime()) / 1000;
          if (segundos > 0 && segundos < 30 && agregadas > 40) {
            suspiciousPastes.push({ email: email, wordsAdded: agregadas, secondsElapsed: Math.round(segundos), at: rev.modifiedTime });
          }
        }
      }

      previousWords = currentWords;
      previousTime = currentTime;
    });

    const totalWords = Object.values(totals).reduce(function (a, b) { return a + b; }, 0) || 1;
    const contributions = Object.keys(totals).map(function (email) {
      return { email: email, wordsAdded: totals[email], percent: Math.round((totals[email] / totalWords) * 1000) / 10 };
    });

    return { success: true, contributions: contributions, suspiciousPastes: suspiciousPastes, totalRevisions: recent.length };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function crearEntornoWorkspace(payload) {
  const { title, documentType, emails, folderId } = payload;
  let fileId = "";
  let fileUrl = "";

  try {
    // 1. CREACIÓN SEGÚN EL TIPO DE DOCUMENTO — limpio, sin instrucciones ni
    // rúbrica dentro (eso se envía aparte por correo, vía enviarCorreoActividad).
    // El archivo queda reservado exclusivamente para el trabajo del alumno.
    if (documentType === 'doc') {
      const doc = DocumentApp.create(title);
      fileId = doc.getId();
      fileUrl = doc.getUrl();

    } else if (documentType === 'sheet') {
      const ss = SpreadsheetApp.create(title);
      ss.getActiveSheet().setName("Entregable");
      fileId = ss.getId();
      fileUrl = ss.getUrl();

    } else if (documentType === 'slide') {
      const presentation = SlidesApp.create(title);
      fileId = presentation.getId();
      fileUrl = presentation.getUrl();
    } else {
      throw new Error("Tipo de documento no soportado: " + documentType);
    }

    // 2. MOVER A LA CARPETA DE LA ACTIVIDAD (si se proporcionó) — con lock para
    // que ninguna otra ejecución concurrente (ej. el cron de retry tocando
    // Drive al mismo tiempo) interfiera, y verificación de que sí quedó
    // dentro antes de devolver éxito (si no, reintenta una vez más).
    if (folderId) {
      var moveLock = LockService.getScriptLock();
      moveLock.waitLock(20000);
      try {
        var folder = DriveApp.getFolderById(folderId);
        var file = DriveApp.getFileById(fileId);
        file.moveTo(folder);

        var parents = file.getParents();
        var quedoEnCarpeta = false;
        while (parents.hasNext()) {
          if (parents.next().getId() === folderId) { quedoEnCarpeta = true; break; }
        }
        if (!quedoEnCarpeta) {
          // Reintento único: a veces el primer moveTo no aplica bajo carga.
          file.moveTo(folder);
        }
      } finally {
        moveLock.releaseLock();
      }
    }

    // 3. GESTIÓN DE PERMISOS (Compartir con los alumnos)
    if (emails && emails.length > 0) {
      const driveFile = DriveApp.getFileById(fileId);
      driveFile.addEditors(emails);
    }

    return {
      success: true,
      fileId: fileId,
      fileUrl: fileUrl,
      message: "Archivo " + documentType + " creado y compartido exitosamente."
    };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Envía por correo el título, instrucciones y rúbrica de una actividad —
 * separado del archivo de entrega, para que este quede limpio para el
 * trabajo del alumno. Se usa tanto para actividades Workspace (con link al
 * archivo) como para actividades de subida de archivo (sin link, solo nota).
 */
function enviarCorreoActividad(payload) {
  const { emails, title, description, rubric, fileUrl, folderUrl, deadline } = payload;
  if (!emails || emails.length === 0) return { success: true, message: "Sin destinatarios, no se envió correo." };

  // Cuota diaria de MailApp: 100 destinatarios/día (cuenta gratuita) o 1500/día
  // (Workspace). Si ya no alcanza para este grupo, no se envía nada parcial —
  // se reporta para que el docente sepa que debe reintentar al día siguiente.
  var quota = MailApp.getRemainingDailyQuota();
  if (quota < emails.length) {
    return { success: false, error: "Cuota diaria de correo agotada (quedan " + quota + ", se necesitan " + emails.length + "). Reintenta mañana." };
  }

  try {
    var rubricHtml = "";
    if (rubric && rubric.length > 0) {
      rubricHtml = '<h3 style="color:#1B396A;">Rúbrica de Evaluación</h3>' +
        '<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">' +
        '<tr style="background:#1B396A;color:white;"><th style="padding:8px;text-align:left;">Criterio</th><th style="padding:8px;text-align:left;">Descripción</th><th style="padding:8px;text-align:center;">%</th></tr>' +
        rubric.map(function(r) {
          return '<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;font-weight:bold;">' + r.name + '</td><td style="padding:8px;">' + r.description + '</td><td style="padding:8px;text-align:center;">' + r.weight + '%</td></tr>';
        }).join('') +
        '</table>';
    }

    var actionHtml = "";
    if (fileUrl) {
      actionHtml = '<p><a href="' + fileUrl + '" style="background:#1B396A;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Abrir documento de entrega</a></p>';
    } else if (folderUrl) {
      actionHtml = '<p><a href="' + folderUrl + '" style="background:#1B396A;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Abrir carpeta de entrega</a></p>';
    }

    var deadlineHtml = deadline ? '<p style="color:#ef4444;font-weight:bold;">Fecha límite: ' + deadline + '</p>' : '';

    var html =
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">' +
      '<h2 style="color:#1B396A;">' + title + '</h2>' +
      deadlineHtml +
      '<p style="color:#334155;white-space:pre-wrap;">' + (description || "") + '</p>' +
      actionHtml +
      rubricHtml +
      '</div>';

    MailApp.sendEmail({
      to: emails.join(","),
      subject: "Nueva actividad: " + title,
      htmlBody: html,
    });

    return { success: true, message: "Correo enviado a " + emails.length + " destinatario(s)." };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Notifica por correo a cada alumno su calificación final de un examen.
 * Un correo individual por alumno (no se exponen notas entre compañeros).
 */
function enviarCorreoResultadosExamen(payload) {
  const { resultados, examTitle } = payload;
  if (!resultados || resultados.length === 0) return { success: true, message: "Sin destinatarios." };

  let enviados = 0;
  let sinCuota = 0;
  resultados.forEach(function(r) {
    if (!r.email) return;

    // Se detiene en seco apenas se acaba la cuota diaria — no falla a medias,
    // simplemente deja de enviar y reporta cuántos quedaron pendientes.
    if (MailApp.getRemainingDailyQuota() < 1) { sinCuota++; return; }

    try {
      const html =
        '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">' +
        '<h2 style="color:#1B396A;">Resultados: ' + examTitle + '</h2>' +
        '<p style="color:#334155;">Hola ' + (r.nombre || '') + ', tu calificación ya está disponible.</p>' +
        '<div style="background:#f0f7ff;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">' +
        '<span style="font-size:0.8rem;color:#64748b;text-transform:uppercase;font-weight:bold;">Calificación Final</span>' +
        '<div style="font-size:2.5rem;font-weight:900;color:#1B396A;">' + r.score + '</div>' +
        '</div>' +
        (r.feedback ? '<p style="color:#334155;white-space:pre-wrap;"><strong>Retroalimentación:</strong><br>' + r.feedback + '</p>' : '') +
        '</div>';

      MailApp.sendEmail({ to: r.email, subject: "Resultados: " + examTitle, htmlBody: html });
      enviados++;
    } catch (e) {
      // Continúa con el resto aunque uno falle
    }
  });

  return {
    success: true,
    message: enviados + " correo(s) enviado(s)." + (sinCuota > 0 ? " " + sinCuota + " no se enviaron por cuota diaria agotada — reintenta mañana." : ""),
  };
}

/**
 * Crea el Doc "ℹ️ Información de la Actividad" en la carpeta PRINCIPAL de la
 * actividad (no en la subcarpeta de cada alumno/equipo) — título, instrucciones
 * y rúbrica completos, para que cualquiera que abra esa carpeta tenga contexto
 * sin depender de encontrar el correo. No se comparte con nadie en particular,
 * vive junto a las subcarpetas de entrega.
 */
function crearDocInformativoActividad(payload) {
  const { folderId, title, description, rubric } = payload;
  if (!folderId) return { success: false, error: "Falta folderId." };

  try {
    var folder = DriveApp.getFolderById(folderId);

    // Idempotente: si ya existe (ej. se reintenta), lo reemplaza en vez de duplicar.
    var existing = folder.getFilesByName("ℹ️ Información de la Actividad");
    if (existing.hasNext()) {
      DriveApp.getFileById(existing.next().getId()).setTrashed(true);
    }

    var doc = DocumentApp.create("ℹ️ Información de la Actividad");
    var body = doc.getBody();

    body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.TITLE);
    if (description) {
      body.appendParagraph("Instrucciones").setHeading(DocumentApp.ParagraphHeading.HEADING1);
      body.appendParagraph(description).setSpacingAfter(20);
    }

    if (rubric && rubric.length > 0) {
      body.appendParagraph("Rúbrica de Evaluación").setHeading(DocumentApp.ParagraphHeading.HEADING1);
      var tableData = [["Criterio", "Descripción", "Valor (%)"]];
      rubric.forEach(function(r) {
        tableData.push([r.name, r.description, r.weight.toString()]);
      });
      var table = body.appendTable(tableData);
      table.getRow(0).editAsText().setBold(true);
    }

    // Mismo tratamiento que el archivo del alumno: lock + verificación de que
    // sí quedó dentro antes de devolver éxito (si no, reintenta una vez más).
    var docLock = LockService.getScriptLock();
    docLock.waitLock(20000);
    try {
      var docFile = DriveApp.getFileById(doc.getId());
      docFile.moveTo(folder);

      var docParents = docFile.getParents();
      var quedoEnCarpetaDoc = false;
      while (docParents.hasNext()) {
        if (docParents.next().getId() === folderId) { quedoEnCarpetaDoc = true; break; }
      }
      if (!quedoEnCarpetaDoc) docFile.moveTo(folder);
    } finally {
      docLock.releaseLock();
    }

    return { success: true, fileId: doc.getId(), fileUrl: doc.getUrl() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Crea un Google Doc con contenido en una carpeta existente de Drive.
 * Usado por bridge-gateway cuando GeminiCanvas publica material híbrido.
 */
function subirMaterialHibrido(payload) {
  const { folderId, titulo, contenido } = payload;
  if (!folderId || !titulo) throw new Error("subirMaterialHibrido: folderId y titulo son obligatorios.");

  try {
    const folder = DriveApp.getFolderById(folderId);
    const doc    = DocumentApp.create(titulo);
    const body   = doc.getBody();

    body.appendParagraph(titulo).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    if (contenido) body.appendParagraph(contenido);

    DriveApp.getFileById(doc.getId()).moveTo(folder);

    return { success: true, file_url: doc.getUrl(), fileId: doc.getId() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}