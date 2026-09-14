-- Caso de estudio "GraphRAG casero vs. Vertex AI Search" (crédito de prueba
-- "GenAI App Builder", separado del piloto ai-tutor-sandbox y de su
-- presupuesto de $40 USD/mes -- este caso de estudio corre contra el crédito
-- de Vertex AI Agent Builder, $0 de costo adicional mientras dure el crédito).
--
-- Herramienta de investigación para el equipo docente/administrativo, NUNCA
-- expuesta a alumnos -- ver RLS abajo (solo docente/admin).

create table if not exists "public"."rag_benchmark_questions" (
  "id" uuid not null default gen_random_uuid() primary key,
  "domain" text not null check ("domain" in ('docencia', 'investigacion')),
  "course_id" uuid references "public"."courses"("id"), -- requerido solo si domain='docencia'
  "question" text not null,
  "created_by" uuid not null references "public"."profiles"("id"),
  "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
  constraint "rag_benchmark_questions_course_shape_check" check (
    ("domain" = 'docencia' and "course_id" is not null) or
    ("domain" = 'investigacion' and "course_id" is null)
  )
);

create table if not exists "public"."rag_benchmark_results" (
  "id" uuid not null default gen_random_uuid(),
  "question_id" uuid not null references "public"."rag_benchmark_questions"("id") on delete cascade,
  "system" text not null check ("system" in ('graphrag', 'vertex_search')),
  "answer" text,
  "sources" jsonb,
  "latency_ms" integer,
  "error" text,
  -- Puntaje manual 1-5 que el investigador llena después de leer la
  -- respuesta contra el material fuente real -- ninguna heurística
  -- automática decide "quién ganó", eso es juicio humano deliberado.
  "manual_relevance_score" smallint check ("manual_relevance_score" between 1 and 5),
  "created_at" timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists "rag_benchmark_results_question_id_idx" on "public"."rag_benchmark_results" ("question_id");

alter table "public"."rag_benchmark_questions" enable row level security;
alter table "public"."rag_benchmark_results" enable row level security;

create policy "rag_benchmark_questions_docente_admin_all"
  on "public"."rag_benchmark_questions" for all
  using (
    exists (select 1 from "public"."profiles" p where p."id" = auth.uid() and p."role" in ('docente', 'admin'))
  )
  with check (
    exists (select 1 from "public"."profiles" p where p."id" = auth.uid() and p."role" in ('docente', 'admin'))
  );

create policy "rag_benchmark_results_docente_admin_all"
  on "public"."rag_benchmark_results" for all
  using (
    exists (select 1 from "public"."profiles" p where p."id" = auth.uid() and p."role" in ('docente', 'admin'))
  )
  with check (
    exists (select 1 from "public"."profiles" p where p."id" = auth.uid() and p."role" in ('docente', 'admin'))
  );
