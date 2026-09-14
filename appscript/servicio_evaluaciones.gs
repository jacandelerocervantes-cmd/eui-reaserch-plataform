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
  const { title, questions, unitName, examId } = payload;

  try {
    const form = FormApp.create(`[EUI-EVAL] ${title}`)
        .setTitle(title)
        .setDescription(`Unidad: ${unitName}\nGenerado por Certeza AIA - EUI Research Platform`)
        .setIsQuiz(true) // Crucial: lo convierte en cuestionario calificado
        .setCollectEmail(true)
        .setLimitOneResponsePerUser(true);

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
