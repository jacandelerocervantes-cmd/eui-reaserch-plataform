-- Separar el gate único "is_closed" en dos conceptos independientes:
-- asistencia (Historial/Sellar) y calificaciones (Captura/Cerrar Unidad).
-- Migrar el dato existente: si is_closed=true hoy, asumimos que ambos
-- procesos estaban cerrados (comportamiento previo no distinguía), así que
-- se copia el valor a ambos campos nuevos para no perder estado real.
alter table public.course_units
  add column if not exists attendance_closed_at timestamptz,
  add column if not exists grades_closed_at timestamptz;

update public.course_units
  set attendance_closed_at = coalesce(attendance_closed_at, closed_at, case when is_closed then now() else null end),
      grades_closed_at = coalesce(grades_closed_at, case when is_closed then now() else null end)
  where is_closed = true;

-- Ponderación individual por examen dentro de su unidad (mismo patrón que
-- assignments.rubric_data.weight_percentage, aplicado a exams).
alter table public.exams
  add column if not exists weight_data jsonb;

