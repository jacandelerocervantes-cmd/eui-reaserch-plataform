-- PENDIENTE: correr manualmente en el SQL Editor de Supabase.
-- No está en supabase/migrations/ a propósito, para que no se aplique sola
-- en el próximo `supabase db push` — la corres tú cuando quieras.
--
-- Problema que corrige:
-- app/(investigacion)/investigacion/literatura/page.tsx lee columnas que no
-- existen tal cual en public.literatura_referencias (creado con nombres
-- inconsistentes: mezcla de inglés y español). Nomenclatura del proyecto:
-- nombres de columna en INGLÉS. Deja "journal"/"abstract" como están (ya
-- correctos) y corrige los dos nombres que no siguen la convención; el
-- frontend se actualiza en el mismo cambio para leer los nombres reales.
--
-- Antes de correr: no hay filas que perder (son solo renombres + cast de
-- tipo), pero si "autores" ya tiene datos reales, revisa el resultado del
-- cast (ver comentario abajo) antes de continuar en producción.

BEGIN;

ALTER TABLE public.literatura_referencias RENAME COLUMN creado_en TO created_at;
ALTER TABLE public.literatura_referencias RENAME COLUMN url_pdf TO url;

-- "autores" es text hoy pero el frontend lo trata como array (autores.slice,
-- autores.some). Se asume "Apellido, Nombre; Apellido, Nombre" o CSV simple
-- separado por ";" o "," — AJUSTA el separador si en tu data real es otro
-- antes de correr esto en producción (revisa unas filas con
-- SELECT autores FROM literatura_referencias LIMIT 20 primero).
ALTER TABLE public.literatura_referencias
  ALTER COLUMN autores TYPE text[]
  USING CASE
    WHEN autores IS NULL OR autores = '' THEN NULL
    ELSE regexp_split_to_array(autores, '\s*;\s*|\s*,\s*')
  END;

COMMIT;
