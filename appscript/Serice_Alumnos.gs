/**
 * Gestiona la sincronización de alumnos con la Sábana de la materia
 */
function sincronizarAlumnoSheet(payload) {
  const { googleSheetId, studentData, mode } = payload;
  
  if (!googleSheetId) throw new Error("ID de Google Sheet no proporcionado");

  try {
    const ss = SpreadsheetApp.openById(googleSheetId);
    let sheet = ss.getSheetByName("LISTA_ASISTENCIA");
    
    // Si la hoja no existe (por si acaso), se crea con cabeceras
    if (!sheet) {
      sheet = ss.insertSheet("LISTA_ASISTENCIA");
      sheet.appendRow(["Matrícula", "Apellido Paterno", "Apellido Materno", "Nombres", "Correo", "Equipo"]);
      sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#1B396A").setFontColor("white");
    }

    const data = sheet.getDataRange().getValues();
    const matriculas = data.map(row => row[0].toString());
    const rowIndex = matriculas.indexOf(studentData.matricula.toString());

    const rowData = [
      studentData.matricula,
      studentData.apellido_paterno,
      studentData.apellido_materno || "",
      studentData.nombres,
      studentData.correo || "",
      studentData.team_name || "Sin equipo"
    ];

    if (mode === 'delete') {
      if (rowIndex !== -1) {
        sheet.deleteRow(rowIndex + 1);
        return { success: true, message: "Alumno eliminado del Sheet" };
      }
      return { success: true, message: "Alumno no estaba en el Sheet" };
    }

    if (rowIndex !== -1) {
      // ACTUALIZAR: El alumno ya existe en la fila rowIndex + 1
      sheet.getRange(rowIndex + 1, 1, 1, rowData.length).setValues([rowData]);
      return { success: true, message: "Alumno actualizado en Sheet" };
    } else {
      // INSERTAR: Nuevo alumno
      sheet.appendRow(rowData);
      return { success: true, message: "Alumno agregado a Sheet" };
    }

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}