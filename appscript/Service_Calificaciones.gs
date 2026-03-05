/**
 * Genera la Sábana de Notas con doble encabezado y promedios finales
 */
function actualizarSabanaNotas(payload) {
  const { googleSheetId, dataMatrix } = payload;
  
  try {
    const ss = SpreadsheetApp.openById(googleSheetId);
    let sheet = ss.getSheetByName("SABANA_NOTAS");
    if (!sheet) sheet = ss.insertSheet("SABANA_NOTAS");
    
    sheet.clear();

    // 1. Estructura de Encabezados (Fila 1: Unidades, Fila 2: Criterios)
    const row1 = ["", ""]; // Espacio para Matrícula y Nombre
    const row2 = ["MATRÍCULA", "ALUMNO"];
    
    dataMatrix.unidades.forEach(u => {
      row1.push(`UNIDAD ${u.numero}: ${u.nombre}`);
      u.criterios.forEach(c => {
        row1.push(""); // Celdas vacías para combinar después
        row2.push(`${c.nombre} (${c.valor}%)`);
      });
      row2.push("PROMEDIO U");
    });
    row1.push("ACTA FINAL");
    row2.push("PROMEDIO");

    sheet.appendRow(row1);
    sheet.appendRow(row2);

    // 2. Insertar Datos de Alumnos
    const studentRows = dataMatrix.alumnos.map(al => {
      const fila = [al.matricula, al.nombre];
      al.unidades.forEach(u => {
        u.notas.forEach(n => fila.push(n));
        fila.push(u.promedioUnidad);
      });
      fila.push(al.promedioFinal);
      return fila;
    });

    sheet.getRange(3, 1, studentRows.length, row2.length).setValues(studentRows);

    // 3. Estética y Formato
    const lastCol = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    
    // Formato de encabezados
    sheet.getRange(1, 1, 2, lastCol).setFontWeight("bold").setBackground("#1B396A").setFontColor("white").setHorizontalAlignment("center");
    
    // Inmovilizar datos básicos
    sheet.setFrozenColumns(2);
    sheet.setFrozenRows(2);

    // Formato condicional para aprobados/reprobados (Rojo < 70)
    const range = sheet.getRange(3, 3, studentRows.length, lastCol - 2);
    const ruleReprobado = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(70)
      .setFontColor("#ef4444")
      .setBackground("#fee2e2")
      .setRanges([range])
      .build();
    sheet.setConditionalFormatRules([ruleReprobado]);

    return { success: true, message: "Sábana de notas generada" };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}