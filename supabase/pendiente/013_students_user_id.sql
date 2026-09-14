-- 013_students_user_id.sql
--
-- Origen: CORRE 9 — provision-student-accounts (Edge Function nueva que crea
-- cuentas reales de Auth para el roster de alumnos de una materia, invocada
-- desde app/(docente)/panel/materias/[id]/alumnos/page.tsx, botón
-- "Crear Accesos").
--
-- Problema: `students` (supabase/migrations/20260225000320_remote_schema.sql,
-- líneas ~488-498) no tiene ninguna columna que la vincule con
-- `auth.users`/`profiles`. Sin eso, provision-student-accounts no tiene forma
-- de saber si un alumno ya tiene cuenta creada (para no re-invitarlo cada vez
-- que el docente presiona el botón) ni de guardar el vínculo después de
-- crearla.
--
-- Esta migración agrega esa columna. NO se ejecutó contra ninguna base real
-- como parte de este trabajo — queda pendiente de que el usuario la corra en
-- el SQL Editor de Supabase. Hasta que se corra, provision-student-accounts
-- fallará al leer/escribir students.user_id (el código ya contempla ese
-- caso y devuelve un error explícito señalando este archivo).
--
-- Idempotente: `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.

BEGIN;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Un mismo usuario de Auth no debería quedar vinculado a dos alumnos
-- distintos (evita que dos correos "colisionen" en la misma cuenta por
-- error humano al capturar el roster). NULL no cuenta como duplicado
-- (índice único parcial), así que los alumnos sin cuenta todavía no se ven
-- afectados.
CREATE UNIQUE INDEX IF NOT EXISTS students_user_id_unique_idx
  ON public.students (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS students_user_id_idx
  ON public.students (user_id);

COMMENT ON COLUMN public.students.user_id IS
  'Vínculo con auth.users cuando el alumno ya tiene cuenta creada por '
  'provision-student-accounts. NULL = todavía no se le ha creado acceso.';

COMMIT;
