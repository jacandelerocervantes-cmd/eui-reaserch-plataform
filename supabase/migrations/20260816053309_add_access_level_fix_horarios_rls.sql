-- ─────────────────────────────────────────────────────────────────────────
-- 1. profiles.access_level — la columna que falta
-- ─────────────────────────────────────────────────────────────────────────
-- Confirmado contra el schema completo (20260225000320_remote_schema.sql):
-- esta columna no existe bajo ningún nombre. Sin embargo proxy.ts y ~15
-- archivos de app/ (campo, laboratorio, investigacion, admin/docentes) la
-- consultan y filtran acceso con ella (profile.access_level !== 1, etc.).
-- Sin esta columna esas rutas fallan cerradas (bloquean a todos, incluidos
-- docentes legítimos) porque PostgREST regresa error de "columna no existe"
-- y el código trata data:null como "sin perfil válido".
--
-- Nullable, sin default: el código ya trata null como el nivel más
-- restrictivo (`profile.access_level ?? 99` en proxy.ts), así que no hace
-- falta forzar un valor — los docentes existentes se actualizan desde
-- /admin/docentes o directo en la base según corresponda a cada quien.
alter table "public"."profiles"
  add column "access_level" smallint;


-- ─────────────────────────────────────────────────────────────────────────
-- 2. horarios_docente — quitar las 2 políticas sin restricción real
-- ─────────────────────────────────────────────────────────────────────────
-- Existían 3 políticas "for all" sobre esta tabla. Como las políticas RLS
-- se combinan con OR, bastaba con que UNA fuera "using (true)" para anular
-- la protección real de las otras dos — cualquiera (incluso sin sesión,
-- usando la anon key pública) podía leer/escribir/borrar el horario de
-- cualquier docente.
--
-- "Gestión de horarios propios" ya restringía correctamente por dueño
-- (materias.docente_id = auth.uid()) y NO se toca — es el mismo patrón que
-- ya usan courses, enrollments, geocercas_materia, etc. Solo se eliminan
-- las dos que no deberían haber existido:
drop policy if exists "Acceso total" on "public"."horarios_docente";
drop policy if exists "Permitir todo a usuarios autenticados" on "public"."horarios_docente";
