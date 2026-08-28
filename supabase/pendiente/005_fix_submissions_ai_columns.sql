-- PENDIENTE: correr manualmente en el SQL Editor de Supabase.
-- Arregla un bug real preexistente (no introducido en esta sesión):
-- supabase/functions/evaluate-submissions-ia/index.ts escribe en
-- submissions.ai_score, ai_feedback, metadata y evaluated_at — columnas que
-- NO existen en el esquema real (confirmado por el dump de "ESTA ES LA
-- VERSION ACTUAL" que se pasó en la conversación, y por
-- supabase/migrations/20260225000320_remote_schema.sql). Cada vez que esta
-- función corre, el UPDATE falla en silencio (el catch solo loguea y deja
-- el item en ai_queued), así que las entregas evaluadas por IA nunca
-- avanzan de estado — se reintentan para siempre sin progresar.
--
-- La corrección es agregar las columnas que el código ya espera (no
-- reescribir la función): ai_integrity_flag/ai_integrity_notes YA existen
-- en submissions y siguen la misma idea (dato de IA sobre una entrega
-- puntual), así que ai_score/ai_feedback/metadata/evaluated_at encajan en
-- el mismo lugar por consistencia con el diseño ya existente.

BEGIN;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS ai_score double precision,
  ADD COLUMN IF NOT EXISTS ai_feedback text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evaluated_at timestamp with time zone;

COMMIT;
