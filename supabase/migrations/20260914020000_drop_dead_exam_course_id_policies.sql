-- Elimina políticas RLS muertas que filtran por `exams.course_id`.
-- Confirmado con datos (2026-09-14): esa columna es NULL en el 100% de los
-- exámenes reales (2/2) — `exams` solo usa `unit_id` (→ course_units → courses)
-- para resolver la materia dueña. Estas políticas nunca otorgaron ni negaron
-- acceso en producción; las políticas equivalentes en español (que sí usan
-- unit_id) ya cubren el mismo caso y siguen intactas.
--
-- No se toca `exams.course_id` como columna (fuera de alcance de esta
-- limpieza) ni las políticas de `submissions` que filtran por
-- `assignments.course_id` (esa sí está poblada al 100% en assignments).

drop policy if exists "docente_manage_exams" on public.exams;
drop policy if exists "docente_manage_eval_responses" on public.evaluation_responses;
drop policy if exists "docente_own_eval_responses" on public.evaluation_responses;
drop policy if exists "docente_manage_questions" on public.questions;
