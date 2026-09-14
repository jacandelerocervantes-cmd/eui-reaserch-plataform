-- Fase 1 del arreglo de duplicación de alumnos entre materias (ver
-- docs/QA_RED_TEAM_DOCENTE_2026-09-14.md). Hoy `students` no tiene identidad
-- única por persona: cada materia crea su propia fila para "el mismo" alumno
-- (misma matrícula, distinto id, distinto course_id) — UNIQUE(matricula,
-- course_id) permite exactamente esto. Esta migración agrega la identidad
-- global SIN romper nada existente: aditivo, nullable, no quita columnas.
--
-- "student_profiles" en inglés a propósito (confirmado por el usuario
-- 2026-09-14: "todas las tablas en inglés son las correctas") — paralelo a
-- "profiles" (identidad de docentes/admins), pero para alumnos, que no
-- necesariamente tienen cuenta de auth todavía (ver user_id nullable).

create table if not exists public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  matricula text not null unique,
  apellido_paterno text not null,
  apellido_materno text,
  nombres text not null,
  correo text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists student_profiles_user_id_unique_idx
  on public.student_profiles (user_id)
  where user_id is not null;

alter table public.student_profiles enable row level security;

-- Mismo patrón de acceso que "students": todo pasa por Edge Functions con
-- service role, sin policies para authenticated — evita exponer identidad
-- de alumnos de otro docente vía REST directo.

alter table public.students
  add column if not exists student_profile_id uuid references public.student_profiles(id) on delete set null;

create index if not exists students_student_profile_id_idx
  on public.students (student_profile_id);

comment on table public.student_profiles is
  'Identidad única de alumno a nivel institución (por matrícula). '
  '"students" sigue siendo el roster por materia (una fila por inscripción); '
  'student_profile_id enlaza cada inscripción a la persona real. Ver Fase 2 '
  'en docs/QA_RED_TEAM_DOCENTE_2026-09-14.md: enroll-manual/import-ia-students/'
  'import-ia-teams deben resolver-o-crear aquí antes de insertar en students, '
  'y propagar ediciones de nombre/correo a todas las filas de students con '
  'el mismo student_profile_id.';

-- Backfill: una fila en student_profiles por cada matrícula distinta ya en
-- students, tomando el registro más reciente (created_at desc) como fuente
-- de los datos de identidad cuando hay más de un candidato (materias
-- duplicadas). Luego enlaza TODAS las filas de students con esa matrícula.
insert into public.student_profiles (matricula, apellido_paterno, apellido_materno, nombres, correo, user_id, created_at)
select distinct on (s.matricula)
  s.matricula,
  s.apellido_paterno,
  s.apellido_materno,
  s.nombres,
  s.correo,
  s.user_id,
  s.created_at
from public.students s
where s.matricula is not null and s.matricula <> ''
order by s.matricula, s.user_id is not null desc, s.created_at desc
on conflict (matricula) do nothing;

update public.students s
set student_profile_id = sp.id
from public.student_profiles sp
where sp.matricula = s.matricula
  and s.student_profile_id is null;
