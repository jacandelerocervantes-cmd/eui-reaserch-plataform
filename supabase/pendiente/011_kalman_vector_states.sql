-- PENDIENTE: correr manualmente en el SQL Editor de Supabase, DESPUÉS de
-- 002_graphrag_schema.sql (requiere el mismo patrón de dominio que
-- kalman_states).
--
-- Origen: qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md punto 17 —
-- estado del filtro de Kalman VECTORIAL (_shared/kalman.ts,
-- kalmanCorrectVector) para pares de señales correlacionadas (ej.
-- asistencia+puntualidad, medidas en el mismo evento).
--
-- Tabla NUEVA, no una alteración de kalman_states: el estado vectorial es
-- una matriz P de 2x2 (p11,p12,p22) + un vector x de 2 componentes + el
-- Q12 aprendido — forma distinta al x/p escalares de kalman_states, mezclar
-- ambos en la misma tabla habría requerido columnas nullable confusas para
-- el caso escalar (que sigue siendo la mayoría de las señales).
--
-- Idempotente: puede correrse más de una vez sin duplicar nada.

BEGIN;

CREATE TABLE IF NOT EXISTS public.kalman_vector_states (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain = ANY (ARRAY['docencia'::text, 'investigacion'::text])),
  entity_type text NOT NULL, -- ej. 'student_attendance_punctuality_pair'
  entity_id uuid NOT NULL,
  pair_name text NOT NULL, -- ej. 'asistencia_puntualidad' — identifica QUÉ dos señales son x1/x2
  x1 double precision NOT NULL,
  x2 double precision NOT NULL,
  p11 double precision NOT NULL,
  p12 double precision NOT NULL, -- covarianza cruzada de la ESTIMACIÓN — arranca en 0
  p22 double precision NOT NULL,
  q12_estimate double precision NOT NULL DEFAULT 0, -- covarianza cruzada del RUIDO DE PROCESO, aprendida online — arranca en 0
  version integer NOT NULL DEFAULT 0, -- optimistic locking, mismo patrón que kalman_states.version
  last_measurement_1 double precision,
  last_measurement_2 double precision,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kalman_vector_states_pkey PRIMARY KEY (id),
  CONSTRAINT kalman_vector_states_unique UNIQUE (domain, entity_type, entity_id, pair_name)
);

ALTER TABLE public.kalman_vector_states ENABLE ROW LEVEL SECURITY;
-- Sin policies para "authenticated": mismo patrón que kalman_states — solo
-- Edge Functions con service role.

COMMIT;
