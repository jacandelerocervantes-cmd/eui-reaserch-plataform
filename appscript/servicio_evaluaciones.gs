/**
 * SERVICIO: servicio_evaluaciones.gs
 * Módulo: Generador de Google Forms (Quizzes)
 */

function crearFormularioGoogle(payload) {
  const { title, questions, unitName } = payload;

  try {
    // 1. Crear el Formulario en el Drive del docente
    const form = FormApp.create(`[EUI-EVAL] ${title}`)
        .setTitle(title)
        .setDescription(`Unidad: ${unitName}\nGenerado por Certeza AIA - EUI Research Platform`)
        .setIsQuiz(true) // Crucial: Lo convierte en cuestionario calificado
        .setCollectEmail(true)
        .setLimitOneResponsePerUser(true);

    // 2. Iterar y crear cada reactivo
    questions.forEach((q) => {
      if (q.type === "opcion_multiple" || q.type === "verdadero_falso") {
        const item = form.addMultipleChoiceItem();
        item.setTitle(q.content)
            .setPoints(parseInt(q.points) || 0)
            .setRequired(true);
        
        // Mapear opciones y definir cuál es la correcta
        const choices = q.options.map(opt => {
          return item.createChoice(opt, opt === q.answer);
        });
        item.setChoices(choices);

      } else if (q.type === "abierta") {
        form.addParagraphTextItem()
            .setTitle(q.content)
            .setPoints(parseInt(q.points) || 0)
            .setHelpText("Pregunta abierta: requiere calificación manual.")
            .setRequired(true);
      }
    });

    return {
      publishedUrl: form.getPublishedUrl(),
      editUrl: form.getEditUrl(),
      formId: form.getId()
    };
    
  } catch (e) {
    throw new Error("Error al crear el formulario: " + e.message);
  }
}