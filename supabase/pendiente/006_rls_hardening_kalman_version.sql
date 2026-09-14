-- 006_rls_hardening_kalman_version.sql
--
-- Origen: mds/05_A_DoubleCheck_QA_Tecnico.md (doble check de seguridad),
-- ver qa-05a-doublecheck/02-SOLUCION.md para el detalle completo.
--
-- ACTUALIZACIÓN 2026-09-14: verificado contra producción antes de aplicar.
-- La parte A.1 original (policy pública en `perfiles`) se retiró de este
-- archivo porque la tabla `perfiles` ya no existe en producción (fue
-- reemplazada por `profiles`+`students`) — correrla tal cual abortaba toda
-- la transacción con "relation public.perfiles does not exist". Por la
-- misma razón se borró `007_rls_equipos_lab.sql`: la policy pública que
-- describía ya no existe (equipos_lab solo tiene policies restringidas a
-- rol docente); aplicarlo tal cual habría agregado una policy nueva que
-- abría lectura a cualquier autenticado, un retroceso de seguridad.
--
-- Lo que queda en este archivo (verificado contra producción, sí aplica):
--
-- A) Cierra la policy RLS con `using(true)`/`check(true)` a rol `public`
--    (sin autenticación) en telemetria_iot — insert Y select públicos
--    permitían inyectar lecturas de sensores falsas o leer telemetría sin
--    sesión. (En producción, hoy la tabla tiene RLS activo sin policies,
--    o sea deny-all; este fix la deja utilizable solo para `authenticated`.)
--
-- B) Agrega columna `version` a kalman_states para optimistic locking —
--    kalmanStore.ts hacía read-then-write sin control de concurrencia
--    (lost update posible con dos recálculos simultáneos del mismo alumno/
--    señal). Ver _shared/kalmanStore.ts.
--
-- Idempotente: puede correrse más de una vez sin duplicar nada.

BEGIN;

-- ── A: telemetria_iot — insert/select ahora requieren sesión ────────────
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
