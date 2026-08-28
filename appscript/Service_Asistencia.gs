/**
 * GESTIÓN DE ASISTENCIAS - EUI PLATFORM
 */

/**
 * ACCIÓN 1: Registrar la asistencia diaria (Radar In-Situ)
 */
function registrarAsistenciaSheet(payload) {
  const { googleSheetId, asistenciaMap, fecha, sessionNumber } = payload; 
  
  try {
    const ss = SpreadsheetApp.openById(googleSheetId);
    let sheet = ss.getSheetByName("LISTA_ASISTENCIA");
    if (!sheet) {
      sheet = ss.insertSheet("LISTA_ASISTENCIA");
      sheet.appendRow(["Matrícula", "Apellido Paterno", "Apellido Materno", "Nombres", "Correo"]);
      sheet.getRange("A1:E1").setFontWeight("bold").setBackground("#1B396A").setFontColor("white");
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Formatear la fecha y número de sesión: ej. "28/08/2026 (S1)" o "28/08/2026 (S2)"
    var fechaFormatted = Utilities.formatDate(new Date(), "GMT-6", "dd/MM/yyyy");
    if (fecha) {
      var parts = fecha.split('-');
      if (parts.length === 3) {
        fechaFormatted = parts[2] + "/" + parts[1] + "/" + parts[0];
      }
    }
    var numSesion = sessionNumber ? " (S" + sessionNumber + ")" : " (S1)";
    var colHeader = fechaFormatted + numSesion;

    // Buscar o crear la columna específica de esta fecha y sesión
    let colIndex = headers.indexOf(colHeader);
    if (colIndex === -1) {
      colIndex = headers.length;
      sheet.getRange(1, colIndex + 1).setValue(colHeader)
           .setFontWeight("bold").setBackground("#1B396A").setFontColor("white").setHorizontalAlignment("center");
    }

    // Mapear alumnos por matrícula y marcar asistencia
    const matriculasEnSheet = data.map(row => row[0].toString());
    const columnValues = [];
    for (let i = 1; i < matriculasEnSheet.length; i++) {
      const matricula = matriculasEnSheet[i];
      const valor = asistenciaMap ? asistenciaMap[matricula] : undefined;
      
      let mark = "";
      if (valor === 1) mark = "1";
      else if (valor === 0.5) mark = "/";
      else if (valor === 0) mark = "X";
      
      columnValues.push([mark]);
    }

    if (columnValues.length > 0) {
      sheet.getRange(2, colIndex + 1, columnValues.length, 1).setValues(columnValues);
    }

    return { success: true, message: "Asistencia registrada en columna: " + colHeader };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * ACCIÓN 2: Sellar la asistencia de una unidad en su propia pestaña.
 * Crea el sheet si no existe. Crea o sobreescribe la pestaña "UNIDAD X".
 */
function actualizarHistorialCompleto(payload) {
  const { googleSheetId, alumnos, unitNumber, unitTitle } = payload;

  try {
    if (!alumnos || alumnos.length === 0) {
      return { success: false, error: "No hay alumnos en el payload." };
    }

    const ss = SpreadsheetApp.openById(googleSheetId);
    const tabName = unitNumber
      ? ("UNIDAD " + unitNumber + (unitTitle ? " - " + unitTitle : ""))
      : "LISTA_ASISTENCIA";

    // Buscar la pestaña o crearla
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    } else {
      sheet.clear();
    }

    // 1. Cabeceras
    const dates = alumnos[0].asistencias.map(function(a) {
      return a.fecha + "\nS" + a.sesion;
    });
    const headers = ["Matrícula", "Nombre Completo"].concat(dates).concat(["% Total", "Examen"]);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#1B396A")
      .setFontColor("white")
      .setHorizontalAlignment("center");

    // 2. Filas de alumnos
    const rows = alumnos.map(function(al) {
      const asistenciasValues = al.asistencias.map(function(a) {
        if (a.estatus === 1) return "1";
        if (a.estatus === 0.5) return "/";
        return "X";
      });
      return [al.matricula, al.nombre_completo]
        .concat(asistenciasValues)
        .concat([
          Math.round(al.resumen.porcentaje) + "%",
          al.resumen.derecho_examen ? "SÍ" : "NO"
        ]);
    });

    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

    // 3. Formato condicional — rojo si < 80%
    const pctCol = headers.indexOf("% Total") + 1;
    const pctRange = sheet.getRange(2, pctCol, rows.length, 1);
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("X")  // fallback visual
      .setBackground("#fee2e2")
      .setFontColor("#ef4444")
      .setRanges([pctRange])
      .build();
    sheet.setConditionalFormatRules([rule]);
    sheet.setFrozenColumns(2);
    sheet.autoResizeColumns(1, headers.length);

    // 4. Mover la pestaña al final (orden cronológico)
    ss.moveActiveSheet(ss.getNumSheets());

    // 5. Eliminar la pestaña de trabajo LISTA_ASISTENCIA — ya no es necesaria
    var listaTab = ss.getSheetByName("LISTA_ASISTENCIA");
    if (listaTab && ss.getNumSheets() > 1) {
      ss.deleteSheet(listaTab);
    }

    return { success: true, message: "Unidad " + (unitNumber || "") + " sellada en pestaña: " + tabName };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}