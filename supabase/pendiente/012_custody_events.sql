-- 012_custody_events.sql
--
-- Origen: CORRE 4 (03_Ciberseguridad_Hibrida.md), punto 5 — Trazabilidad
-- criptográfica y auditoría para publicación.
--
-- Diagnóstico previo (auditoria/custody_audit.py, en la raíz del paquete):
-- este repo NO tenía ningún mecanismo de encadenamiento de eventos. Lo único
-- criptográfico existente era el HMAC-SHA256 que firma el hash de un QR
-- (supabase/functions/register-attendance) — verifica que un valor salió del
-- servidor, no encadena un historial. Esta migración implementa la cadena de
-- hashes lineal (SHA-256) que custody_audit.py recomienda como primer paso
-- real, ANTES de considerar un Merkle tree (que ese mismo análisis concluye
-- que hoy no hace falta: volumen bajo, sin caso de uso de verificación
-- parcial tipo light-client — ver RECOMENDACION en ese archivo). El módulo
-- Merkle sí se implementó y se probó (lib/server/custody.ts +
-- custody.test.ts), pero como utilidad lista para el día en que se necesite
-- anclaje externo — no está enganchada a ningún flujo de escritura todavía,
-- tal como se confirmó con el usuario.
--
-- Diseño: una única cadena global de append-only (no una cadena por
-- entidad) — mismo patrón que el demo de custody_audit.py, donde el
-- prev_hash de un evento de "evaluations" puede ser el event_hash de un
-- evento anterior de "submissions". Esto es intencional: la garantía que
-- se necesita es "nada en el historial completo de custodia se alteró",
-- no "la sub-cadena de esta entidad es válida en aislamiento".
--
-- Nota sobre `actor_id`: custody_audit.py (el diseño en Python) apuntaba a
-- `perfiles(id)` porque así se llamó en el prompt original, pero
-- SECURITY_AUDIT.md ya documenta que `perfiles` es la tabla legacy
-- reemplazada en la práctica por `profiles`+`students` — este archivo usa
-- `public.profiles(id)`, que es la tabla vigente hoy.
--
-- Concurrencia: dos inserciones simultáneas podrían leer el mismo
-- "último hash" y romper la cadena — por eso el cómputo y la inserción
-- viven juntos en una sola función `SECURITY DEFINER` con
-- `pg_advisory_xact_lock`, no en el cliente (Next.js/Edge Function), que no
-- tiene forma de tomar un lock a través de PostgREST entre un SELECT y un
-- INSERT separados.
--
-- Idempotente: puede correrse más de una vez sin duplicar nada
-- (`CREATE ... IF NOT EXISTS` / `CREATE OR REPLACE FUNCTION`).

BEGIN;

-- ── 1. Tabla ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custody_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_table text NOT NULL,        -- ej. 'submissions', 'grades', 'evaluations'
  entity_id uuid NOT NULL,
  event_type text NOT NULL,          -- 'created' | 'updated' | 'graded' | 'reverted'
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,            -- snapshot del cambio (no el registro completo)
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

-- ── 2. RLS: ledger de solo lectura para autenticados, sin escritura directa ─
ALTER TABLE public.custody_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura autenticada de custody_events" ON public.custody_events;
CREATE POLICY "Lectura autenticada de custody_events"
  ON public.custody_events
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- Deliberadamente NO se crean policies de INSERT/UPDATE/DELETE: con RLS
-- activo y sin una policy que lo permita, el default es denegar — incluso
-- para `authenticated`. La única vía de escritura es la función de abajo,
-- que corre SECURITY DEFINER (bypassa RLS) y controla el candado de
-- concurrencia + el cómputo del hash en un solo paso atómico.
--
-- Nota de alcance: la policy de lectura de arriba es "cualquier
-- autenticado puede leer toda la cadena" — suficiente para no repetir el
-- patrón de policies públicas (`using(true)` a rol `public`) que esta misma
-- auditoría encontró y cerró en 006/007. Si más adelante se define un rol
-- de "auditor académico" distinto de docente/alumno, esta policy se puede
-- acotar más sin tocar la función de escritura.

-- ── 3. JSON canónico determinista (sort_keys, sin espacios) ────────────────
-- Necesario para que el hash de un mismo payload sea siempre el mismo sin
-- importar en qué orden Postgres/el cliente construyó el jsonb. Recursivo:
-- objetos con claves ordenadas alfabéticamente, arrays en su orden original,
-- escalares tal cual los serializa jsonb (ya sin espacios).
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

-- ── 4. Escribir un evento (cómputo + insert atómico) ───────────────────────
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

  -- Candado de transacción: serializa lectura-del-último-hash + inserción
  -- entre llamadas concurrentes. Se libera solo al COMMIT/ROLLBACK.
  PERFORM pg_advisory_xact_lock(hashtext('public.custody_events_chain'));

  SELECT event_hash INTO v_prev_hash
  FROM public.custody_events
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF v_prev_hash IS NULL THEN
    v_prev_hash := repeat('0', 64); -- genesis hash
  END IF;

  -- Representación de created_at determinista con microsegundos, sin
  -- aritmética de punto flotante (evita el redondeo de extract(epoch)::float).
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

-- ── 5. Verificar la cadena completa (recalcula y compara) ──────────────────
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

-- ── Smoke test manual (correr en el SQL Editor DESPUÉS de aplicar lo de arriba) ──
-- select * from public.append_custody_event('submissions','00000000-0000-0000-0000-000000000001','created', auth.uid(), '{"file_url":"a.pdf"}'::jsonb);
-- select * from public.append_custody_event('grades','00000000-0000-0000-0000-000000000002','graded', auth.uid(), '{"score":9.5}'::jsonb);
-- select * from public.verify_custody_chain();  -- debe devolver is_valid = true
-- update public.custody_events set payload = '{"score":10}'::jsonb where entity_table = 'grades'; -- simula alteración
-- select * from public.verify_custody_chain();  -- ahora debe devolver is_valid = false y el id alterado
