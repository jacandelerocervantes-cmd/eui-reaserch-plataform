-- ============================================================================
-- 20260825120000_unificacion_sql_pendiente.sql
-- ============================================================================
-- CORRE 11 (Unificación SQL + Credenciales) — consolida los 14 archivos SQL
-- que estaban sueltos en supabase/pendiente/ (CORRE 2 a CORRE 9) en una sola
-- migración idempotente y ejecutable en orden.
--
-- Fuente de cada bloque: supabase/pendiente/<archivo original>. El SQL de
-- cada bloque se copió TAL CUAL de su archivo de origen (mismas guardas
-- IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE que ya traía),
-- sin reescribirlo. Se verificó por lectura que ninguno de los 14 archivos
-- redefine la misma tabla/columna de forma contradictoria — no hubo
-- duplicados ni conflictos que resolver.
--
-- Orden: NO es el orden numérico de los archivos originales (ese orden solo
-- reflejaba en qué sesión se escribió cada uno). Es un orden topológico real
-- por dependencia de esquema, verificado leyendo cada archivo:
--   1. 002 (crea kalman_states + tablas GraphRAG)   — requerido por 006 y 011
--   2. 004 (crea ai_calibration_state)               — requerido por 010
--   3. 005 (agrega columnas a submissions)            — requerido por 009
--   4. 001 (renombra columnas de literatura_referencias) — sin dependencias
--   5. 003 (columnas de revisión en capturas_campo/equipos_lab_logs) — sin dependencias
--   6. 006 (RLS perfiles/telemetria_iot + kalman_states.version) — depende de 002
--   7. 007 (RLS equipos_lab)                          — sin dependencias
--   8. 008 (columnas en validated_attendances)        — sin dependencias
--   9. 009 (crea submission_revisions)                — depende de 005
--  10. 010 (agrega course_id a ai_calibration_state)  — depende de 004
--  11. 011 (crea kalman_vector_states)                — depende de 002
--  12. 012 (crea custody_events + funciones)          — sin dependencias
--  13. 013 (agrega students.user_id)                  — sin dependencias
--  14. 014 (agrega assignments.watermark_identifier)  — sin dependencias
--
-- Cada bloque corre en su propia transacción (BEGIN/COMMIT), igual que en su
-- archivo original — si algo falla a medias en un bloque, los bloques ya
-- aplicados con éxito no se revierten y el script puede volver a correrse
-- completo sin duplicar nada (todas las guardas son idempotentes).
--
-- NO se ejecutó contra ninguna base de datos real como parte de esta tarea:
-- no hay Docker/`supabase start` disponible en este entorno (verificado:
-- `docker` no existe en PATH) y no se tocó el proyecto Supabase de
-- producción sin autorización explícita. Ver FASE 3 para la verificación
-- real que sí se pudo correr en este entorno (sintaxis + `deno check` de las
-- Edge Functions que consumen este esquema).
-- ============================================================================


-- ============================================================================
-- BLOQUE 1 — origen: 002_graphrag_schema.sql
-- Extensión vector + grafos de conocimiento (Docencia/Investigación) +
-- kalman_states. Requerido por los bloques 6 y 11 de este archivo.
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Grafo Docencia (course_id) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_nodes_docencia (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['course_material'::text, 'materiales_boveda'::text, 'exam'::text, 'activity'::text])),
  source_id uuid,
  label text NOT NULL,
  description text,
  embedding vector(768), -- text-embedding-004 de Gemini
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT knowledge_nodes_docencia_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_nodes_docencia_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.knowledge_edges_docencia (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_node_id uuid NOT NULL,
  target_node_id uuid NOT NULL,
  relation text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT knowledge_edges_docencia_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_edges_docencia_source_fkey FOREIGN KEY (source_node_id) REFERENCES public.knowledge_nodes_docencia(id) ON DELETE CASCADE,
  CONSTRAINT knowledge_edges_docencia_target_fkey FOREIGN KEY (target_node_id) REFERENCES public.knowledge_nodes_docencia(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS knowledge_nodes_docencia_embedding_idx
  ON public.knowledge_nodes_docencia USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS knowledge_nodes_docencia_course_id_idx ON public.knowledge_nodes_docencia (course_id);

CREATE OR REPLACE FUNCTION public.match_knowledge_nodes_docencia(
  query_embedding vector(768), match_course_id uuid, match_count int DEFAULT 8
)
RETURNS TABLE (id uuid, label text, description text, source_type text, source_id uuid, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT id, label, description, source_type, source_id, 1 - (embedding <=> query_embedding) AS similarity
  FROM public.knowledge_nodes_docencia
  WHERE course_id = match_course_id AND embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── Grafo Investigación + Campo + Laboratorio (usuario_id) ────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_nodes_investigacion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['literatura_referencia'::text, 'proyecto_investigacion'::text, 'mision_campo'::text, 'captura_campo'::text, 'equipo_lab'::text, 'telemetria_iot'::text])),
  source_id uuid,
  label text NOT NULL,
  description text,
  embedding vector(768),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT knowledge_nodes_investigacion_pkey PRIMARY KEY (id)
  -- Sin FK a una sola tabla: source_type+source_id apunta a una de varias
  -- tablas distintas según source_type — patrón polimórfico, no FK simple.
);

CREATE TABLE IF NOT EXISTS public.knowledge_edges_investigacion (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_node_id uuid NOT NULL,
  target_node_id uuid NOT NULL,
  relation text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT knowledge_edges_investigacion_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_edges_investigacion_source_fkey FOREIGN KEY (source_node_id) REFERENCES public.knowledge_nodes_investigacion(id) ON DELETE CASCADE,
  CONSTRAINT knowledge_edges_investigacion_target_fkey FOREIGN KEY (target_node_id) REFERENCES public.knowledge_nodes_investigacion(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS knowledge_nodes_investigacion_embedding_idx
  ON public.knowledge_nodes_investigacion USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS knowledge_nodes_investigacion_usuario_id_idx ON public.knowledge_nodes_investigacion (usuario_id);

CREATE OR REPLACE FUNCTION public.match_knowledge_nodes_investigacion(
  query_embedding vector(768), match_usuario_id uuid, match_count int DEFAULT 8
)
RETURNS TABLE (id uuid, label text, description text, source_type text, source_id uuid, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT id, label, description, source_type, source_id, 1 - (embedding <=> query_embedding) AS similarity
  FROM public.knowledge_nodes_investigacion
  WHERE usuario_id = match_usuario_id AND embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER TABLE public.knowledge_nodes_docencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges_docencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_nodes_investigacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges_investigacion ENABLE ROW LEVEL SECURITY;
-- Sin policies de SELECT/INSERT para "authenticated": todo el acceso pasa por
-- Edge Functions con service role. Los alumnos no tienen acceso directo ni
-- indirecto a ninguno de los dos grafos.

CREATE TABLE IF NOT EXISTS public.kalman_states (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain = ANY (ARRAY['docencia'::text, 'investigacion'::text])),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  signal_name text NOT NULL,
  x double precision NOT NULL,
  p double precision NOT NULL,
  last_measurement double precision NOT NULL,
  last_is_outlier boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kalman_states_pkey PRIMARY KEY (id),
  CONSTRAINT kalman_states_unique UNIQUE (domain, entity_type, entity_id, signal_name)
);

ALTER TABLE public.kalman_states ENABLE ROW LEVEL SECURITY;

COMMIT;


-- ============================================================================
-- BLOQUE 2 — origen: 004_ai_calibration_schema.sql
-- Crea ai_calibration_state. Requerido por el bloque 10 de este archivo.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_calibration_state (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain = ANY (ARRAY['exam_grading'::text, 'submission_grading'::text])),
  r2 double precision,
  rmse double precision,
  sample_size integer NOT NULL,
  confidence_threshold double precision NOT NULL DEFAULT 0.3,
  regla_aplicada text NOT NULL,
  calibrated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ai_calibration_state_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ai_calibration_state_domain_idx ON public.ai_calibration_state (domain, calibrated_at DESC);

ALTER TABLE public.ai_calibration_state ENABLE ROW LEVEL SECURITY;
-- Sin policies para "authenticated": dato operativo de plataforma, solo
-- Edge Functions con service role lo leen/escriben.

COMMIT;


-- ============================================================================
-- BLOQUE 3 — origen: 005_fix_submissions_ai_columns.sql
-- Agrega columnas a submissions que evaluate-submissions-ia ya escribe.
-- Requerido por el bloque 9 de este archivo.
-- ============================================================================
BEGIN;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS ai_score double precision,
  ADD COLUMN IF NOT EXISTS ai_feedback text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evaluated_at timestamp with time zone;

COMMIT;


-- ============================================================================
-- BLOQUE 4 — origen: 001_fix_literatura_referencias_columns.sql
-- Renombra columnas de literatura_referencias a inglés + convierte autores
-- a array. Sin dependencias con otros bloques.
--
-- ADVERTENCIA (preservada del archivo original): si "autores" ya tiene datos
-- reales en tu proyecto, revisa el separador antes de correr esto en
-- producción — corre primero:
--   SELECT autores FROM literatura_referencias LIMIT 20;
-- y confirma que coincide con el separador ';' o ',' que asume el CASE de
-- abajo. No es automáticamente reversible si el separador real es distinto.
-- ============================================================================
BEGIN;

ALTER TABLE public.literatura_referencias RENAME COLUMN creado_en TO created_at;
ALTER TABLE public.literatura_referencias RENAME COLUMN url_pdf TO url;

ALTER TABLE public.literatura_referencias
  ALTER COLUMN autores TYPE text[]
  USING CASE
    WHEN autores IS NULL OR autores = '' THEN NULL
    ELSE regexp_split_to_array(autores, '\s*;\s*|\s*,\s*')
  END;

COMMIT;


-- ============================================================================
-- BLOQUE 5 — origen: 003_captura_review_columns.sql
-- Columnas de revisión humano-en-el-loop para capturas_campo/equipos_lab_logs.
-- Sin dependencias con otros bloques.
-- ============================================================================
BEGIN;

ALTER TABLE public.capturas_campo
  ADD COLUMN IF NOT EXISTS ai_extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'sin_analizar'
    CHECK (review_status = ANY (ARRAY['sin_analizar'::text, 'analizado_ia'::text, 'validado'::text, 'rechazado'::text])),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

ALTER TABLE public.equipos_lab_logs
  ADD COLUMN IF NOT EXISTS content_url text,
  ADD COLUMN IF NOT EXISTS ai_extracted_data jsonb,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'sin_analizar'
    CHECK (review_status = ANY (ARRAY['sin_analizar'::text, 'analizado_ia'::text, 'validado'::text, 'rechazado'::text])),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;

COMMIT;


-- ============================================================================
-- BLOQUE 6 — origen: 006_rls_hardening_kalman_version.sql
-- Cierra RLS pública en perfiles/telemetria_iot + agrega kalman_states.version
-- (optimistic locking). Depende del bloque 1 (kalman_states debe existir).
-- 🔴 Seguridad activa — cierra PII/telemetría legible sin sesión.
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS "Lectura pública de perfiles" ON public.perfiles;

CREATE POLICY "Lectura autenticada de perfiles"
  ON public.perfiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

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

ALTER TABLE public.kalman_states
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

COMMIT;


-- ============================================================================
-- BLOQUE 7 — origen: 007_rls_equipos_lab.sql
-- Cierra RLS pública en equipos_lab. Sin dependencias con otros bloques.
-- 🔴 Seguridad activa — inventario de laboratorio legible sin sesión.
-- ============================================================================
BEGIN;

DROP POLICY IF EXISTS "Lectura pública de equipos" ON public.equipos_lab;

CREATE POLICY "Lectura autenticada de equipos"
  ON public.equipos_lab
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;


-- ============================================================================
-- BLOQUE 8 — origen: 008_attendance_metadata.sql
-- Persiste distancia de geocerca y desfase de horario en validated_attendances
-- (register-attendance ya las calculaba pero las descartaba). Sin dependencias.
-- ============================================================================
BEGIN;

ALTER TABLE public.validated_attendances
  ADD COLUMN IF NOT EXISTS geo_distance_meters double precision,
  ADD COLUMN IF NOT EXISTS scan_offset_seconds integer;

COMMIT;


-- ============================================================================
-- BLOQUE 9 — origen: 009_submission_revisions.sql
-- Historial de versiones de entregas. Depende del bloque 3
-- (submissions.metadata ya debe existir, aunque esta tabla no la referencia
-- por columna — la dependencia real es solo de orden documentado en el
-- archivo original; se conserva por consistencia con el diseño).
-- ============================================================================
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
-- Sin policies para "authenticated": dato operativo, solo Edge Functions con
-- service role (analyze-submission-metadata al escribir,
-- compute-activity-work-patterns/compute-student-risk-signals al leer).

COMMIT;


-- ============================================================================
-- BLOQUE 10 — origen: 010_ai_calibration_course_segment.sql
-- Segmenta ai_calibration_state por curso. Depende del bloque 2
-- (ai_calibration_state debe existir).
-- ============================================================================
BEGIN;

ALTER TABLE public.ai_calibration_state
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ai_calibration_state_domain_course_idx
  ON public.ai_calibration_state (domain, course_id, calibrated_at DESC);

COMMIT;


-- ============================================================================
-- BLOQUE 11 — origen: 011_kalman_vector_states.sql
-- Estado del filtro de Kalman vectorial (pares de señales correlacionadas).
-- Depende del bloque 1 (mismo patrón de dominio que kalman_states, tabla
-- distinta y separada a propósito — ver comentario original).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.kalman_vector_states (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain = ANY (ARRAY['docencia'::text, 'investigacion'::text])),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  pair_name text NOT NULL,
  x1 double precision NOT NULL,
  x2 double precision NOT NULL,
  p11 double precision NOT NULL,
  p12 double precision NOT NULL,
  p22 double precision NOT NULL,
  q12_estimate double precision NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 0,
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


-- ============================================================================
-- BLOQUE 12 — origen: 012_custody_events.sql
-- Cadena de custodia criptográfica (hash chain SHA-256) append-only. Sin
-- dependencias con otros bloques de este archivo.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.custody_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  prev_hash text NOT NULL,
  event_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS custody_events_entity_idx
  ON public.custody_events (entity_table, entity_id, created_at);

CREATE INDEX IF NOT EXISTS custody_events_created_at_idx
  ON public.custody_events (created_at);

COMMENT ON TABLE public.custody_events IS
  'Cadena de custodia append-only (hash chain SHA-256). Solo se escribe vía '
  'public.append_custody_event() — no hay política RLS de INSERT/UPDATE/DELETE '
  'para roles normales, así que un INSERT directo por REST/anon key falla '
  'cerrado. Ver auditoria/custody_audit.py para el diseño original.';

ALTER TABLE public.custody_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura autenticada de custody_events" ON public.custody_events;
CREATE POLICY "Lectura autenticada de custody_events"
  ON public.custody_events
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- Deliberadamente NO se crean policies de INSERT/UPDATE/DELETE: con RLS
-- activo y sin una policy que lo permita, el default es denegar. La única
-- vía de escritura es la función de abajo (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.canonical_json(p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE jsonb_typeof(p_value)
    WHEN 'object' THEN
      '{' || COALESCE((
        SELECT string_agg(to_jsonb(key)::text || ':' || public.canonical_json(value), ',' ORDER BY key)
        FROM jsonb_each(p_value)
      ), '') || '}'
    WHEN 'array' THEN
      '[' || COALESCE((
        SELECT string_agg(public.canonical_json(value), ',' ORDER BY ordinality)
        FROM jsonb_array_elements(p_value) WITH ORDINALITY AS t(value, ordinality)
      ), '') || ']'
    ELSE p_value::text
  END;
$$;

CREATE OR REPLACE FUNCTION public.append_custody_event(
  p_entity_table text,
  p_entity_id uuid,
  p_event_type text,
  p_actor_id uuid,
  p_payload jsonb
)
RETURNS public.custody_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_hash text;
  v_created_at timestamptz := clock_timestamp();
  v_created_key text;
  v_event_hash text;
  v_row public.custody_events;
BEGIN
  IF p_entity_table IS NULL OR p_entity_id IS NULL OR p_event_type IS NULL OR p_payload IS NULL THEN
    RAISE EXCEPTION 'append_custody_event: entity_table, entity_id, event_type y payload son obligatorios';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.custody_events_chain'));

  SELECT event_hash INTO v_prev_hash
  FROM public.custody_events
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF v_prev_hash IS NULL THEN
    v_prev_hash := repeat('0', 64);
  END IF;

  v_created_key := to_char(v_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US');

  v_event_hash := encode(
    digest(v_prev_hash || '|' || public.canonical_json(p_payload) || '|' || v_created_key, 'sha256'),
    'hex'
  );

  INSERT INTO public.custody_events(entity_table, entity_id, event_type, actor_id, payload, prev_hash, event_hash, created_at)
  VALUES (p_entity_table, p_entity_id, p_event_type, p_actor_id, p_payload, v_prev_hash, v_event_hash, v_created_at)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.append_custody_event(text, uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_custody_event(text, uuid, text, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_custody_chain()
RETURNS TABLE(is_valid boolean, broken_event_id uuid, broken_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_expected_prev text := repeat('0', 64);
  v_expected_hash text;
  v_created_key text;
BEGIN
  FOR rec IN SELECT * FROM public.custody_events ORDER BY created_at ASC, id ASC LOOP
    IF rec.prev_hash IS DISTINCT FROM v_expected_prev THEN
      RETURN QUERY SELECT false, rec.id, 'prev_hash no coincide con el evento anterior en la cadena';
      RETURN;
    END IF;

    v_created_key := to_char(rec.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US');
    v_expected_hash := encode(
      digest(rec.prev_hash || '|' || public.canonical_json(rec.payload) || '|' || v_created_key, 'sha256'),
      'hex'
    );

    IF v_expected_hash IS DISTINCT FROM rec.event_hash THEN
      RETURN QUERY SELECT false, rec.id, 'event_hash recalculado no coincide con el guardado (posible alteración)';
      RETURN;
    END IF;

    v_expected_prev := rec.event_hash;
  END LOOP;

  RETURN QUERY SELECT true, NULL::uuid, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_custody_chain() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_custody_chain() TO authenticated;

COMMIT;

-- Smoke test manual (correr a mano en el SQL Editor DESPUÉS de aplicar esta
-- migración, no se ejecuta automáticamente):
-- select * from public.append_custody_event('submissions','00000000-0000-0000-0000-000000000001','created', auth.uid(), '{"file_url":"a.pdf"}'::jsonb);
-- select * from public.append_custody_event('grades','00000000-0000-0000-0000-000000000002','graded', auth.uid(), '{"score":9.5}'::jsonb);
-- select * from public.verify_custody_chain();  -- debe devolver is_valid = true
-- update public.custody_events set payload = '{"score":10}'::jsonb where entity_table = 'grades'; -- simula alteración
-- select * from public.verify_custody_chain();  -- ahora debe devolver is_valid = false y el id alterado


-- ============================================================================
-- BLOQUE 13 — origen: 013_students_user_id.sql
-- Vincula students con auth.users (usado por provision-student-accounts).
-- Sin dependencias con otros bloques.
-- ============================================================================
BEGIN;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_user_id_unique_idx
  ON public.students (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS students_user_id_idx
  ON public.students (user_id);

COMMENT ON COLUMN public.students.user_id IS
  'Vínculo con auth.users cuando el alumno ya tiene cuenta creada por '
  'provision-student-accounts. NULL = todavía no se le ha creado acceso.';

COMMIT;


-- ============================================================================
-- BLOQUE 14 — origen: 014_assignments_watermark_identifier.sql
-- Identificador de watermark académico embebido por create-assignment-hub.
-- Sin dependencias con otros bloques.
-- ============================================================================
BEGIN;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS watermark_identifier text;

COMMENT ON COLUMN public.assignments.watermark_identifier IS
  'Identificador corto (8 hex del uuid de la actividad, sin guiones) usado '
  'por create-assignment-hub al embeber el watermark invisible de '
  'integridad académica en assignments.description vía '
  'supabase/functions/_shared/watermark.ts (encode/decode, port de '
  'D-watermark-integridad-academica/watermark_codec.py). NULL si la '
  'descripción era demasiado corta para embeber el watermark completo '
  '(ver TextoDemasiadoCortoError en watermark.ts) — la actividad quedó '
  'guardada igual, sin watermark, nunca se bloquea al docente por esto.';

COMMIT;
