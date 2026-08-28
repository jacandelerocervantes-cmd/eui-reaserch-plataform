-- PENDIENTE: correr manualmente en el SQL Editor de Supabase, después de
-- 001 y 002. No está en supabase/migrations/ a propósito.
--
-- Pipeline de ingesta humano-en-el-loop para Campo y Laboratorio: subir
-- archivo -> IA sugiere datos estructurados -> el docente/investigador
-- confirma o corrige antes de que cuente como dato válido (para Kalman,
-- GraphRAG, o cualquier otro consumidor). La IA nunca escribe directo el
-- campo "final" (campos_datos / la fila de datos aceptada) — solo un campo
-- "_ia" que un humano revisa.
--
-- capturas_campo YA EXISTE y ya se usa en producción (app/(campo)/campo/
-- captura/page.tsx, bucket "campo-capturas") — esto solo AGREGA columnas,
-- no rompe lo existente.
--
-- equipos_lab_logs YA EXISTE pero sin soporte de archivo — se agrega
-- content_url para el mismo patrón de subir-foto-de-incidencia-y-analizar.

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
