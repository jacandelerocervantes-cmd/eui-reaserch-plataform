-- 006_rls_hardening_kalman_version.sql
--
-- Origen: mds/05_A_DoubleCheck_QA_Tecnico.md (doble check de seguridad),
-- ver qa-05a-doublecheck/02-SOLUCION.md para el detalle completo.
--
-- Dos cambios independientes en este archivo (no hay orden entre ellos):
--
-- A) Cierra dos policies RLS con `using(true)`/`check(true)` a rol `public`
--    (sin autenticación) que exponían/permitían escribir datos sin sesión:
--      - perfiles: cualquiera con la anon key podía leer matricula_rfc (PII
--        fiscal) vía REST directo (`/rest/v1/perfiles?select=*`), sin pasar
--        por la app. Tabla legacy (reemplazada en la práctica por
--        profiles+students), pero RLS abierta es explotable igual aunque el
--        código de la app ya no la consulte.
--      - telemetria_iot: insert Y select públicos permitían inyectar
--        lecturas de sensores falsas o leer telemetría sin sesión.
--
-- B) Agrega columna `version` a kalman_states para optimistic locking —
--    kalmanStore.ts hacía read-then-write sin control de concurrencia
--    (lost update posible con dos recálculos simultáneos del mismo alumno/
--    señal). Ver _shared/kalmanStore.ts.
--
-- Idempotente: puede correrse más de una vez sin duplicar nada.

BEGIN;

-- ── A.1: perfiles — de lectura pública a lectura solo del propio dueño ────
DROP POLICY IF EXISTS "Lectura pública de perfiles" ON public.perfiles;

CREATE POLICY "Lectura autenticada de perfiles"
  ON public.perfiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- ── A.2: telemetria_iot — insert/select ahora requieren sesión ────────────
DROP POLICY IF EXISTS "Inserción abierta de sensores" ON public.telemetria_iot;

CREATE POLICY "Inserción de sensores autenticada"
  ON public.telemetria_iot
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura pública de telemetría" ON public.telemetria_iot;

CREATE POLICY "Lectura de telemetría autenticada"
  ON public.telemetria_iot
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- ── B: kalman_states.version para optimistic locking ──────────────────────
-- Requiere que ya exista la tabla (002_graphrag_schema.sql). Si ese SQL
-- todavía no corrió en tu proyecto, corre este archivo DESPUÉS de ese.
ALTER TABLE public.kalman_states
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

COMMIT;
