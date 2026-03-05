/**
 * ROUTER PRINCIPAL - EUI RESEARCH PLATFORM
 * Centraliza las llamadas desde Supabase Edge Functions hacia Google Services.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action; 
    const payload = body.payload || {};
    let resultData;

    console.log("Acción recibida: " + action);

    switch (action) {
      case 'getDashboardData':
        resultData = {
          emails: extraerUltimosCorreos(),
          agenda: obtenerEventosCalendario(),
          tasks: obtenerTareasResumen()
        };
        break;
      case 'setupMateria': 
        resultData = crearEntornoMateria(payload); 
        break;
      case 'crearSoloSheet':
        resultData = crearSoloSheet(payload);
        break;
      case 'sincronizarAlumno':
        resultData = sincronizarAlumnoSheet(payload); 
        break;
      case 'registrarAsistencia':
        resultData = registrarAsistenciaSheet(payload);
        break;
      default: 
        throw new Error("ACCIÓN_NO_RECONOCIDA: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: resultData }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}