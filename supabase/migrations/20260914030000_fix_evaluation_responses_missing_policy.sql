-- FIX URGENTE de regresión introducida por la migración anterior
-- (20260914020000_drop_dead_exam_course_id_policies.sql).
--
-- `evaluation_responses` solo tenía DOS políticas ("docente_manage_eval_responses"
-- y "docente_own_eval_responses"), ambas muertas (filtraban por `exams.course_id`,
-- columna siempre NULL en producción) — a diferencia de `exams`/`questions`, que
-- ya tenían una política de reemplazo en español usando `unit_id`. Al eliminar
-- las dos muertas, la tabla quedó con RLS activo y CERO políticas para docentes:
-- pantallas que leen `evaluation_responses` directo desde el navegador
-- (resultados, calificaciones, revisión de examen) dejaron de ver datos.
--
-- Se agrega la política equivalente correcta, mismo patrón que ya usan
-- "Docentes gestionan reactivos de sus examenes" (questions) y
-- "Docentes gestionan examenes de sus materias" (exams).

create policy "Docentes gestionan respuestas de sus examenes"
on public.evaluation_responses
for all
using (
  exists (
    select 1
    from exams e
    join course_units cu on cu.id = e.unit_id
    join courses c on c.id = cu.course_id
    where e.id = evaluation_responses.exam_id
      and c.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from exams e
    join course_units cu on cu.id = e.unit_id
    join courses c on c.id = cu.course_id
    where e.id = evaluation_responses.exam_id
      and c.teacher_id = auth.uid()
  )
);
