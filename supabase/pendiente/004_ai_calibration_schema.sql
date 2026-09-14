-- PENDIENTE: correr manualmente en el SQL Editor de Supabase, después de
-- 001, 002 y 003. No está en supabase/migrations/ a propósito.
--
-- Cierra las tareas 2 y 3 de mds/03_Nucleo_IA_MLOps.md (validación empírica
-- R²/RMSE y calibración dinámica de umbrales), adaptadas a lo que existe
-- realmente en este repo: no hay datos sintéticos que reemplazar porque el
-- "ground truth" YA es real — es evaluation_responses.final_score /
-- evaluations.final_score, la corrección humana que el docente ya hace hoy
-- sobre score_ia/suggested_score en el flujo normal de calificar. No hace
-- falta un pipeline de ingesta nuevo: el dato de validación se genera solo
-- cada vez que un docente corrige una nota de IA.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_calibration_state (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain = ANY (ARRAY['exam_grading'::text, 'submission_grading'::text])),
  r2 double precision,
  rmse double precision,
  sample_size integer NOT NULL,
  -- % de calificaciones de IA que se marcan para revisión humana
  -- obligatoria antes de publicarse — el "umbral" que se recalibra.
  confidence_threshold double precision NOT NULL DEFAULT 0.3,
  regla_aplicada text NOT NULL, -- explica en texto qué regla determinista se usó, no una caja negra
  calibrated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_calibration_state_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ai_calibration_state_domain_idx ON public.ai_calibration_state (domain, calibrated_at DESC);

ALTER TABLE public.ai_calibration_state ENABLE ROW LEVEL SECURITY;
-- Sin policies para "authenticated": es un dato operativo de la plataforma
-- (no pertenece a un docente/curso específico), se lee/escribe solo desde
-- Edge Functions con service role.

COMMIT;
