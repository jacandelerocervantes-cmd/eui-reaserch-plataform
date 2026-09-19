/**
 * SERVICIO: servicio_evaluaciones.gs
 * Módulo: Generador de Google Forms (Quizzes) a partir de un examen interno,
 * + sincronización de respuestas de vuelta a la plataforma.
 *
 * Vocabulario de "type" — el mismo enum en inglés que usa la base de datos
 * (public.question_type): multiple_choice, true_false, open, matching,
 * short_answer, fill_blank, ordering, multi_select.
 *
 * Limitación real de la API de Forms (no es un bug, es el límite de lo que
 * Apps Script expone): MultipleChoiceItem, CheckboxItem y ListItem soportan
 * calificación automática nativa (setPoints + choice marcada como correcta).
 * TextItem/ParagraphTextItem NO tienen gancho de "respuesta correcta" en la
 * API — por eso short_answer, fill_blank y open quedan para calificación
 * manual dentro de Forms. matching y ordering SÍ se descomponen en varios
 * ListItem (uno por concepto/posición) para que cada uno autocalifique.
 *
 * Sincronización: cada ítem creado se registra en "itemsMap" con el
 * question_id real (uno o varios ítems por reactivo, según el tipo). Esa
 * tabla se le devuelve al edge function para que la guarde en
 * exam_form_items — es lo que permite, al recibir una entrega, reconstruir
 * la respuesta en el mismo formato que usa el examen interno.
 */
function crearFormularioGoogle(payload) {
  const { title, questions, unitName, examId, isFuture, startTimeStr } = payload;

  try {
    const form = FormApp.create(`[EUI-EVAL] ${title}`)
        .setTitle(title)
        .setDescription(`Unidad: ${unitName}\nGenerado por Certeza AIA - EUI Research Platform`)
        .setIsQuiz(true) // Crucial: lo convierte en cuestionario calificado
        .setCollectEmail(true)
        .setLimitOneResponsePerUser(true);

    if (isFuture) {
      form.setAcceptingResponses(false);
      var timeMsg = startTimeStr ? " a las " + startTimeStr : " en el horario programado";
      form.setCustomClosedFormMessage("Esta evaluación iniciará" + timeMsg + ". Por favor espera a la hora indicada para responder.");
    }

    const itemsMap = []; // {questionId, formItemId, subIndex}

    questions.forEach((q, qIdx) => {
      const points = parseInt(q.points) || 0;
      const numero = qIdx + 1;

      if (q.type === 'multiple_choice') {
        const item = form.addMultipleChoiceItem();
        item.setTitle(`${numero}. ${q.content}`).setPoints(points).setRequired(true);
        item.setChoices((q.options || []).map(opt => item.createChoice(opt, opt === q.answer)));
        itemsMap.push({ questionId: q.id, formItemId: item.getId().toString(), subIndex: null });

      } else if (q.type === 'true_false') {
        const item = form.addMultipleChoiceItem();
        item.setTitle(`${numero}. ${q.content}`).setPoints(points).setRequired(true);
        item.setChoices(['Verdadero', 'Falso'].map(opt => item.createChoice(opt, opt === q.answer)));
        itemsMap.push({ questionId: q.id, formItemId: item.getId().toString(), subIndex: null });

      } else if (q.type === 'multi_select') {
        const item = form.addCheckboxItem();
        item.setTitle(`${numero}. ${q.content}`).setPoints(points).setRequired(true);
        const correctas = Array.isArray(q.correct) ? q.correct : [];
        item.setChoices((q.options || []).map(opt => item.createChoice(opt, correctas.indexOf(opt) !== -1)));
        itemsMap.push({ questionId: q.id, formItemId: item.getId().toString(), subIndex: null });

      } else if (q.type === 'matching') {
        // Forms no tiene un ítem nativo de "relacionar columnas" con
        // autocalificación — se descompone en un ListItem (dropdown) por
        // cada concepto de la izquierda, cada uno autocalificable.
        (q.left || []).forEach((concepto, i) => {
          const item = form.addListItem();
          item.setTitle(`${numero}.${i + 1}. ${q.content} — "${concepto}" corresponde a:`)
              .setPoints(Math.round((points / (q.left.length || 1)) * 100) / 100)
              .setRequired(true);
          const correctIdx = Array.isArray(q.correct) ? q.correct[i] : undefined;
          const correcta = q.right?.[correctIdx];
          item.setChoices((q.right || []).map(opt => item.createChoice(opt, opt === correcta)));
          itemsMap.push({ questionId: q.id, formItemId: item.getId().toString(), subIndex: i });
        });

      } else if (q.type === 'ordering') {
        // Mismo principio: un ListItem por posición, autocalificable.
        const items = q.options?.items || q.options || [];
        items.forEach((_, posIdx) => {
          const item = form.addListItem();
          item.setTitle(`${numero}.${posIdx + 1}. ${q.content} — ¿Qué va en la posición ${posIdx + 1}?`)
              .setPoints(Math.round((points / (items.length || 1)) * 100) / 100)
              .setRequired(true);
          const correcta = items[posIdx];
          item.setChoices(items.map(opt => item.createChoice(opt, opt === correcta)));
          itemsMap.push({ questionId: q.id, formItemId: item.getId().toString(), subIndex: posIdx });
        });

      } else if (q.type === 'short_answer') {
        const item = form.addTextItem();
        item.setTitle(`${numero}. ${q.content}`)
            .setPoints(points)
            .setHelpText('Respuesta corta: Forms no autocalifica este tipo, pero la plataforma sí la recalifica automáticamente al recibirla.')
            .setRequired(true);
        itemsMap.push({ questionId: q.id, formItemId: item.getId().toString(), subIndex: null });

      } else if (q.type === 'fill_blank') {
        const item = form.addParagraphTextItem();
        item.setTitle(`${numero}. ${q.content}`)
            .setPoints(points)
            .setHelpText('Completar espacios en blanco: escribe cada respuesta en una línea separada, en el orden de los espacios (___).')
            .setRequired(true);
        itemsMap.push({ questionId: q.id, formItemId: item.getId().toString(), subIndex: null });

      } else if (q.type === 'open') {
        const item = form.addParagraphTextItem();
        item.setTitle(`${numero}. ${q.content}`)
            .setPoints(points)
            .setHelpText('Pregunta abierta: requiere calificación manual.')
            .setRequired(true);
        itemsMap.push({ questionId: q.id, formItemId: item.getId().toString(), subIndex: null });
      }
    });

    // Trigger de sincronización: cada entrega del Form dispara
    // onExamFormSubmit, que la manda a la plataforma.
    ScriptApp.newTrigger('onExamFormSubmit').forForm(form).onFormSubmit().create();

    // El examId viaja como Script Property por ítem de trigger — Apps Script
    // no permite adjuntar datos custom al trigger, así que se guarda la
    // relación formId -> examId en una Script Property para que el handler
    // sepa a qué examen pertenece esta entrega.
    PropertiesService.getScriptProperties().setProperty('FORM_EXAM_' + form.getId(), examId);

    return {
      success: true,
      publishedUrl: form.getPublishedUrl(),
      editUrl: form.getEditUrl(),
      formId: form.getId(),
      itemsMap: itemsMap,
    };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Trigger instalable (onFormSubmit) — se ejecuta automáticamente cuando un
 * alumno entrega el Form. Empaqueta las respuestas y las manda a la edge
 * function ingest-form-response, que las traduce al formato interno y las
 * guarda en evaluation_responses para que el resto de la plataforma
 * (calificación, revisión, resultados) las trate igual que un examen interno.
 */
function onExamFormSubmit(e) {
  try {
    const form = e.source;
    const examId = PropertiesService.getScriptProperties().getProperty('FORM_EXAM_' + form.getId());
    if (!examId) return; // formulario no generado desde la plataforma

    const respondentEmail = e.response.getRespondentEmail();
    const itemResponses = e.response.getItemResponses().map(function (ir) {
      return {
        formItemId: ir.getItem().getId().toString(),
        answer: ir.getResponse(),
      };
    });

    const INGEST_URL = PropertiesService.getScriptProperties().getProperty('INGEST_FORM_RESPONSE_URL');
    const SECRET = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!INGEST_URL) { console.error('[onExamFormSubmit] Falta la Script Property INGEST_FORM_RESPONSE_URL.'); return; }

    UrlFetchApp.fetch(INGEST_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ secret: SECRET, examId: examId, respondentEmail: respondentEmail, itemResponses: itemResponses }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error('[onExamFormSubmit] ' + err.toString());
  }
}

/**
 * Abre un Google Form para aceptar respuestas en vivo.
 */
function abrirFormularioGoogle(payload) {
  const { formId } = payload;
  if (!formId) return { success: false, error: "Falta formId." };
  try {
    const form = FormApp.openById(formId);
    form.setAcceptingResponses(true);
    return { success: true, formId: formId, acceptingResponses: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Cierra un Google Form para no aceptar más respuestas.
 */
function cerrarFormularioGoogle(payload) {
  const { formId } = payload;
  if (!formId) return { success: false, error: "Falta formId." };
  try {
    const form = FormApp.openById(formId);
    form.setAcceptingResponses(false);
    form.setCustomClosedFormMessage("Esta evaluación ha finalizado. Ya no se aceptan más respuestas.");
    return { success: true, formId: formId, acceptingResponses: false };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Envía el correo institucional previo con la liga oficial de la evaluación a los alumnos.
 */
function enviarCorreoAvisoExamen(payload) {
  const { emails, title, courseTitle, startTimeStr, endTimeStr, formUrl } = payload;
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return { success: true, message: "Sin destinatarios para notificar." };
  }

  var quota = MailApp.getRemainingDailyQuota();
  if (quota < emails.length) {
    return { success: false, error: "Cuota de correo insuficiente (quedan " + quota + ", requeridos " + emails.length + ")." };
  }

  try {
    var html =
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:14px;padding:26px;background:#ffffff;">' +
      '<div style="border-bottom:2px solid #1B396A;padding-bottom:14px;margin-bottom:20px;">' +
      '<span style="font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Certeza AIA • EUI Plataforma de Educación</span>' +
      '<h2 style="color:#1B396A;margin:8px 0 0 0;font-size:1.35rem;">Aviso de Evaluación Programada</h2>' +
      '<p style="color:#475569;font-size:14px;margin:4px 0 0 0;">Materia: <strong>' + (courseTitle || "") + '</strong></p>' +
      '</div>' +
      '<p style="color:#334155;font-size:15px;line-height:1.5;">' +
      'Estimado(a) estudiante,<br><br>' +
      'Te informamos que tu evaluación <strong>"' + (title || "Evaluación") + '"</strong> comenzará en breve.' +
      '</p>' +
      '<div style="background:#f8fafc;border-left:4px solid #1B396A;padding:14px 18px;margin:18px 0;border-radius:0 10px 10px 0;">' +
      '<p style="margin:4px 0;font-size:14px;color:#1e293b;"><strong>Horario de Inicio:</strong> ' + (startTimeStr || "Hora indicada") + '</p>' +
      '<p style="margin:4px 0;font-size:14px;color:#1e293b;"><strong>Horario de Cierre:</strong> ' + (endTimeStr || "Hora indicada") + '</p>' +
      '</div>' +
      '<p style="color:#334155;font-size:14px;line-height:1.5;">' +
      'Ten preparado tu dispositivo y conexión. Accede mediante la liga oficial a continuación (el formulario se habilitará a la hora programada):' +
      '</p>' +
      '<p style="text-align:center;margin:28px 0;">' +
      '<a href="' + formUrl + '" style="background:#1B396A;color:#ffffff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;box-shadow:0 4px 6px -1px rgba(27,57,106,0.2);">' +
      'Ingresar a la Evaluación' +
      '</a>' +
      '</p>' +
      '<p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:24px;border-top:1px solid #f1f5f9;padding-top:14px;">' +
      'Este es un mensaje institucional automático. Por favor no respondas a este correo.' +
      '</p>' +
      '</div>';

    var sentCount = 0;
    emails.forEach(function(email) {
      if (!email || typeof email !== "string" || email.indexOf("@") === -1) return;
      try {
        MailApp.sendEmail({
          to: email.trim(),
          subject: '[Aviso de Evaluación] ' + (courseTitle ? courseTitle + ' - ' : '') + title,
          htmlBody: html,
        });
        sentCount++;
      } catch (sendErr) {
        console.error('[enviarCorreoAvisoExamen] Error enviando a ' + email + ': ' + sendErr.toString());
      }
    });

    return { success: true, sentCount: sentCount };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Obtiene todas las respuestas enviadas a un Google Form.
 * Permite la sincronización bajo demanda (pull) desde la plataforma EUI Research.
 */
function obtenerRespuestasGoogleForm(payload) {
  const { formId } = payload;
  if (!formId) return { success: false, error: "Falta formId." };

  try {
    const form = FormApp.openById(formId);
    const formResponses = form.getResponses();
    const responses = [];

    for (var i = 0; i < formResponses.length; i++) {
      var fr = formResponses[i];
      var respondentEmail = fr.getRespondentEmail();
      var timestamp = fr.getTimestamp() ? fr.getTimestamp().toISOString() : null;
      var itemResponses = fr.getItemResponses();
      var mappedItems = [];

      for (var j = 0; j < itemResponses.length; j++) {
        var ir = itemResponses[j];
        mappedItems.push({
          formItemId: ir.getItem().getId().toString(),
          answer: ir.getResponse(),
        });
      }

      responses.push({
        respondentEmail: respondentEmail,
        timestamp: timestamp,
        itemResponses: mappedItems,
      });
    }

    return {
      success: true,
      formId: formId,
      responsesCount: responses.length,
      responses: responses,
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

