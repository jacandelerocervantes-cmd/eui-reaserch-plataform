-- Opt-out de notificaciones automáticas por correo
alter table public.students add column if not exists notifications_opt_out boolean not null default false;

