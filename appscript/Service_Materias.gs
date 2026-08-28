/**
 * Crea la jerarquía completa de carpetas y el Sheet inicial.
 */
function crearEntornoMateria(payload) {
  const masterFolder = DriveApp.getFolderById(payload.parentFolderId);
  const teacherName  = payload.teacherName || 'Docente';

  // Buscar carpeta del docente — crearla solo si no existe
  var teacherFolder;
  var existing = masterFolder.getFoldersByName(teacherName);
  if (existing.hasNext()) {
    teacherFolder = existing.next();
  } else {
    teacherFolder = masterFolder.createFolder(teacherName);
  }

  const folderName   = payload.nombre + " - " + payload.clave;
  const courseFolder = teacherFolder.createFolder(folderName);

  const folderMateriales   = courseFolder.createFolder("01_Materiales_Boveda");
  const folderActividades  = courseFolder.createFolder("02_Entregas_Actividades");
  const folderAsistencias  = courseFolder.createFolder("03_Asistencias");
  const folderCalificaciones = courseFolder.createFolder("04_Calificaciones");
  const folderIA           = courseFolder.createFolder("05_Generados_por_IA");

  // ── Sheet de Asistencia ────────────────────────────────────────────────────
  const sheetAsistencia = SpreadsheetApp.create("Asistencia: " + folderName);
  DriveApp.getFileById(sheetAsistencia.getId()).moveTo(folderAsistencias);
  let listaSheet = sheetAsistencia.getSheets()[0];
  listaSheet.setName("LISTA_ASISTENCIA");
  listaSheet.appendRow(["Matrícula", "Apellido Paterno", "Apellido Materno", "Nombres", "Correo", "Equipo"]);
  listaSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#1B396A").setFontColor("white");

  // ── Sheet de Calificaciones ───────────────────────────────────────────────
  const sheetCalificaciones = SpreadsheetApp.create("Calificaciones: " + folderName);
  DriveApp.getFileById(sheetCalificaciones.getId()).moveTo(folderCalificaciones);
  let sabanaSheet = sheetCalificaciones.getSheets()[0];
  sabanaSheet.setName("SABANA_NOTAS");
  sabanaSheet.appendRow(["MATRÍCULA", "ALUMNO"]);
  sabanaSheet.getRange("A1:B1").setFontWeight("bold").setBackground("#1B396A").setFontColor("white");

  return {
    drive_folder_id:                courseFolder.getId(),
    google_sheet_id:                sheetAsistencia.getId(),
    google_sheet_id_calificaciones: sheetCalificaciones.getId()
  };
}

/**
 * Encuentra o crea la subcarpeta de una unidad dentro de 01_Materiales_Boveda
 * (creada desde el inicio en crearEntornoMateria). Mismo lock que
 * crearCarpetaActividad, para que llamadas concurrentes no dupliquen carpetas.
 */
function crearCarpetaUnidadMaterial(payload) {
  const { courseFolderId, unitNumber, unitTitle } = payload;
  if (!courseFolderId) return { success: false, error: "Falta courseFolderId." };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var courseFolder = DriveApp.getFolderById(courseFolderId);

    var bovedaFolder;
    var bovedaIter = courseFolder.getFoldersByName("01_Materiales_Boveda");
    bovedaFolder = bovedaIter.hasNext() ? bovedaIter.next() : courseFolder.createFolder("01_Materiales_Boveda");

    var unitFolderName = "Unidad " + unitNumber + (unitTitle ? " — " + unitTitle : "");
    var unitFolder;
    var unitIter = bovedaFolder.getFoldersByName(unitFolderName);
    unitFolder = unitIter.hasNext() ? unitIter.next() : bovedaFolder.createFolder(unitFolderName);

    return { success: true, folderId: unitFolder.getId() };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sube un archivo (bytes en base64) a una carpeta de Drive ya existente —
 * usado por "Subir Material" en la Bóveda de la materia.
 */
function subirArchivoMaterial(payload) {
  const { folderId, fileName, mimeType, base64Data } = payload;
  if (!folderId || !fileName || !base64Data) return { success: false, error: "Faltan folderId, fileName o base64Data." };
  try {
    var folder = DriveApp.getFolderById(folderId);
    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType || "application/octet-stream", fileName);
    var file = folder.createFile(blob);
    return { success: true, fileId: file.getId(), fileUrl: file.getUrl(), sizeBytes: file.getSize() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Crea una presentación (Google Slides) con portada + una diapositiva por
 * cada entrada de "slides", y la mueve a la carpeta indicada. Usado por el
 * Master Copilot para generar presentaciones de un tema de clase.
 */
function crearPresentacionSlides(payload) {
  const { folderId, titulo, slides } = payload;
  if (!folderId || !titulo || !Array.isArray(slides) || slides.length === 0) {
    return { success: false, error: "Faltan folderId, titulo o slides." };
  }
  try {
    var pres = SlidesApp.create(titulo);

    var cover = pres.getSlides()[0];
    cover.getBackground().setSolidFill('#1B396A');
    var coverTitle = cover.getPlaceholder(SlidesApp.PlaceholderType.TITLE);
    if (coverTitle) {
      var ts = coverTitle.asShape().getText();
      ts.setText(titulo);
      ts.getTextStyle().setForegroundColor('#FFFFFF').setBold(true);
    }

    slides.forEach(function (s) {
      var slide = pres.appendSlide(SlidesApp.PredefinedLayout.TITLE_AND_BODY);
      var slideTitle = slide.getPlaceholder(SlidesApp.PlaceholderType.TITLE);
      if (slideTitle) slideTitle.asShape().getText().setText(s.titulo || '');
      var body = slide.getPlaceholder(SlidesApp.PlaceholderType.BODY);
      if (body) body.asShape().getText().setText((s.bullets || []).join('\n'));
    });

    var file = DriveApp.getFileById(pres.getId());
    file.moveTo(DriveApp.getFolderById(folderId));

    return { success: true, fileId: pres.getId(), fileUrl: file.getUrl() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Crea una rúbrica de evaluación como Google Sheet (tabla editable) y la
 * mueve a la carpeta indicada. Usado por el Master Copilot.
 */
function crearRubricaSheet(payload) {
  const { folderId, titulo, criterios } = payload;
  if (!folderId || !titulo || !Array.isArray(criterios) || criterios.length === 0) {
    return { success: false, error: "Faltan folderId, titulo o criterios." };
  }
  try {
    var ss = SpreadsheetApp.create(titulo);
    var sheet = ss.getSheets()[0];
    sheet.setName('RUBRICA');
    sheet.appendRow(['Criterio', 'Descripción', 'Ponderación (%)']);
    sheet.getRange('A1:C1').setFontWeight('bold').setBackground('#1B396A').setFontColor('white');
    criterios.forEach(function (c) {
      sheet.appendRow([c.name, c.description, c.weight]);
    });
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 420);
    sheet.getRange('A1:C' + (criterios.length + 1)).setWrap(true);

    var file = DriveApp.getFileById(ss.getId());
    file.moveTo(DriveApp.getFolderById(folderId));

    return { success: true, fileId: ss.getId(), fileUrl: file.getUrl() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Crea la carpeta de una actividad dentro de 02_Entregas_Actividades.
 * Estructura: 02_Entregas_Actividades / Unidad X — título / Nombre actividad /
 * Si se pasa teamName, además crea/busca una subcarpeta por equipo dentro de
 * la carpeta de la actividad: .../Nombre actividad/Nombre equipo/
 * y esa subcarpeta es la que se devuelve (para mantener el archivo de ese
 * equipo aislado y compartido únicamente con sus integrantes).
 */
function crearCarpetaActividad(payload) {
  const { courseFolderId, unitNumber, unitTitle, activityTitle, teamName } = payload;

  // getFoldersByName + createFolder NO es atómico. Si llegan varias llamadas
  // concurrentes, pueden buscar "no existe" al mismo tiempo y crear carpetas
  // duplicadas. El lock serializa el find-or-create entre ejecuciones.
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(25000); // hasta 25s esperando su turno; si falla, cae al catch de abajo
    const courseFolder = DriveApp.getFolderById(courseFolderId);

    // Buscar carpeta 02_Entregas_Actividades
    var entregasFolder;
    var entregasIter = courseFolder.getFoldersByName("02_Entregas_Actividades");
    if (entregasIter.hasNext()) {
      entregasFolder = entregasIter.next();
    } else {
      entregasFolder = courseFolder.createFolder("02_Entregas_Actividades");
    }

    // Buscar o crear carpeta de la unidad
    var unitFolderName = "Unidad " + unitNumber + (unitTitle ? " — " + unitTitle : "");
    var unitFolder;
    var unitIter = entregasFolder.getFoldersByName(unitFolderName);
    if (unitIter.hasNext()) {
      unitFolder = unitIter.next();
    } else {
      unitFolder = entregasFolder.createFolder(unitFolderName);
    }

    // Buscar o crear carpeta de la actividad
    var activityFolder;
    var activityIter = unitFolder.getFoldersByName(activityTitle);
    if (activityIter.hasNext()) {
      activityFolder = activityIter.next();
    } else {
      activityFolder = unitFolder.createFolder(activityTitle);
    }

    var targetFolder = activityFolder;

    // Si la actividad es por equipos, anidar una subcarpeta exclusiva del equipo
    if (teamName) {
      var teamIter = activityFolder.getFoldersByName(teamName);
      targetFolder = teamIter.hasNext() ? teamIter.next() : activityFolder.createFolder(teamName);
    }

    return {
      success: true,
      drive_folder_id: targetFolder.getId(),
      activity_folder_id: activityFolder.getId(),
      folder_url: "https://drive.google.com/drive/folders/" + targetFolder.getId()
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Descarga un archivo de Drive por su fileId y lo devuelve como base64 —
 * usado por evaluate-submissions-ia para mandar a Gemini el archivo que un
 * alumno entregó (ahora vive en Drive, no en Supabase Storage).
 */
function obtenerArchivoBase64(payload) {
  const { fileId } = payload;
  if (!fileId) return { success: false, error: "Falta fileId." };
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    return {
      success: true,
      base64Data: Utilities.base64Encode(blob.getBytes()),
      mimeType: blob.getContentType(),
      fileName: file.getName()
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Función de emergencia: Crea el Sheet si las carpetas ya existen pero el archivo no.
 */
function crearSoloSheet(payload) {
  const { folderId, nombreMateria } = payload;
  try {
    const folder = DriveApp.getFolderById(folderId);
    const sheet = SpreadsheetApp.create("Control Maestro: " + nombreMateria);
    DriveApp.getFileById(sheet.getId()).moveTo(folder);
    
    let alumnosSheet = sheet.getSheets()[0];
    alumnosSheet.setName("LISTA_ASISTENCIA");
    alumnosSheet.appendRow(["Matrícula", "Apellido Paterno", "Apellido Materno", "Nombres", "Correo", "Equipo"]);
    alumnosSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#1B396A").setFontColor("white");
    
    return { success: true, sheetId: sheet.getId() };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}