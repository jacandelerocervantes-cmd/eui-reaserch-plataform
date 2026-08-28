/**
 * ROUTER PRINCIPAL — EUI RESEARCH PLATFORM
 * Centraliza las llamadas desde Supabase Edge Functions hacia Google Services.
 *
 * SEGURIDAD: Todas las peticiones deben incluir el campo 'secret' que coincida
 * con la Script Property 'WEBHOOK_SECRET'. Configurar en:
 *   Apps Script → Ajustes → Propiedades del script → WEBHOOK_SECRET = <valor_aleatorio>
 * El mismo valor debe estar en los Supabase Secrets como APPS_SCRIPT_SECRET.
 */

/** Valida el secreto compartido. Retorna true si la petición es legítima. */
function isAuthorized_(body) {
  var secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret) {
    console.error('[ROUTER] WEBHOOK_SECRET no está configurado en Script Properties.');
    return false;
  }
  return body.secret === secret;
}

function doPost(e) {
  var startTime = new Date().toISOString();
  var action = 'UNKNOWN';

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return buildError_('Petición vacía o malformada.', 400);
    }

    var body = JSON.parse(e.postData.contents);
    action = body.action || 'MISSING_ACTION';

    // ── Validación del secreto compartido ──────────────────────────────────
    // Sin esto, cualquier persona con la URL puede ejecutar cualquier acción
    // con los permisos OAuth del propietario del script.
    if (!isAuthorized_(body)) {
      console.error('[ROUTER] Petición rechazada: secreto inválido. Acción intentada: ' + action);
      return buildError_('No autorizado.', 403);
    }

    var payload = body.payload || {};
    var resultData;

    console.log('[ROUTER] ' + startTime + ' | Acción: ' + action);

    switch (action) {
      case 'getDashboardData':
        resultData = {
          emails:  extraerUltimosCorreos(),
          agenda:  obtenerEventosCalendario(),
          tasks:   obtenerTareasResumen()
        };
        break;

      case 'obtenerCorreos':
        resultData = extraerUltimosCorreos();
        break;

      case 'obtenerEventosCalendario':
        resultData = obtenerEventosCalendario();
        break;

      case 'obtenerListasTareas':
        resultData = obtenerListasTareas();
        break;

      case 'obtenerTareasPorLista':
        resultData = obtenerTareasPorLista(payload.idLista);
        break;

      case 'obtenerCitas':
        resultData = obtenerCitasSincronizadas();
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

      case 'actualizarHistorialCompleto':
        resultData = actualizarHistorialCompleto(payload);
        break;

      case 'actualizarSabanaNotas':
        resultData = actualizarSabanaNotas(payload);
        break;

      case 'notificarAviso':
        resultData = enviarNotificacionAviso(payload);
        break;

      case 'crearTareaRapida':
        resultData = crearTareaRapida(payload);
        break;

      case 'crearReunionRapida':
        resultData = crearReunionRapida(payload);
        break;

      case 'crearEntornoWorkspace':
        resultData = crearEntornoWorkspace(payload);
        break;

      case 'moverArchivoACarpeta':
        resultData = moverArchivoACarpeta(payload);
        break;

      case 'analizarHistorialEntrega':
        resultData = analizarHistorialEntrega(payload);
        break;

      case 'revocarAccesoArchivo':
        resultData = revocarAccesoArchivo(payload);
        break;

      case 'obtenerTextoPlano':
        resultData = obtenerTextoPlano(payload);
        break;

      case 'crearCarpetaActividad':
        resultData = crearCarpetaActividad(payload);
        break;

      case 'crearCarpetaUnidadMaterial':
        resultData = crearCarpetaUnidadMaterial(payload);
        break;

      case 'subirArchivoMaterial':
        resultData = subirArchivoMaterial(payload);
        break;

      case 'obtenerArchivoBase64':
        resultData = obtenerArchivoBase64(payload);
        break;

      case 'crearPresentacionSlides':
        resultData = crearPresentacionSlides(payload);
        break;

      case 'crearRubricaSheet':
        resultData = crearRubricaSheet(payload);
        break;

      case 'crearDocInformativoActividad':
        resultData = crearDocInformativoActividad(payload);
        break;

      case 'enviarCorreoActividad':
        resultData = enviarCorreoActividad(payload);
        break;

      case 'enviarCorreoResultadosExamen':
        resultData = enviarCorreoResultadosExamen(payload);
        break;

      case 'guardarCargaHoraria':
        resultData = guardarCargaHoraria(payload);
        break;

      case 'crearFormularioGoogle':
        resultData = crearFormularioGoogle(payload);
        break;

      case 'subirMaterialHibrido':
        resultData = subirMaterialHibrido(payload);
        break;

      case 'sendEmail':
        resultData = enviarCorreoInvitacion(payload);
        break;

      default:
        console.error('[ROUTER] Acción no reconocida: ' + action);
        return buildError_('Acción no reconocida: ' + action, 404);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: resultData }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('[ROUTER] Error en acción "' + action + '": ' + error.toString());
    return buildError_(error.toString(), 500);
  }
}

/** Envía un correo simple vía Gmail. Usado para invitaciones a proyectos. */
function enviarCorreoInvitacion(payload) {
  if (!payload.to || !payload.subject || !payload.body) {
    throw new Error('sendEmail: se requieren to, subject y body');
  }
  GmailApp.sendEmail(payload.to, payload.subject, payload.body, {
    name: 'Plataforma EUI Research'
  });
  console.log('[sendEmail] Correo enviado a: ' + payload.to);
  return { enviado: true, destinatario: payload.to };
}

/** Construye una respuesta de error con código HTTP (Apps Script solo puede cambiar el body). */
function buildError_(message, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: message, statusCode: statusCode }))
    .setMimeType(ContentService.MimeType.JSON);
}
