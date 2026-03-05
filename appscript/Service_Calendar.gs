/**
 * Service_Tasks.gs
 * Gestión de Google Tasks para el Dashboard y Módulo de Tareas.
 */

/**
 * Función ultra-rápida para el Dashboard de Inicio.
 * Solo trae las 5 tareas más recientes de la lista principal.
 */
function obtenerTareasResumen() {
  try {
    const taskLists = Tasks.Tasklists.list();
    if (!taskLists.items || taskLists.items.length === 0) return [];
    
    // 🛡️ OPTIMIZACIÓN: Solo pedimos las 5 más recientes para el Dashboard
    const tasks = Tasks.Tasks.list(taskLists.items[0].id, {
      maxResults: 5,
      showCompleted: false
    });
    
    if (!tasks.items) return [];

    return tasks.items.map(t => ({
      id: t.id,
      titulo: t.title,
      estatus: t.status
    }));
  } catch (e) {
    console.error("Error en obtenerTareasResumen: " + e.toString());
    return [];
  }
}

/**
 * Obtiene todas las listas de tareas disponibles.
 */
function obtenerListasTareas() {
  try {
    const taskLists = Tasks.Tasklists.list();
    if (!taskLists.items) return [];
    
    return taskLists.items.map(list => ({
      id: list.id,
      name: list.title,
      count: 0, 
      color: "#3b82f6" // Azul por defecto
    }));
  } catch (e) {
    console.error("Error en obtenerListasTareas: " + e.toString());
    return [];
  }
}

/**
 * Obtiene las tareas detalladas de una lista específica.
 */
function obtenerTareasPorLista(idLista) {
  try {
    const tasks = Tasks.Tasks.list(idLista, {
      showHidden: false
    });
    
    if (!tasks.items) return [];
    
    return tasks.items.map(t => ({
      id: t.id,
      t: t.title,
      d: t.due ? Utilities.formatDate(new Date(t.due), Session.getScriptTimeZone(), "dd MMM") : "Sin fecha",
      p: "Media", // Prioridad base
      completed: t.status === "completed"
    }));
  } catch (e) {
    console.error("Error en obtenerTareasPorLista: " + e.toString());
    return [];
  }
}
/**
 * Crea una tarea en la lista principal de Google Tasks (Invocado desde el Modal IEO)
 */
function crearTareaRapida(payload) {
  try {
    const listas = Tasks.Tasklists.list();
    if (!listas.items || listas.items.length === 0) throw new Error("No hay listas de tareas");
    
    let nuevaTarea = { title: payload.titulo };
    
    if (payload.fecha) {
      nuevaTarea.due = new Date(payload.fecha + "T12:00:00Z").toISOString(); 
    }
    
    Tasks.Tasks.insert(nuevaTarea, listas.items[0].id);
    return { success: true, mensaje: "Tarea creada" };
  } catch (e) {
    throw new Error("Error al crear tarea: " + e.toString());
  }
}