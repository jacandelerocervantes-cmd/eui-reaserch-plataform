/**
 * GESTIÓN DE ASISTENCIAS - EUI PLATFORM
 */

/**
 * ACCIÓN 1: Registrar la asistencia diaria (Radar In-Situ)
 */
function registrarAsistenciaSheet(payload) {
  const { googleSheetId, asistenciaMap } = payload; 
  
  try {
    const ss = SpreadsheetApp.openById(googleSheetId);
    let sheet = ss.getSheetByName("LISTA_ASISTENCIA");
    if (!sheet) throw new Error("No se encontró la hoja LISTA_ASISTENCIA");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const hoy = Utilities.formatDate(new Date(), "GMT-6", "dd/MM/yyyy");

    // Buscar o crear la columna de la fecha de hoy
    let colIndex = headers.indexOf(hoy);
    if (colIndex === -1) {
      colIndex = headers.length;
      sheet.getRange(1, colIndex + 1).setValue(hoy)
           .setFontWeight("bold").setBackground("#1B396A").setFontColor("white").setHorizontalAlignment("center");
    }

    // Mapear alumnos por matrícula y marcar asistencia
    const matriculasEnSheet = data.map(row => row[0].toString());
    const columnValues = [];
    for (let i = 1; i < matriculasEnSheet.length; i++) {
      const matricula = matriculasEnSheet[i];
      const valor = asistenciaMap[matricula];
      
      let mark = "";
      if (valor === 1) mark = "1";
      else if (valor === 0.5) mark = "/";
      else if (valor === 0) mark = "X";
      
      columnValues.push([mark]);
    }

    if (columnValues.length > 0) {
      sheet.getRange(2, colIndex + 1, columnValues.length, 1).setValues(columnValues);
    }

    return { success: true, message: "Asistencia diaria registrada" };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * ACCIÓN 2: Reconstruir el historial completo con Formato Condicional
 */
function actualizarHistorialCompleto(payload) {
  const { googleSheetId, alumnos } = payload;
  
  try {
    const ss = SpreadsheetApp.openById(googleSheetId);
    let sheet = ss.getSheetByName("LISTA_ASISTENCIA");
    if (!sheet) sheet = ss.insertSheet("LISTA_ASISTENCIA");
    
    sheet.clear();
    
    // 1. Cabeceras
    const dates = alumnos[0].asistencias.map(a => `${a.fecha}\nS${a.sesion}`);
    const headers = ["Matrícula", "Nombre Completo", ...dates, "% Total", "Examen"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1B396A").setFontColor("white").setHorizontalAlignment("center");

    // 2. Filas de Alumnos
    const rows = alumnos.map(al => {
      const asistenciasValues = al.asistencias.map(a => {
        if (a.estatus === 1) return "1";
        if (a.estatus === 0.5) return "/";
        return "X";
      });
      return [
        al.matricula,
        al.nombre_completo,
        ...asistenciasValues,
        `${Math.round(al.resumen.porcentaje)}%`,
        al.resumen.derecho_examen ? "SÍ" : "NO"
      ];
    });

    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    
    // 3. Estilo y Formato Condicional para % Total
    const pctCol = headers.indexOf("% Total") + 1;
    const range = sheet.getRange(2, pctCol, rows.length, 1);
    
    // Regla: Si el porcentaje es menor a 80%, poner en rojo
    const rule = SpreadsheetApp.newConditionalFormatRule()
        .whenNumberLessThan(0.8) // Nota: Apps Script requiere a veces el valor decimal o texto según el formato de celda
        .setBackground("#fee2e2")
        .setFontColor("#ef4444")
        .setRanges([range])
        .build();
    
    sheet.setConditionalFormatRules([rule]);
    sheet.setFrozenColumns(2); // Inmovilizar matrícula y nombre

    return { success: true, message: "Historial completo sincronizado" };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}