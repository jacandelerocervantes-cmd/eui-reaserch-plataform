-- Migración: Comentarios por publicación en Tablón (moderación individual)
-- Fecha: 2026-09-14
-- Nota: Queda en borrador para revisión antes de aplicar a producción (NO ejecutar supabase db push directamente).

-- 1. Cada anuncio decide si acepta comentarios (reemplaza el switch global por materia)
alter table public.course_announcements
  add column if not exists allow_comments boolean not null default true;

-- 2. Tabla de comentarios por anuncio
create table if not exists public.course_announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.course_announcements(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamp with time zone not null default now(),
  hidden_at timestamp with time zone,
  hidden_by uuid references auth.users(id)
);

-- Índices de consulta frecuente
create index if not exists idx_announcement_comments_announcement_id
  on public.course_announcement_comments(announcement_id);

create index if not exists idx_announcement_comments_author_id
  on public.course_announcement_comments(author_id);

-- 3. Row Level Security
alter table public.course_announcement_comments enable row level security;

-- Docente dueño del curso y administradores: ven todo (incl. ocultos), pueden insertar, moderar (ocultar/mostrar)
drop policy if exists "docente_manage_comments" on public.course_announcement_comments;
create policy "docente_manage_comments" on public.course_announcement_comments
  for all using (
    exists (
      select 1 from public.course_announcements ca
      join public.courses c on c.id = ca.course_id
      where ca.id = course_announcement_comments.announcement_id
        and (c.teacher_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

-- Alumno inscrito: ve comentarios no ocultos del anuncio si allow_comments=true
drop policy if exists "alumno_read_visible_comments" on public.course_announcement_comments;
create policy "alumno_read_visible_comments" on public.course_announcement_comments
  for select using (
    hidden_at is null
    and exists (
      select 1 from public.course_announcements ca
      join public.enrollments e on e.course_id = ca.course_id
      where ca.id = course_announcement_comments.announcement_id
        and e.student_id = auth.uid()
        and ca.allow_comments = true
    )
  );

-- Alumno inscrito: puede insertar sus propios comentarios si allow_comments=true
drop policy if exists "alumno_insert_own_comment" on public.course_announcement_comments;
create policy "alumno_insert_own_comment" on public.course_announcement_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.course_announcements ca
      join public.enrollments e on e.course_id = ca.course_id
      where ca.id = course_announcement_comments.announcement_id
        and e.student_id = auth.uid()
        and ca.allow_comments = true
    )
  );

