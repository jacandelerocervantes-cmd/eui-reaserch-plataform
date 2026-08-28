/**
 * GESTIÓN DE ASISTENCIAS - EUI PLATFORM
 */

/**
 * ACCIÓN 1: Registrar la asistencia diaria (Radar In-Situ)
 * Sincroniza la sesión en la pestaña de la Unidad correspondiente (ej. "UNIDAD 1").
 * Mantiene intacta la pestaña "LISTA_ALUMNOS" como directorio maestro.
 */
function registrarAsistenciaSheet(payload) {
  const { googleSheetId, asistenciaMap, fecha, sessionNumber, unitNumber } = payload; 
  
  try {
    const ss = SpreadsheetApp.openById(googleSheetId);
    
    // 1. Localizar o crear la Pestaña Maestra de Alumnos (LISTA_ALUMNOS)
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

    // 2. Determinar la pestaña de la Unidad correspondiente (ej. "UNIDAD 1")
    const uNum = unitNumber || 1;
    const tabName = "UNIDAD " + uNum;
    let sheet = ss.getSheetByName(tabName);

    // Si la pestaña de la unidad aún no existe, se crea con los alumnos de LISTA_ALUMNOS
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(["Matrícula", "Nombre Completo"]);
      sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#1B396A").setFontColor("white");

      const mData = masterSheet.getDataRange().getValues();
      for (let i = 1; i < mData.length; i++) {
        const mat = mData[i][0];
        const nom = (mData[i][1] + " " + (mData[i][2] || "") + " " + mData[i][3]).trim();
        if (mat) sheet.appendRow([mat, nom]);
      }
    }

    // 3. Formatear la fecha y número de sesión: ej. "28/08/2026 (S1)" o "28/08/2026 (S2)"
    var fechaFormatted = Utilities.formatDate(new Date(), "GMT-6", "dd/MM/yyyy");
    if (fecha) {
      var parts = fecha.split('-');
      if (parts.length === 3) {
        fechaFormatted = parts[2] + "/" + parts[1] + "/" + parts[0];
      }
    }
    var numSesion = sessionNumber ? " (S" + sessionNumber + ")" : " (S1)";
    var colHeader = fechaFormatted + numSesion;

    // 4. Buscar o crear la columna específica de esta fecha y sesión en la Unidad
    let data = sheet.getDataRange().getValues();
    let headers = data[0];
    let colIndex = headers.indexOf(colHeader);
    if (colIndex === -1) {
      colIndex = headers.length;
      sheet.getRange(1, colIndex + 1).setValue(colHeader)
           .setFontWeight("bold").setBackground("#1B396A").setFontColor("white").setHorizontalAlignment("center");
      data = sheet.getDataRange().getValues();
    }

    // 5. Verificar si hay nuevos alumnos en el mapa que falten en esta pestaña
    const matriculasEnSheet = data.map(row => row[0].toString());
    if (asistenciaMap) {
      for (const mat in asistenciaMap) {
        if (matriculasEnSheet.indexOf(mat.toString()) === -1) {
          sheet.appendRow([mat, mat]);
        }
      }
      data = sheet.getDataRange().getValues();
    }

    // 6. Marcar asistencias (1 = Presente, / = Retardo, X = Falta)
    const columnValues = [];
    for (let i = 1; i < data.length; i++) {
      const matricula = data[i][0].toString();
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

    return { success: true, message: "Asistencia registrada en " + tabName + " (" + colHeader + ")" };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * ACCIÓN 2: Sellar la asistencia de una unidad completa en su propia pestaña.
 * Vuelca todo el historial y calcula derecho a examen sin tocar LISTA_ALUMNOS.
 */
function actualizarHistorialCompleto(payload) {
  const { googleSheetId, alumnos, unitNumber, unitTitle } = payload;

  try {
    if (!alumnos || alumnos.length === 0) {
      return { success: false, error: "No hay alumnos en el payload." };
    }

    const ss = SpreadsheetApp.openById(googleSheetId);
    const uNum = unitNumber || 1;
    const tabName = "UNIDAD " + uNum + (unitTitle ? " - " + unitTitle : "");

    // Buscar la pestaña de la unidad o crearla
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    } else {
      sheet.clear();
    }

    // 1. Cabeceras
    const dates = alumnos[0].asistencias.map(function(a) {
      return a.fecha + " (S" + a.sesion + ")";
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
      .whenTextContains("X")
      .setBackground("#fee2e2")
      .setFontColor("#ef4444")
      .setRanges([pctRange])
      .build();
    sheet.setConditionalFormatRules([rule]);
    sheet.setFrozenColumns(2);
    sheet.autoResizeColumns(1, headers.length);

    return { success: true, message: "Unidad " + uNum + " sellada exitosamente en pestaña: " + tabName };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}