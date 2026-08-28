-- 014_assignments_watermark_identifier.sql
--
-- Origen: CORRE 9 — conectar el watermark invisible de integridad académica
-- (D-watermark-integridad-academica/watermark_codec.py, portado a TypeScript
-- en supabase/functions/_shared/watermark.ts) al flujo real de creación de
-- actividades (supabase/functions/create-assignment-hub/index.ts).
--
-- Qué guarda: el identificador corto (8 hex del uuid de la actividad, sin
-- guiones — ver create-assignment-hub/index.ts) que create-assignment-hub
-- usó como `identifier` al llamar encode() sobre `assignments.description`.
-- Sin guardarlo, decodificar más tarde (`decode(text, expected_identifier,
-- expected_frames)` en watermark.ts) requeriría volver a derivarlo del
-- mismo uuid — funciona igual porque el identificador es determinista
-- (siempre los mismos 8 hex del mismo assignment.id), pero se persiste de
-- todas formas para que un futuro módulo de detección (que decodifique
-- sobre lo que un alumno entregó en `submissions`) no tenga que reimplementar
-- esa derivación ni asumir que nunca cambiará.
--
-- Por qué NOT NULL no aplica: si la actividad no alcanzó el mínimo de
-- palabras requerido por la matemática de capacidad del algoritmo (ver
-- capacityReport() en watermark.ts — con redundancy=1 y este largo de
-- identificador, ~80 palabras), create-assignment-hub sigue adelante SIN
-- watermark (nunca bloquea al docente por esto) y esta columna queda NULL
-- para esa actividad — NULL es la señal correcta de "no se pudo embeber",
-- no un error de datos.
--
-- Idempotente: puede correrse más de una vez sin duplicar nada
-- (ADD COLUMN IF NOT EXISTS).
--
-- PENDIENTE: este archivo NO se ha ejecutado contra ninguna base real
-- (ni de desarrollo ni de producción). Alguien con acceso al SQL Editor de
-- Supabase debe correrlo manualmente — ver supabase/pendiente/README.md y
-- ORDEN_SQL.md para el procedimiento y el orden respecto a las demás
-- migraciones pendientes en esta misma carpeta.

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
