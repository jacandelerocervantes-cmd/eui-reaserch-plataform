-- PENDIENTE: correr manualmente en el SQL Editor de Supabase, DESPUÉS de
-- 001_fix_literatura_referencias_columns.sql. No está en supabase/migrations/
-- a propósito.
--
-- REEMPLAZA la versión anterior de este archivo (que tenía un solo grafo
-- escopado por course_id). Diseño correcto: DOS grafos separados, porque
-- Docencia e Investigación/Campo/Laboratorio trabajan distinto y no
-- comparten estructura de datos:
--
--   - grafo Docencia:        escopado por course_id (una materia).
--     Fuentes: course_materials, materiales_boveda, exams/questions,
--     activities/rubrics.
--   - grafo Investigación:   escopado por usuario_id (el investigador).
--     proyectos_investigacion, misiones_campo/capturas_campo, equipos_lab/
--     telemetria_iot y literatura_referencias no se referencian entre sí por
--     FK, pero SÍ comparten quién los creó (investigador_principal_id,
--     docente_id, docente_responsable_id, usuario_id → misma persona), así
--     que ese es el scope natural que los une en un solo grafo.
--
-- Si ya corriste la versión anterior de este archivo, ejecuta primero:
--   DROP TABLE IF EXISTS public.knowledge_edges;
--   DROP TABLE IF EXISTS public.knowledge_nodes;
--   DROP FUNCTION IF EXISTS public.match_knowledge_nodes;

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
  -- tablas distintas (literatura_referencias, proyectos_investigacion,
  -- misiones_campo, capturas_campo, equipos_lab, telemetria_iot) según
  -- source_type — un patrón polimórfico, no una FK simple.
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
-- Edge Functions con service role, igual que el resto de tablas sensibles.
-- Los alumnos no tienen acceso directo ni indirecto a ninguno de los dos grafos.

-- ── Estado de Kalman genérico, reutilizable en cualquier serie escalar de
--    cualquiera de los dos dominios (asistencia, tendencia de calificación
--    por actividad, tendencia de examen, lectura de sensor IoT, etc.) — una
--    sola tabla en vez de una tabla de estado por feature. Ver
--    _shared/kalman.ts para las ecuaciones. ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kalman_states (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain = ANY (ARRAY['docencia'::text, 'investigacion'::text])),
  -- entity_type ejemplos: 'student_attendance', 'student_grade_trend',
  -- 'exam_group_trend', 'equipo_lab_sensor'. entity_id: el uuid del alumno,
  -- de la materia, del examen o del equipo, según entity_type.
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  signal_name text NOT NULL, -- ej. 'asistencia_pct', 'promedio_actividades', 'temperatura'
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
