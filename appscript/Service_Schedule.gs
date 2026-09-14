/**
 * Service_Schedule.gs
 * Gestión de carga académica y bloqueos recurrentes.
 * Sincroniza la base de datos de Supabase con Google Calendar.
 */

function guardarCargaHoraria(payload) {
  try {
    const materias = payload.materias;
    const calendar = CalendarApp.getDefaultCalendar();
    
    // 📅 Definición del Semestre (Ajustable según ciclo escolar)
    // Por defecto: De hoy hasta finales de Julio 2026
    const fechaInicio = new Date();
    const fechaFinSemestre = new Date(2026, 6, 31); // 31 de Julio de 2026

    materias.forEach(m => {
      const [hInicio, hFin] = m.hora.split(' - ');
      
      m.dias.forEach(diaNombre => {
        const dayOfWeekEnum = getDayOfWeekEnum(diaNombre);
        if (dayOfWeekEnum === null) return;

        // Calculamos la primera ocurrencia del día para iniciar la serie
        const primeraFecha = getProximaFechaParaDia(fechaInicio, dayOfWeekEnum);
        
        const [hhI, mmI] = hInicio.split(':');
        const [hhF, mmF] = hFin.split(':');
        
        const start = new Date(primeraFecha);
        start.setHours(parseInt(hhI), parseInt(mmI), 0);
        
        const end = new Date(primeraFecha);
        end.setHours(parseInt(hhF), parseInt(mmF), 0);

        // 🛡️ CREACIÓN DE SERIE RECURRENTE
        // Bloquea el calendario semanalmente hasta fin de semestre
        const recurrence = CalendarApp.newRecurrence()
          .addWeeklyRule()
          .onlyOnWeekday(dayOfWeekEnum)
          .until(fechaFinSemestre);

        calendar.createEventSeries(
          `[${m.tipo}] ${m.materia}`,
          start,
          end,
          recurrence,
          {
            location: m.salon || "Aula Virtual / TecNM",
            description: `Carga Horaria IEO.\nPilar: ${m.tipo}\nSincronizado automáticamente.`
          }
        );
        
        console.log(`Serie creada para ${m.materia} los ${diaNombre}`);
      });
    });

    return { 
      success: true, 
      mensaje: "Carga académica inyectada en Calendar correctamente", 
      registros: materias.length 
    };
  } catch (err) {
    console.error("Error en Service_Schedule: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Auxiliar: Mapea texto a Enums de Google Calendar
 */
function getDayOfWeekEnum(dia) {
  const dias = {
    'Lunes': CalendarApp.Weekday.MONDAY,
    'Martes': CalendarApp.Weekday.TUESDAY,
    'Miércoles': CalendarApp.Weekday.WEDNESDAY,
    'Jueves': CalendarApp.Weekday.THURSDAY,
    'Viernes': CalendarApp.Weekday.FRIDAY,
    'Sábado': CalendarApp.Weekday.SATURDAY,
    'Domingo': CalendarApp.Weekday.SUNDAY
  };
  return dias[dia] || null;
}

/**
 * Auxiliar: Encuentra la fecha calendario del próximo día X
 */
function getProximaFechaParaDia(referencia, dayOfWeek) {
  const date = new Date(referencia.getTime());
  const diff = (dayOfWeek - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  return date;
}