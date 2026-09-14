-- Validador independiente de integridad (Regresión Logística, _shared/
-- logisticValidator.ts) — contrapeso al hallazgo de docs/04_Multi_Agente_MCP.md
-- §2.3: el integrity_flag de evaluate-submissions-ia lo auto-reporta el mismo
-- modelo (Gemini) que generó/calificó, no es una segunda opinión real.
--
-- Esta tabla acumula el veredicto del docente sobre cada alerta (¿sí era
-- trampa, o falsa alarma?) para poder, más adelante, reemplazar los pesos
-- fijados a mano (DEFAULT_WEIGHTS) por unos ajustados a datos reales de esta
-- institución (ver fitWeights en logisticValidator.ts, ya listo pero sin usar
-- en producción todavía -- se necesitan casos reales primero).

create table if not exists "public"."integrity_flag_feedback" (
  "id" uuid not null default gen_random_uuid(),
  "submission_id" uuid not null references "public"."submissions"("id") on delete cascade,
  "predicted_probability" double precision not null,
  "features" jsonb not null, -- snapshot de SubmissionFeatures en el momento del veredicto, para poder reentrenar después
  "verdict" text not null check ("verdict" in ('confirmed_cheating', 'false_positive')),
  "docente_notes" text,
  "created_by" uuid not null references "public"."profiles"("id"),
  "created_at" timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists "integrity_flag_feedback_submission_id_idx" on "public"."integrity_flag_feedback" ("submission_id");

alter table "public"."integrity_flag_feedback" enable row level security;

-- Herramienta de staff docente/admin -- nunca visible para alumnos.
create policy "integrity_flag_feedback_docente_admin_select"
  on "public"."integrity_flag_feedback" for select
  using (
    exists (select 1 from "public"."profiles" p where p."id" = auth.uid() and p."role" in ('docente', 'admin'))
  );

create policy "integrity_flag_feedback_docente_admin_insert"
  on "public"."integrity_flag_feedback" for insert
  with check (
    "created_by" = auth.uid()
    and exists (select 1 from "public"."profiles" p where p."id" = auth.uid() and p."role" in ('docente', 'admin'))
  );
