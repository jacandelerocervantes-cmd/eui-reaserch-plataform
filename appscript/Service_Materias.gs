/**
 * Crea la jerarquía completa de carpetas y el Sheet inicial.
 */
function crearEntornoMateria(payload) {
  const parentFolder = DriveApp.getFolderById(payload.parentFolderId);
  const folderName = payload.nombre + " - " + payload.clave;
  const courseFolder = parentFolder.createFolder(folderName);

  const folderMateriales = courseFolder.createFolder("01_Materiales_Boveda");
  const folderActividades = courseFolder.createFolder("02_Entregas_Actividades");
  const folderCalificaciones = courseFolder.createFolder("03_Calificaciones_Asistencias");
  const folderIA = courseFolder.createFolder("04_Generados_por_IA");

  const sheet = SpreadsheetApp.create("Control Maestro: " + folderName);
  DriveApp.getFileById(sheet.getId()).moveTo(folderCalificaciones);

  // Inicializar hoja de alumnos
  let alumnosSheet = sheet.getSheets()[0];
  alumnosSheet.setName("LISTA_ASISTENCIA");
  alumnosSheet.appendRow(["Matrícula", "Apellido Paterno", "Apellido Materno", "Nombres", "Correo", "Equipo"]);
  alumnosSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#1B396A").setFontColor("white");

  return {
    drive_folder_id: courseFolder.getId(),
    google_sheet_id: sheet.getId()
  };
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