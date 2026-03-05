**
 * Service_Citas.gs
 * Gestión de Citas y Asesorías optimizada para el motor IEO.
 */
function obtenerCitasSincronizadas() {
  try {
    const hoy = new Date();
    const manana = new Date();
    manana.setDate(hoy.getDate() + 1);
    manana.setHours(23, 59, 59, 999);

    // 🛡️ OPTIMIZACIÓN: Rango atómico (Hoy/Mañana) para máxima velocidad de respuesta
    const eventos = CalendarApp.getDefaultCalendar().getEvents(hoy, manana);

    return eventos.map(e => {
      const titulo = e.getTitle().toUpperCase();
      const desc = (e.getDescription() || "").toUpperCase();
      
      // 🎨 DICCIONARIO DE IDENTIDAD IEO (Colores unificados con el Dashboard)
      let categoria = "DOCENCIA";
      let color = "#1B396A"; // Azul Institucional

      if (titulo.includes("INV") || desc.includes("INVESTIGACIÓN") || titulo.includes("PAPER")) {
        categoria = "INVESTIGACION";
        color = "#7C3AED"; // Púrpura
      } else if (titulo.includes("LAB") || desc.includes("LABORATORIO")) {
        categoria = "LABORATORIO";
        color = "#10B981"; // Esmeralda
      } else if (titulo.includes("CAMPO") || desc.includes("PRÁCTICA") || titulo.includes("VISITA")) {
        categoria = "CAMPO";
        color = "#F59E0B"; // Ámbar
      }

      return {
        id: e.getId(),
        name: e.getTitle(),
        type: categoria,
        color: color,
        time: Utilities.formatDate(e.getStartTime(), Session.getScriptTimeZone(), "HH:mm a"),
        date: isToday(e.getStartTime()) ? "Hoy" : "Mañana",
        status: "confirmada",
        // Verificación de invitados para evitar errores si el evento es personal
        email: e.getGuestList().length > 0 ? e.getGuestList()[0].getEmail() : "sin-invitado@tecnm.mx",
        meetLink: e.getHangoutLink() || null
      };
    });
  } catch (err) {
    console.error("Error en Service_Citas: " + err.toString());
    return [];
  }
}

/**
 * Función auxiliar para validación de fechas (mantenida de tu original)
 */
function isToday(date) {
  const hoy = new Date();
  return date.getDate() == hoy.getDate() &&
         date.getMonth() == hoy.getMonth() &&
         date.getFullYear() == hoy.getFullYear();
}