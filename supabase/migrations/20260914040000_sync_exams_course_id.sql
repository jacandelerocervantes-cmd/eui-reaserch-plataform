-- Corrige `exams.course_id`: existe en producción (columna sin migración
-- rastreada) pero siempre quedó NULL — `exams` solo se llena vía `unit_id`
-- (ver useNuevaEvaluacion.ts). Confirmado que 6+ lugares del código SÍ leen
-- `exams.course_id` asumiendo que está poblada, causando bugs silenciosos:
--   - useCalificaciones.ts: pantalla de Calificaciones nunca muestra exámenes.
--   - detect-exam-anomalies, mcp-server: verifyCourseOwnership(null, ...)
--     siempre falla → todo docente real recibe 403 (denegación falsa, no IDOR).
--   - compute-student-risk-signals: "historial de exámenes" siempre vacío.
--   - validate-ai-grading: calibración por curso nunca encuentra exámenes,
--     cae siempre al fallback global.
--
-- Fix elegido: en vez de parchear cada call site (riesgo de dejar alguno
-- fuera), un trigger mantiene `course_id` sincronizado automáticamente con
-- `unit_id` en cada insert/update — cubre el código ya auditado Y cualquier
-- flujo futuro (ej. el chat de creación por IA que se va a construir) sin
-- que dependa de que cada uno recuerde setear el campo. Se hace en dos pasos:
-- 1) backfill de los exámenes ya existentes, 2) trigger hacia adelante.

update public.exams e
set course_id = cu.course_id
from public.course_units cu
where cu.id = e.unit_id
  and e.course_id is distinct from cu.course_id;

create or replace function public.sync_exam_course_id()
returns trigger
language plpgsql
as $$
begin
  if new.unit_id is not null then
    select course_id into new.course_id from public.course_units where id = new.unit_id;
  else
    new.course_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_exam_course_id on public.exams;

create trigger trg_sync_exam_course_id
before insert or update of unit_id on public.exams
for each row
execute function public.sync_exam_course_id();
