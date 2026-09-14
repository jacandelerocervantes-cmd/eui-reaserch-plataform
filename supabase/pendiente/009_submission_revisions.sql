-- PENDIENTE: correr manualmente en el SQL Editor de Supabase, DESPUÉS de
-- 005_fix_submissions_ai_columns.sql (requiere que submissions.metadata ya
-- exista).
--
-- Origen: qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md, puntos
-- 2.1/2.2/2.3/2.4 — metadata de proceso de trabajo por entrega, agregada a
-- nivel de grupo/curso para el docente (nunca expuesta por-alumno a otros
-- alumnos).
--
-- submission_revisions: historial real de versiones — hoy solo existe un
-- contador (submissions.version_number) sin registro de CUÁNDO cambió cada
-- versión. Sin esta tabla no se puede calcular tiempo entre revisiones ni
-- distinguir "trabajo distribuido en el tiempo" de "todo de una vez cerca
-- del deadline".
--
-- Idempotente: puede correrse más de una vez sin duplicar nada.

BEGIN;

CREATE TABLE IF NOT EXISTS public.submission_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT submission_revisions_pkey PRIMARY KEY (id),
  CONSTRAINT submission_revisions_unique UNIQUE (submission_id, version_number)
);

CREATE INDEX IF NOT EXISTS submission_revisions_submission_id_idx ON public.submission_revisions (submission_id);

ALTER TABLE public.submission_revisions ENABLE ROW LEVEL SECURITY;
-- Sin policies para "authenticated": mismo patrón que kalman_states/
-- ai_calibration_state — es dato operativo consumido solo por Edge
-- Functions con service role (analyze-submission-metadata al escribir,
-- compute-activity-work-patterns/compute-student-risk-signals al leer),
-- nunca directo desde el cliente.

COMMIT;
