-- PENDIENTE: correr manualmente en el SQL Editor de Supabase, DESPUÉS de
-- 004_ai_calibration_schema.sql.
--
-- Origen: qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md, punto 3.2
-- — segmentar la calibración de R²/RMSE más allá de los 2 dominios planos
-- (exam_grading/submission_grading) que mezclaban todos los cursos juntos.
--
-- course_id NULLABLE a propósito: NULL significa "calibración global del
-- dominio" (el comportamiento de antes, se mantiene como fallback si un
-- curso todavía no acumuló suficiente historial propio). Un valor no-NULL
-- es la calibración específica de ESE curso, más precisa cuando ya hay
-- suficiente historial propio.
--
-- Idempotente: puede correrse más de una vez sin duplicar nada.

BEGIN;

ALTER TABLE public.ai_calibration_state
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

-- El índice anterior (domain, calibrated_at DESC) sigue sirviendo para la
-- consulta global (course_id IS NULL); este cubre la consulta por curso.
CREATE INDEX IF NOT EXISTS ai_calibration_state_domain_course_idx
  ON public.ai_calibration_state (domain, course_id, calibrated_at DESC);

COMMIT;
