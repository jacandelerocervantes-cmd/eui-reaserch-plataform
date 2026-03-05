/**
 * SERVICIO DE GOOGLE WORKSPACE (Docs, Sheets, Slides)
 * Crea entornos colaborativos para las actividades de los alumnos.
 */

function crearEntornoWorkspace(payload) {
  const { title, description, documentType, emails, rubric } = payload;
  let fileId = "";
  let fileUrl = "";

  try {
    // 1. CREACIÓN SEGÚN EL TIPO DE DOCUMENTO
    if (documentType === 'doc') {
      const doc = DocumentApp.create(title);
      const body = doc.getBody();
      
      body.appendParagraph("Instrucciones de la Actividad").setHeading(DocumentApp.ParagraphHeading.HEADING1);
      body.appendParagraph(description).setSpacingAfter(20);
      
      if (rubric && rubric.length > 0) {
        body.appendParagraph("Rúbrica de Evaluación").setHeading(DocumentApp.ParagraphHeading.HEADING2);
        const tableData = [["Criterio", "Descripción", "Valor (%)"]];
        rubric.forEach(r => tableData.push([r.name, r.description, r.weight.toString()]));
        
        const table = body.appendTable(tableData);
        table.getRow(0).editAsText().setBold(true);
      }
      fileId = doc.getId();
      fileUrl = doc.getUrl();

    } else if (documentType === 'sheet') {
      const ss = SpreadsheetApp.create(title);
      const sheet = ss.getActiveSheet();
      sheet.setName("Entregable");
      
      sheet.getRange("A1").setValue("Instrucciones:").setFontWeight("bold");
      sheet.getRange("A2").setValue(description);
      
      if (rubric && rubric.length > 0) {
        const rubricSheet = ss.insertSheet("Rúbrica de Evaluación");
        const tableData = [["Criterio", "Descripción", "Valor (%)"]];
        rubric.forEach(r => tableData.push([r.name, r.description, r.weight.toString()]));
        rubricSheet.getRange(1, 1, tableData.length, 3).setValues(tableData);
        rubricSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#1B396A").setFontColor("white");
        rubricSheet.autoResizeColumns(1, 3);
      }
      fileId = ss.getId();
      fileUrl = ss.getUrl();

    } else if (documentType === 'slide') {
      const presentation = SlidesApp.create(title);
      const slide = presentation.getSlides()[0];
      
      // Agregamos un cuadro de texto con las instrucciones en la primera diapositiva
      const shape = slide.insertTextBox("Instrucciones:\n" + description);
      shape.setLeft(50).setTop(50).setWidth(600).setHeight(150);
      
      fileId = presentation.getId();
      fileUrl = presentation.getUrl();
    } else {
      throw new Error("Tipo de documento no soportado: " + documentType);
    }

    // 2. GESTIÓN DE PERMISOS (Compartir con los alumnos)
    if (emails && emails.length > 0) {
      const driveFile = DriveApp.getFileById(fileId);
      // addEditors envía un correo automático a los alumnos avisando que se les compartió el archivo
      driveFile.addEditors(emails); 
    }

    return { 
      success: true, 
      fileId: fileId, 
      fileUrl: fileUrl,
      message: `Archivo ${documentType} creado y compartido exitosamente.` 
    };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}