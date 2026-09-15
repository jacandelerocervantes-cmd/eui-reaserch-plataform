-- Migración para reponer columnas usadas por la interfaz docente en submissions
-- Verificado contra la BD de producción el 2026-09-14: estas 3 columnas faltaban.

alter table public.submissions
  add column if not exists final_score double precision,
  add column if not exists final_feedback text,
  add column if not exists is_late boolean not null default false;

