/**
 * Service_Gmail.gs
 * Versión ultra-rápida para evitar Timeouts en el Dashboard.
 */
function extraerUltimosCorreos() {
  try {
    // 🛡️ FILTRO DE ALTO RENDIMIENTO:
    // Solo buscamos correos de los últimos 2 días y limitamos a los 7 más recientes.
    // Esto reduce el tiempo de ejecución de ~10s a <1s.
    const hilos = GmailApp.search("newer_than:2d", 0, 7); 
    
    return hilos.map(thread => {
      const msg = thread.getMessages()[thread.getMessageCount() - 1]; // Tomamos el ÚLTIMO mensaje (el más reciente)
      
      // Limpiamos el remitente
      let fromClean = msg.getFrom().replace(/<.*>/, '').replace(/"/g, '').trim();
      if (!fromClean) fromClean = msg.getFrom();

      return {
        id: thread.getId(),
        from: fromClean,
        subject: msg.getSubject() || "(Sin asunto)",
        // ⚡ snippet es nativo de Google y no requiere procesar el cuerpo completo
        preview: thread.getSnippet(), 
        time: Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), "hh:mm a"),
        category: "Bandeja",
        unread: thread.isUnread()
      };
    });
  } catch (err) {
    console.error("Error en Service_Gmail: " + err.toString());
    return [];
  }
}