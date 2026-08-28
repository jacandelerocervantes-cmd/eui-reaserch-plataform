/**
 * Gestiona la sincronización de alumnos con la Sábana de la materia
 */
function sincronizarAlumnoSheet(payload) {
  const { googleSheetId, studentData, mode } = payload;
  
  if (!googleSheetId) throw new Error("ID de Google Sheet no proporcionado");

  try {
    const ss = SpreadsheetApp.openById(googleSheetId);
    
    // 1. Pestaña Principal: LISTA_ALUMNOS (Roster Maestro con Equipos)
    let masterSheet = ss.getSheetByName("LISTA_ALUMNOS");
    if (!masterSheet) {
      masterSheet = ss.getSheetByName("LISTA_ASISTENCIA");
      if (masterSheet) {
        masterSheet.setName("LISTA_ALUMNOS");
      } else {
        masterSheet = ss.insertSheet("LISTA_ALUMNOS", 0);
        masterSheet.appendRow(["Matrícula", "Apellido Paterno", "Apellido Materno", "Nombres", "Correo", "Equipos"]);
        masterSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#1B396A").setFontColor("white");
      }
    }

    const data = masterSheet.getDataRange().getValues();
    const matriculas = data.map(row => row[0].toString());
    const rowIndex = matriculas.indexOf(studentData.matricula.toString());

    const rowData = [
      studentData.matricula,
      studentData.apellido_paterno,
      studentData.apellido_materno || "",
      studentData.nombres,
      studentData.correo || "",
      studentData.teams || studentData.team_name || "Sin equipos"
    ];

    if (mode === 'delete') {
      if (rowIndex !== -1) {
        masterSheet.deleteRow(rowIndex + 1);
      }
    } else {
      if (rowIndex !== -1) {
        masterSheet.getRange(rowIndex + 1, 1, 1, rowData.length).setValues([rowData]);
      } else {
        masterSheet.appendRow(rowData);
      }
    }

    // 2. Sincronizar en todas las pestañas existentes de UNIDAD X
    const sheets = ss.getSheets();
    const nombreCompleto = (studentData.apellido_paterno + " " + (studentData.apellido_materno || "") + " " + studentData.nombres).trim();
    
    sheets.forEach(function(sh) {
      const shName = sh.getName();
      if (shName.indexOf("UNIDAD") === 0) {
        const uData = sh.getDataRange().getValues();
        const uMats = uData.map(r => r[0].toString());
        const uIndex = uMats.indexOf(studentData.matricula.toString());
        
        if (mode === 'delete') {
          if (uIndex !== -1) sh.deleteRow(uIndex + 1);
        } else {
          if (uIndex !== -1) {
            sh.getRange(uIndex + 1, 2).setValue(nombreCompleto);
          } else {
            sh.appendRow([studentData.matricula, nombreCompleto]);
          }
        }
      }
    });

    return { success: true, message: "Alumno sincronizado en LISTA_ALUMNOS y pestañas de Unidades" };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}