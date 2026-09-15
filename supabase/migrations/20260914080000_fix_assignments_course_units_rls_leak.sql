-- FIX DE SEGURIDAD CRÍTICO: assignments/course_units tenían políticas RLS
-- que exponían TODAS las filas a cualquier persona sin sesión (anon, qual=true)
-- y permitían a cualquier cuenta con rol "docente" modificar/borrar actividades
-- y unidades de un curso ajeno (el OR de rol en insert/update/delete no
-- validaba propiedad del curso). Confirmado contra pg_policies en producción
-- el 2026-09-14.

-- 1. Quitar la lectura pública/anónima sin restricción.
drop policy if exists "assignments_select_all" on public.assignments;
drop policy if exists "course_units_select_all" on public.course_units;

-- 2. Quitar los policies de escritura con el bypass de "cualquier docente".
--    docente_manage_assignments / docente_manage_units / docente_own_units
--    (ya existentes, ALL, scoped correctamente por teacher_id = auth.uid())
--    quedan como la única vía de escritura para el docente dueño real.
drop policy if exists "assignments_docente_insert" on public.assignments;
drop policy if exists "assignments_docente_update" on public.assignments;
drop policy if exists "assignments_docente_delete" on public.assignments;
drop policy if exists "course_units_insert_docente" on public.course_units;
drop policy if exists "course_units_update_docente" on public.course_units;
drop policy if exists "course_units_delete_docente" on public.course_units;

-- 3. Reponer lectura para el alumno inscrito en el curso (única razón real
--    por la que probablemente se puso qual=true en el select original).
create policy "alumno_select_own_course_assignments" on public.assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      where e.course_id = assignments.course_id and e.student_id = auth.uid()
    )
  );

create policy "alumno_select_own_course_units" on public.course_units
  for select to authenticated
  using (
    exists (
      select 1 from public.enrollments e
      where e.course_id = course_units.course_id and e.student_id = auth.uid()
    )
  );

-- El docente sigue leyendo/escribiendo sus propios assignments/course_units
-- vía las políticas ALL ya existentes (docente_manage_assignments,
-- docente_manage_units, docente_own_units) — no se tocan, ya estaban
-- correctamente acotadas por teacher_id = auth.uid().
