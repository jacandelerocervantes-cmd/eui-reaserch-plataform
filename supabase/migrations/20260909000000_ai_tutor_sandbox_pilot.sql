-- Piloto de tutor de IA para alumnos ("ai_tutor_sandbox").
--
-- CONTEXTO: hasta hoy, ningún alumno tiene acceso a IA generativa (ni en
-- frontend ni en backend) por abuso documentado. Se acordó un piloto acotado
-- (1-2 docentes, 4-5 materias, ~200 alumnos, presupuesto de $40 USD/mes en
-- tier de pago de Gemini) con tres modos de uso, cada uno con su propio
-- interruptor por materia -- NO es un chat abierto sin contexto:
--
--   1. "assignment"  -> ayuda mientras el alumno resuelve una actividad
--                       puntual, antes de entregarla (entregar/[assignmentId]).
--   2. "exam_prep"   -> repaso de temario ANTES de que abra la ventana del
--                       examen real. Se bloquea duro en cuanto exams.start_at
--                       llega -- ver check en _shared/auth.ts, no aquí --
--                       para que jamás coexista con un intento de examen real.
--   3. "general"     -> dudas generales de la materia, no atadas a una
--                       entrega -- el modo más caro/difícil de auditar, por
--                       eso lleva su propio interruptor independiente.
--
-- Cada materia se habilita por separado para cada modo (el docente/admin
-- decide cuáles activa), en vez de un único booleano "ai_sandbox_enabled"
-- que los active los tres a la vez sin control fino.

alter table "public"."courses"
  add column if not exists "ai_sandbox_assignments_enabled" boolean not null default false,
  add column if not exists "ai_sandbox_exam_prep_enabled" boolean not null default false,
  add column if not exists "ai_sandbox_general_enabled" boolean not null default false;

create table if not exists "public"."ai_sandbox_logs" (
  "id" uuid not null default gen_random_uuid(),
  "student_id" uuid not null references "public"."profiles"("id"),
  "course_id" uuid not null references "public"."courses"("id"),
  "context_type" text not null check ("context_type" in ('assignment', 'exam_prep', 'general')),
  "assignment_id" uuid references "public"."assignments"("id"),
  "exam_id" uuid references "public"."exams"("id"),
  "prompt" text not null,
  "response" text not null,
  "guardrail_reasons" jsonb,
  "created_at" timestamp with time zone not null default timezone('utc'::text, now())
);

-- Un registro de "assignment" siempre trae assignment_id (y nunca exam_id);
-- uno de "exam_prep" siempre trae exam_id (y nunca assignment_id); uno de
-- "general" no trae ninguno de los dos. Evita filas ambiguas o cruzadas.
alter table "public"."ai_sandbox_logs"
  add constraint "ai_sandbox_logs_context_shape_check" check (
    ("context_type" = 'assignment' and "assignment_id" is not null and "exam_id" is null) or
    ("context_type" = 'exam_prep' and "exam_id" is not null and "assignment_id" is null) or
    ("context_type" = 'general' and "assignment_id" is null and "exam_id" is null)
  );

create index if not exists "ai_sandbox_logs_student_id_idx" on "public"."ai_sandbox_logs" ("student_id");
create index if not exists "ai_sandbox_logs_course_id_idx" on "public"."ai_sandbox_logs" ("course_id");

alter table "public"."ai_sandbox_logs" enable row level security;

-- El alumno ve y crea únicamente sus propias filas.
create policy "ai_sandbox_logs_student_select_own"
  on "public"."ai_sandbox_logs" for select
  using (auth.uid() = "student_id");

create policy "ai_sandbox_logs_student_insert_own"
  on "public"."ai_sandbox_logs" for insert
  with check (auth.uid() = "student_id");

-- El docente dueño de la materia (o un admin) puede auditar las conversaciones
-- de sus propios cursos -- nunca de materias ajenas.
create policy "ai_sandbox_logs_teacher_select_own_courses"
  on "public"."ai_sandbox_logs" for select
  using (
    exists (
      select 1 from "public"."courses" c
      where c."id" = "ai_sandbox_logs"."course_id"
        and c."teacher_id" = auth.uid()
    )
    or exists (
      select 1 from "public"."profiles" p
      where p."id" = auth.uid() and p."role" = 'admin'
    )
  );
