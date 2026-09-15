-- Consolidación de políticas RLS duplicadas en course_units y course_announcements.
-- Verificado contra pg_policies en producción el 2026-09-14:
-- 1. course_units: "docente_manage_units" y "docente_own_units" son idénticas en qual y cmd (ALL).
--    Se conserva "docente_manage_units" y se elimina "docente_own_units".
-- 2. course_announcements: 4 políticas ALL con qual idéntico para docentes.
--    Se conserva "docente_manage_announcements" y se eliminan las 3 redundantes.

-- En course_units:
drop policy if exists "docente_own_units" on public.course_units;

-- En course_announcements:
drop policy if exists "Docentes gestionan avisos de sus cursos" on public.course_announcements;
drop policy if exists "Docentes gestionan avisos de sus materias" on public.course_announcements;
drop policy if exists "docente_own_announcements" on public.course_announcements;

-- En perfiles: endurecer lectura pública legacy
drop policy if exists "Lectura pública de perfiles" on public.perfiles;
create policy "Lectura autenticada de perfiles"
  on public.perfiles
  as permissive
  for select
  to authenticated
  using (auth.uid() = id);


