-- Índices faltantes y eliminación de índice duplicado sobre course_announcements
-- Verificado en producción el 2026-09-14: idx_announcements_course e idx_announcements_course_id
-- comparten exactamente la misma definición sobre course_announcements(course_id).

create index if not exists idx_questions_exam_id on public.questions(exam_id);
create index if not exists idx_teams_course_id on public.teams(course_id);

-- Se elimina el duplicado preservando idx_announcements_course_id
drop index if exists public.idx_announcements_course;

