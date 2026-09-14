-- PENDIENTE: correr manualmente en el SQL Editor de Supabase.
--
-- Origen: qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md, punto 1.1
-- (persistir la distancia de geocerca y el desfase de horario que
-- register-attendance/index.ts YA calculaba pero descartaba).
--
-- Dos columnas nuevas en validated_attendances:
--   - geo_distance_meters: distancia real (Haversine) del punto reportado
--     al centro de la geocerca del curso, en el momento del escaneo. NULL
--     si el curso no tiene geocerca configurada (register-attendance no
--     valida distancia en ese caso).
--   - scan_offset_seconds: segundos transcurridos entre el inicio de la
--     ventana de radar (session.expires_at - 300s, la ventana fija de
--     useAsistencia.ts) y el momento del escaneo. Útil para una futura
--     señal de "puntualidad" independiente de presencia/ausencia — ver
--     compute-student-risk-signals/index.ts.
--
-- Idempotente: puede correrse más de una vez sin duplicar nada.

BEGIN;

ALTER TABLE public.validated_attendances
  ADD COLUMN IF NOT EXISTS geo_distance_meters double precision,
  ADD COLUMN IF NOT EXISTS scan_offset_seconds integer;

COMMIT;
