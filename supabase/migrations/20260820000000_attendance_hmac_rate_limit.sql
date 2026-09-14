-- Punto 6 (HMAC) + 15 (rate limiting) + 16 (trazabilidad) de la auditoría
-- de seguridad sobre register-attendance.

-- 1. Trazabilidad: distingue registros de autoescaneo QR vs registro manual
--    del docente.
alter table public.validated_attendances
  add column if not exists source text not null default 'qr_scan'
    check (source in ('qr_scan', 'manual'));

-- 2. Rate limiting atómico para register-attendance. Solo la Edge Function
--    (service_role) debe poder tocar esta tabla — RLS activo sin policies
--    la deja cerrada a anon/authenticated; service_role bypassa RLS.
create table if not exists public.attendance_rate_limit (
  key text primary key,
  attempts integer not null default 1,
  window_start timestamptz not null default now()
);

alter table public.attendance_rate_limit enable row level security;

-- Incrementa el contador atómicamente; si la ventana expiró, la reinicia.
-- Devuelve true si el intento actual todavía está dentro del límite.
create or replace function public.check_and_bump_attendance_rate_limit(
  p_key text,
  p_max_attempts integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  insert into attendance_rate_limit (key, attempts, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set attempts = case
          when attendance_rate_limit.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else attendance_rate_limit.attempts + 1
        end,
        window_start = case
          when attendance_rate_limit.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else attendance_rate_limit.window_start
        end
  returning attempts into v_attempts;

  return v_attempts <= p_max_attempts;
end;
$$;

revoke all on function public.check_and_bump_attendance_rate_limit(text, integer, integer) from public;
grant execute on function public.check_and_bump_attendance_rate_limit(text, integer, integer) to service_role;
