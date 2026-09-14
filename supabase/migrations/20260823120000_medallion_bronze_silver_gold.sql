-- Módulo 01 — Arquitectura de datos Medallón (Bronce/Plata/Oro) sobre el
-- mismo Postgres de Supabase (docs/01_ARQUITECTURA_DEVOPS_FRUGAL.md,
-- sección 2). Cero infraestructura nueva: schemas separados + vistas
-- materializadas + pg_cron, en vez de un clúster Spark/Databricks aparte
-- (justificación de por qué NO Databricks: mismo doc, sección 2).
--
-- Grounding real de esquema: `public.courses` NO tiene columna "semestre"
-- (verificado contra 20260225000320_remote_schema.sql) — la partición
-- train/validation/test de la capa Oro se hace por `course_id`, ordenado
-- cronológicamente por `courses.created_at`, replicando en SQL el mismo
-- algoritmo determinista probado en lib/dataSplit.ts (computeChronologicalSplit).

create extension if not exists pg_cron with schema extensions;

-- ═══════════════════════════════════════════════════════════════════════
-- BRONCE — tal cual las escribe la app hoy. Vistas simples (no copian
-- datos) sobre las tablas reales: cero storage adicional, solo el
-- namespace/contrato Medallón.
-- ═══════════════════════════════════════════════════════════════════════
create schema if not exists bronze;

create or replace view bronze.grades as
  select id, student_id, activity_id, score, created_at from public.grades;

create or replace view bronze.courses as
  select id, title, teacher_id, is_active, created_at from public.courses;

-- ═══════════════════════════════════════════════════════════════════════
-- PLATA — limpieza de ruido (outliers, nulos) sobre bronce.grades. `score`
-- es numeric(5,2), usado en la app como porcentaje 0-100 (ver grades.score
-- en 20260225000320_remote_schema.sql:296 y su uso en cálculo de promedio
-- ponderado por actividad) — un valor fuera de ese rango es un dato
-- imposible, no un promedio real.
-- ═══════════════════════════════════════════════════════════════════════
create schema if not exists silver;

create materialized view silver.grades_clean as
select
  g.id,
  g.student_id,
  g.activity_id,
  case
    when g.score is null then null
    when g.score < 0 or g.score > 100 then null
    else g.score
  end as score_limpio,
  case
    when g.score is null then 'pendiente_evaluacion'
    when g.score < 0 or g.score > 100 then 'valor_invalido_revisar'
    else 'ok'
  end as estado_calidad,
  g.created_at
from bronze.grades g;

create unique index if not exists silver_grades_clean_id_idx on silver.grades_clean (id);

-- Refresco periódico vía pg_cron (frugal: no necesita ser tiempo real).
select cron.schedule(
  'refresh-silver-grades-clean',
  '0 */6 * * *',
  $$refresh materialized view concurrently silver.grades_clean$$
) where not exists (
  select 1 from cron.job where jobname = 'refresh-silver-grades-clean'
);

-- ═══════════════════════════════════════════════════════════════════════
-- ORO — partición train/validation/test SIN fuga de datos.
--
-- Split por `course_id` (no por fila de calificación ni por alumno):
-- cronológico por `courses.created_at`, 70/15/15, determinista. Garantiza
-- (a) el modelo nunca "ve" en train un curso creado después de uno usado
-- en test (evita fuga temporal), y (b) TODAS las calificaciones de un
-- mismo curso caen en el mismo split (evita fuga por identidad de curso —
-- ningún course_id puede aparecer en dos splits, por construcción).
--
-- Réplica en SQL, vía window functions, del mismo algoritmo probado en
-- lib/dataSplit.ts::computeChronologicalSplit (orden cronológico +
-- desempate por id + corte por posición, sin aleatoriedad).
-- ═══════════════════════════════════════════════════════════════════════
create schema if not exists gold;

create materialized view gold.course_split as
with ordenado as (
  select
    id as course_id,
    created_at,
    row_number() over (order by created_at asc, id asc) as posicion,
    count(*) over ()                                     as total
  from bronze.courses
)
select
  course_id,
  created_at,
  case
    when posicion <= floor(total * 0.70)                    then 'train'
    when posicion <= floor(total * 0.70) + floor(total * 0.15) then 'validation'
    else                                                          'test'
  end as split
from ordenado;

create unique index if not exists gold_course_split_course_id_idx on gold.course_split (course_id);

select cron.schedule(
  'refresh-gold-course-split',
  '0 */6 * * *',
  $$refresh materialized view concurrently gold.course_split$$
) where not exists (
  select 1 from cron.job where jobname = 'refresh-gold-course-split'
);

-- Verificación computacional de que NO hay fuga: ningún course_id debe
-- tener más de una fila en gold.course_split (el índice único de arriba ya
-- lo garantiza a nivel de constraint, pero se deja explícito como
-- documentación ejecutable — falla el `select` si algún día deja de ser
-- cierto por un cambio futuro que quite el índice único).
do $$
declare
  fugas integer;
begin
  select count(*) into fugas
  from (
    select course_id from gold.course_split group by course_id having count(distinct split) > 1
  ) leaked;

  if fugas > 0 then
    raise exception 'Data leakage detectado: % course_id con más de un split asignado', fugas;
  end if;
end $$;

-- Tabla agregada de desempeño por alumno/curso, con el split heredado del
-- curso (no recalculado por alumno — así ningún alumno "parte" un curso en
-- dos splits distintos).
create materialized view gold.desempeno_estudiante_curso as
select
  s.id                as student_id,
  c.course_id,
  count(g.id)          as calificaciones_evaluadas,
  avg(g.score_limpio)  as promedio,
  c.split
from silver.grades_clean g
join public.students s on s.id = g.student_id
join public.activities a on a.id = g.activity_id
join public.course_units cu on cu.id = a.unit_id
join gold.course_split c on c.course_id = cu.course_id
where g.estado_calidad = 'ok'
group by s.id, c.course_id, c.split;

create unique index if not exists gold_desempeno_estudiante_curso_idx
  on gold.desempeno_estudiante_curso (student_id, course_id);
