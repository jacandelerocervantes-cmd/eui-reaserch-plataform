/**
 * Service_Calendar.gs
 * Gestión de eventos de Google Calendar para el Dashboard IEO.
 */

function obtenerEventosCalendario() {
  try {
    const hoy = new Date();
    const en7Dias = new Date();
    en7Dias.setDate(hoy.getDate() + 7);

    const eventos = CalendarApp.getDefaultCalendar().getEvents(hoy, en7Dias);

    return eventos.slice(0, 10).map(e => {
      const titulo = e.getTitle().toUpperCase();
      const desc = (e.getDescription() || "").toUpperCase();

      let categoria = "DOCENCIA";
      let color = "#1B396A";

      if (titulo.includes("INV") || desc.includes("INVESTIGACIÓN") || titulo.includes("PAPER")) {
        categoria = "INVESTIGACION";
        color = "#7C3AED";
      } else if (titulo.includes("LAB") || desc.includes("LABORATORIO")) {
        categoria = "LABORATORIO";
        color = "#10B981";
      } else if (titulo.includes("CAMPO") || desc.includes("PRÁCTICA") || titulo.includes("VISITA")) {
        categoria = "CAMPO";
        color = "#F59E0B";
      } else if (titulo.includes("REUNIÓN") || titulo.includes("REUNION") || titulo.includes("JUNTA")) {
        categoria = "INSTITUCIONAL";
        color = "#64748b";
      }

      const start = e.getStartTime();
      const hoyStr = Utilities.formatDate(hoy, Session.getScriptTimeZone(), "dd/MM/yyyy");
      const startStr = Utilities.formatDate(start, Session.getScriptTimeZone(), "dd/MM/yyyy");

      return {
        id: e.getId(),
        name: e.getTitle(),
        type: categoria,
        color: color,
        time: Utilities.formatDate(start, Session.getScriptTimeZone(), "HH:mm"),
        date: startStr === hoyStr ? "Hoy" : Utilities.formatDate(start, Session.getScriptTimeZone(), "EEE dd MMM"),
        location: e.getLocation() || null,
        meetLink: e.getHangoutLink() || null
      };
    });
  } catch (err) {
    console.error("Error en Service_Calendar: " + err.toString());
    return [];
  }
}
