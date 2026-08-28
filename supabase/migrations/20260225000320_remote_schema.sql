drop extension if exists "pg_net";

create type "public"."estado_equipo_lab" as enum ('activo', 'en_uso', 'mantenimiento');

create type "public"."estado_riesgo_academico" as enum ('seguro', 'atencion', 'urgente');

create type "public"."exam_status" as enum ('draft', 'scheduled', 'published', 'closed');

create type "public"."question_type" as enum ('multiple_choice', 'true_false', 'open', 'matching');

create type "public"."rol_usuario" as enum ('docente', 'alumno', 'investigador');

create type "public"."tipo_bitacora" as enum ('voz_transcrita', 'manual', 'alerta_sistema');

create type "public"."tipo_sesion_insitu" as enum ('pase_lista', 'taller_workspace', 'examen_bloqueado');

create type "public"."user_role" as enum ('admin', 'docente', 'alumno');


  create table "public"."activities" (
    "id" uuid not null default gen_random_uuid(),
    "unit_id" uuid,
    "name" text not null,
    "weight_percentage" integer not null,
    "created_at" timestamp with time zone default now(),
    "rubrica_ia_sugerida" jsonb
      );



  create table "public"."anuncios" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "materia_id" uuid not null,
    "autor_id" uuid not null,
    "titulo" text not null,
    "contenido" text not null,
    "es_ia_generado" boolean default false,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."anuncios" enable row level security;


  create table "public"."asistencias_validadas" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "sesion_id" uuid not null,
    "alumno_id" uuid not null,
    "latitud_registrada" numeric(10,8),
    "longitud_registrada" numeric(11,8),
    "hora_validacion" timestamp with time zone default now()
      );


alter table "public"."asistencias_validadas" enable row level security;


  create table "public"."assignment_bank" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "teacher_id" uuid not null,
    "title" text not null,
    "description" text,
    "rubric_template" jsonb,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."assignment_team_members" (
    "team_id" uuid not null,
    "student_id" uuid not null
      );



  create table "public"."assignment_teams" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "assignment_id" uuid not null,
    "name" text not null,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."assignments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "course_id" uuid not null,
    "unit_id" uuid not null,
    "criteria_id" uuid not null,
    "bank_id" uuid,
    "title" text not null,
    "description" text,
    "format" text,
    "submission_type" text,
    "soft_deadline" timestamp with time zone not null,
    "hard_deadline" timestamp with time zone,
    "late_penalty_percent" numeric default 0,
    "rubric_data" jsonb not null,
    "peer_review_enabled" boolean default false,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."attendance" (
    "id" uuid not null default gen_random_uuid(),
    "course_id" uuid,
    "student_id" uuid,
    "session_date" date not null,
    "session_number" integer not null,
    "status" numeric not null,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "justification_text" text,
    "file_url" text
      );



  create table "public"."bitacora_eln" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "autor_id" uuid default auth.uid(),
    "titulo" character varying(255),
    "texto_crudo" text,
    "contenido_json" jsonb,
    "tipo" public.tipo_bitacora default 'voz_transcrita'::public.tipo_bitacora,
    "tags" text[] default '{}'::text[],
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."bitacora_eln" enable row level security;


  create table "public"."canvas_documentos" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "proyecto_id" uuid,
    "autor_id" uuid,
    "titulo_manuscrito" text,
    "contenido_crudo" text,
    "contenido_json" jsonb,
    "metadata_ia" jsonb,
    "ultima_sincronizacion" timestamp with time zone default now(),
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."canvas_documentos" enable row level security;


  create table "public"."citas_asesoria" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "docente_id" uuid,
    "solicitante_nombre" text not null,
    "solicitante_email" text not null,
    "tipo_cita" text,
    "fecha" date not null,
    "hora" time without time zone not null,
    "status" text default 'pendiente'::text,
    "google_meet_link" text,
    "google_event_id" text,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."citas_asesoria" enable row level security;


  create table "public"."course_units" (
    "id" uuid not null default gen_random_uuid(),
    "course_id" uuid not null,
    "name" text not null,
    "unit_number" integer not null,
    "created_at" timestamp with time zone default now(),
    "is_closed" boolean default false
      );



  create table "public"."courses" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "teacher_id" uuid not null,
    "drive_folder_id" text,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."courses" enable row level security;


  create table "public"."enrollments" (
    "course_id" uuid not null,
    "student_id" uuid not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."enrollments" enable row level security;


  create table "public"."entregas" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "tarea_id" uuid not null,
    "alumno_id" uuid not null,
    "archivo_url" text,
    "repositorio_url" text,
    "calificacion" numeric(5,2),
    "feedback_docente" text,
    "entregado_en" timestamp with time zone default now()
      );


alter table "public"."entregas" enable row level security;


  create table "public"."equipos_lab" (
    "id" character varying(50) not null,
    "nombre_equipo" character varying(200) not null,
    "modelo" character varying(100),
    "estado" public.estado_equipo_lab default 'activo'::public.estado_equipo_lab,
    "ultima_calibracion" date,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."equipos_lab" enable row level security;


  create table "public"."evaluations" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "submission_id" uuid not null,
    "evaluator_type" text,
    "evaluator_id" uuid,
    "suggested_score" numeric,
    "final_score" numeric,
    "justification_draft" text,
    "justification_final" text,
    "rubric_breakdown" jsonb,
    "is_draft" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."exams" (
    "id" uuid not null default gen_random_uuid(),
    "unit_id" uuid,
    "title" text not null,
    "description" text,
    "status" public.exam_status default 'draft'::public.exam_status,
    "start_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "duration_minutes" integer default 60,
    "randomize_questions" boolean default true,
    "randomize_options" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "ai_group_insight" text
      );



  create table "public"."fondos_investigacion" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "proyecto_id" uuid,
    "nombre_fondo" text not null,
    "monto_total" numeric(15,2) not null default 0,
    "monto_ejercido" numeric(15,2) default 0,
    "status" text default 'Activo'::text,
    "color_hex" character varying(7) default '#1B396A'::character varying,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."fondos_investigacion" enable row level security;


  create table "public"."geocercas_materia" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "materia_id" uuid not null,
    "latitud_centro" numeric(10,8) not null,
    "longitud_centro" numeric(11,8) not null,
    "radio_metros" integer default 30
      );


alter table "public"."geocercas_materia" enable row level security;


  create table "public"."grades" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid,
    "activity_id" uuid,
    "score" numeric(5,2) default 0,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."horarios_docente" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "materia_id" uuid,
    "dia_semana" character varying(15) not null,
    "hora_inicio" time without time zone not null,
    "hora_fin" time without time zone not null,
    "salon" text,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."horarios_docente" enable row level security;


  create table "public"."inscripciones" (
    "materia_id" uuid not null,
    "alumno_id" uuid not null,
    "promedio_actual" numeric(5,2) default 0.00,
    "estado_riesgo" public.estado_riesgo_academico default 'seguro'::public.estado_riesgo_academico
      );


alter table "public"."inscripciones" enable row level security;


  create table "public"."literatura_referencias" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "usuario_id" uuid,
    "titulo" text not null,
    "autores" text,
    "año" integer,
    "journal" text,
    "abstract" text,
    "doi" text,
    "url_pdf" text,
    "posicion_grafo" jsonb,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."literatura_referencias" enable row level security;


  create table "public"."materiales_boveda" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "materia_id" uuid not null,
    "titulo" character varying(200) not null,
    "archivo_url" text not null,
    "tamano_bytes" bigint,
    "es_visible" boolean default false,
    "creado_en" timestamp with time zone default now(),
    "unit_id" uuid,
    "es_hibrido_ia" boolean default false
      );


alter table "public"."materiales_boveda" enable row level security;


  create table "public"."materias" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "docente_id" uuid not null,
    "nombre" character varying(150) not null,
    "semestre" character varying(20),
    "color_hex" character varying(7) default '#1B396A'::character varying,
    "creado_en" timestamp with time zone default now(),
    "drive_folder_id" text,
    "google_sheet_id" text
      );


alter table "public"."materias" enable row level security;


  create table "public"."materias_avisos" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "materia_id" uuid not null,
    "autor_id" uuid not null default auth.uid(),
    "titulo" text not null,
    "contenido" text not null,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."materias_avisos" enable row level security;


  create table "public"."perfiles" (
    "id" uuid not null,
    "matricula_rfc" character varying(20) not null,
    "nombre_completo" character varying(150) not null,
    "rol" public.rol_usuario not null,
    "avatar_url" text,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."perfiles" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "first_name" text,
    "last_name" text,
    "role" public.user_role not null default 'alumno'::public.user_role,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."profiles" enable row level security;


  create table "public"."proyectos_investigacion" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "investigador_principal_id" uuid,
    "titulo" text not null,
    "descripcion" text,
    "objetivo_general" text,
    "fecha_inicio" date default CURRENT_DATE,
    "fecha_fin_estimada" date,
    "estado" text default 'Propuesta'::text,
    "is_public" boolean default false,
    "doi_link" text,
    "tags" text[] default '{}'::text[],
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."proyectos_investigacion" enable row level security;


  create table "public"."questions" (
    "id" uuid not null default gen_random_uuid(),
    "exam_id" uuid,
    "content" text not null,
    "q_type" public.question_type default 'multiple_choice'::public.question_type,
    "options" jsonb default '[]'::jsonb,
    "correct_answer" text not null,
    "points" double precision default 1.0,
    "competency_tag" text,
    "bloom_level" text,
    "ai_source_type" text,
    "order_index" integer,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."quick_comments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "teacher_id" uuid not null,
    "category" text,
    "comment_text" text not null,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."sesiones_insitu" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "materia_id" uuid not null,
    "tipo" public.tipo_sesion_insitu not null,
    "codigo_qr_hash" character varying(255) not null,
    "fecha_creacion" timestamp with time zone default now(),
    "fecha_expiracion" timestamp with time zone not null,
    "is_activa" boolean default true
      );


alter table "public"."sesiones_insitu" enable row level security;


  create table "public"."student_exams" (
    "id" uuid not null default gen_random_uuid(),
    "student_id" uuid,
    "exam_id" uuid,
    "started_at" timestamp with time zone default now(),
    "finished_at" timestamp with time zone,
    "score" double precision default 0,
    "ai_feedback_plan" text,
    "status" text default 'in_progress'::text,
    "local_draft_backup" jsonb default '{}'::jsonb
      );



  create table "public"."students" (
    "id" uuid not null default gen_random_uuid(),
    "course_id" uuid,
    "team_id" uuid,
    "matricula" text not null,
    "correo" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "apellido_paterno" text not null,
    "apellido_materno" text,
    "nombres" text not null
      );



  create table "public"."submissions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "assignment_id" uuid not null,
    "student_id" uuid,
    "team_id" uuid,
    "status" text default 'draft'::text,
    "content_url" text,
    "version_number" integer default 1,
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."tareas_usuario" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "usuario_id" uuid,
    "titulo" text not null,
    "descripcion" text,
    "categoria" text default 'Docencia'::text,
    "prioridad" text default 'Media'::text,
    "fecha_limite" timestamp with time zone,
    "completada" boolean default false,
    "google_task_id" text,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."tareas_usuario" enable row level security;


  create table "public"."teams" (
    "id" uuid not null default gen_random_uuid(),
    "course_id" uuid,
    "name" text not null,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
      );



  create table "public"."telemetria_iot" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "equipo_id" character varying(50),
    "proyecto_id" character varying(100),
    "payload" jsonb not null,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."telemetria_iot" enable row level security;


  create table "public"."tesistas" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "director_id" uuid,
    "alumno_id" uuid,
    "nombre_alumno" text not null,
    "titulo_tesis" text not null,
    "progreso" integer default 0,
    "status" text default 'Protocolo'::text,
    "ultimo_archivo_url" text,
    "fecha_entrega_estimada" date,
    "creado_en" timestamp with time zone default now()
      );


alter table "public"."tesistas" enable row level security;

CREATE UNIQUE INDEX activities_pkey ON public.activities USING btree (id);

CREATE UNIQUE INDEX anuncios_pkey ON public.anuncios USING btree (id);

CREATE UNIQUE INDEX asistencias_validadas_pkey ON public.asistencias_validadas USING btree (id);

CREATE UNIQUE INDEX asistencias_validadas_sesion_id_alumno_id_key ON public.asistencias_validadas USING btree (sesion_id, alumno_id);

CREATE UNIQUE INDEX assignment_bank_pkey ON public.assignment_bank USING btree (id);

CREATE UNIQUE INDEX assignment_team_members_pkey ON public.assignment_team_members USING btree (team_id, student_id);

CREATE UNIQUE INDEX assignment_teams_pkey ON public.assignment_teams USING btree (id);

CREATE UNIQUE INDEX assignments_pkey ON public.assignments USING btree (id);

CREATE UNIQUE INDEX attendance_pkey ON public.attendance USING btree (id);

CREATE UNIQUE INDEX attendance_student_id_session_date_session_number_key ON public.attendance USING btree (student_id, session_date, session_number);

CREATE UNIQUE INDEX bitacora_eln_pkey ON public.bitacora_eln USING btree (id);

CREATE UNIQUE INDEX canvas_documentos_pkey ON public.canvas_documentos USING btree (id);

CREATE UNIQUE INDEX citas_asesoria_pkey ON public.citas_asesoria USING btree (id);

CREATE UNIQUE INDEX course_units_pkey ON public.course_units USING btree (id);

CREATE UNIQUE INDEX courses_pkey ON public.courses USING btree (id);

CREATE UNIQUE INDEX enrollments_pkey ON public.enrollments USING btree (course_id, student_id);

CREATE UNIQUE INDEX entregas_pkey ON public.entregas USING btree (id);

CREATE UNIQUE INDEX entregas_tarea_id_alumno_id_key ON public.entregas USING btree (tarea_id, alumno_id);

CREATE UNIQUE INDEX equipos_lab_pkey ON public.equipos_lab USING btree (id);

CREATE UNIQUE INDEX evaluations_pkey ON public.evaluations USING btree (id);

CREATE UNIQUE INDEX exams_pkey ON public.exams USING btree (id);

CREATE UNIQUE INDEX fondos_investigacion_pkey ON public.fondos_investigacion USING btree (id);

CREATE UNIQUE INDEX geocercas_materia_materia_id_key ON public.geocercas_materia USING btree (materia_id);

CREATE UNIQUE INDEX geocercas_materia_pkey ON public.geocercas_materia USING btree (id);

CREATE UNIQUE INDEX grades_pkey ON public.grades USING btree (id);

CREATE UNIQUE INDEX grades_student_id_activity_id_key ON public.grades USING btree (student_id, activity_id);

CREATE UNIQUE INDEX horarios_docente_pkey ON public.horarios_docente USING btree (id);

CREATE UNIQUE INDEX inscripciones_pkey ON public.inscripciones USING btree (materia_id, alumno_id);

CREATE UNIQUE INDEX literatura_referencias_doi_key ON public.literatura_referencias USING btree (doi);

CREATE UNIQUE INDEX literatura_referencias_pkey ON public.literatura_referencias USING btree (id);

CREATE UNIQUE INDEX materiales_boveda_pkey ON public.materiales_boveda USING btree (id);

CREATE UNIQUE INDEX materias_avisos_pkey ON public.materias_avisos USING btree (id);

CREATE UNIQUE INDEX materias_pkey ON public.materias USING btree (id);

CREATE UNIQUE INDEX perfiles_matricula_rfc_key ON public.perfiles USING btree (matricula_rfc);

CREATE UNIQUE INDEX perfiles_pkey ON public.perfiles USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX proyectos_investigacion_pkey ON public.proyectos_investigacion USING btree (id);

CREATE UNIQUE INDEX questions_pkey ON public.questions USING btree (id);

CREATE UNIQUE INDEX quick_comments_pkey ON public.quick_comments USING btree (id);

CREATE UNIQUE INDEX sesiones_insitu_pkey ON public.sesiones_insitu USING btree (id);

CREATE UNIQUE INDEX student_exams_pkey ON public.student_exams USING btree (id);

CREATE UNIQUE INDEX students_pkey ON public.students USING btree (id);

CREATE UNIQUE INDEX submissions_pkey ON public.submissions USING btree (id);

CREATE UNIQUE INDEX tareas_usuario_pkey ON public.tareas_usuario USING btree (id);

CREATE UNIQUE INDEX teams_pkey ON public.teams USING btree (id);

CREATE UNIQUE INDEX telemetria_iot_pkey ON public.telemetria_iot USING btree (id);

CREATE UNIQUE INDEX tesistas_pkey ON public.tesistas USING btree (id);

alter table "public"."activities" add constraint "activities_pkey" PRIMARY KEY using index "activities_pkey";

alter table "public"."anuncios" add constraint "anuncios_pkey" PRIMARY KEY using index "anuncios_pkey";

alter table "public"."asistencias_validadas" add constraint "asistencias_validadas_pkey" PRIMARY KEY using index "asistencias_validadas_pkey";

alter table "public"."assignment_bank" add constraint "assignment_bank_pkey" PRIMARY KEY using index "assignment_bank_pkey";

alter table "public"."assignment_team_members" add constraint "assignment_team_members_pkey" PRIMARY KEY using index "assignment_team_members_pkey";

alter table "public"."assignment_teams" add constraint "assignment_teams_pkey" PRIMARY KEY using index "assignment_teams_pkey";

alter table "public"."assignments" add constraint "assignments_pkey" PRIMARY KEY using index "assignments_pkey";

alter table "public"."attendance" add constraint "attendance_pkey" PRIMARY KEY using index "attendance_pkey";

alter table "public"."bitacora_eln" add constraint "bitacora_eln_pkey" PRIMARY KEY using index "bitacora_eln_pkey";

alter table "public"."canvas_documentos" add constraint "canvas_documentos_pkey" PRIMARY KEY using index "canvas_documentos_pkey";

alter table "public"."citas_asesoria" add constraint "citas_asesoria_pkey" PRIMARY KEY using index "citas_asesoria_pkey";

alter table "public"."course_units" add constraint "course_units_pkey" PRIMARY KEY using index "course_units_pkey";

alter table "public"."courses" add constraint "courses_pkey" PRIMARY KEY using index "courses_pkey";

alter table "public"."enrollments" add constraint "enrollments_pkey" PRIMARY KEY using index "enrollments_pkey";

alter table "public"."entregas" add constraint "entregas_pkey" PRIMARY KEY using index "entregas_pkey";

alter table "public"."equipos_lab" add constraint "equipos_lab_pkey" PRIMARY KEY using index "equipos_lab_pkey";

alter table "public"."evaluations" add constraint "evaluations_pkey" PRIMARY KEY using index "evaluations_pkey";

alter table "public"."exams" add constraint "exams_pkey" PRIMARY KEY using index "exams_pkey";

alter table "public"."fondos_investigacion" add constraint "fondos_investigacion_pkey" PRIMARY KEY using index "fondos_investigacion_pkey";

alter table "public"."geocercas_materia" add constraint "geocercas_materia_pkey" PRIMARY KEY using index "geocercas_materia_pkey";

alter table "public"."grades" add constraint "grades_pkey" PRIMARY KEY using index "grades_pkey";

alter table "public"."horarios_docente" add constraint "horarios_docente_pkey" PRIMARY KEY using index "horarios_docente_pkey";

alter table "public"."inscripciones" add constraint "inscripciones_pkey" PRIMARY KEY using index "inscripciones_pkey";

alter table "public"."literatura_referencias" add constraint "literatura_referencias_pkey" PRIMARY KEY using index "literatura_referencias_pkey";

alter table "public"."materiales_boveda" add constraint "materiales_boveda_pkey" PRIMARY KEY using index "materiales_boveda_pkey";

alter table "public"."materias" add constraint "materias_pkey" PRIMARY KEY using index "materias_pkey";

alter table "public"."materias_avisos" add constraint "materias_avisos_pkey" PRIMARY KEY using index "materias_avisos_pkey";

alter table "public"."perfiles" add constraint "perfiles_pkey" PRIMARY KEY using index "perfiles_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."proyectos_investigacion" add constraint "proyectos_investigacion_pkey" PRIMARY KEY using index "proyectos_investigacion_pkey";

alter table "public"."questions" add constraint "questions_pkey" PRIMARY KEY using index "questions_pkey";

alter table "public"."quick_comments" add constraint "quick_comments_pkey" PRIMARY KEY using index "quick_comments_pkey";

alter table "public"."sesiones_insitu" add constraint "sesiones_insitu_pkey" PRIMARY KEY using index "sesiones_insitu_pkey";

alter table "public"."student_exams" add constraint "student_exams_pkey" PRIMARY KEY using index "student_exams_pkey";

alter table "public"."students" add constraint "students_pkey" PRIMARY KEY using index "students_pkey";

alter table "public"."submissions" add constraint "submissions_pkey" PRIMARY KEY using index "submissions_pkey";

alter table "public"."tareas_usuario" add constraint "tareas_usuario_pkey" PRIMARY KEY using index "tareas_usuario_pkey";

alter table "public"."teams" add constraint "teams_pkey" PRIMARY KEY using index "teams_pkey";

alter table "public"."telemetria_iot" add constraint "telemetria_iot_pkey" PRIMARY KEY using index "telemetria_iot_pkey";

alter table "public"."tesistas" add constraint "tesistas_pkey" PRIMARY KEY using index "tesistas_pkey";

alter table "public"."activities" add constraint "activities_unit_id_fkey" FOREIGN KEY (unit_id) REFERENCES public.course_units(id) ON DELETE CASCADE not valid;

alter table "public"."activities" validate constraint "activities_unit_id_fkey";

alter table "public"."anuncios" add constraint "anuncios_autor_id_fkey" FOREIGN KEY (autor_id) REFERENCES public.perfiles(id) not valid;

alter table "public"."anuncios" validate constraint "anuncios_autor_id_fkey";

alter table "public"."anuncios" add constraint "anuncios_materia_id_fkey" FOREIGN KEY (materia_id) REFERENCES public.materias(id) ON DELETE CASCADE not valid;

alter table "public"."anuncios" validate constraint "anuncios_materia_id_fkey";

alter table "public"."asistencias_validadas" add constraint "asistencias_validadas_alumno_id_fkey" FOREIGN KEY (alumno_id) REFERENCES public.perfiles(id) ON DELETE CASCADE not valid;

alter table "public"."asistencias_validadas" validate constraint "asistencias_validadas_alumno_id_fkey";

alter table "public"."asistencias_validadas" add constraint "asistencias_validadas_sesion_id_alumno_id_key" UNIQUE using index "asistencias_validadas_sesion_id_alumno_id_key";

alter table "public"."asistencias_validadas" add constraint "asistencias_validadas_sesion_id_fkey" FOREIGN KEY (sesion_id) REFERENCES public.sesiones_insitu(id) ON DELETE CASCADE not valid;

alter table "public"."asistencias_validadas" validate constraint "asistencias_validadas_sesion_id_fkey";

alter table "public"."assignment_team_members" add constraint "assignment_team_members_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."assignment_team_members" validate constraint "assignment_team_members_student_id_fkey";

alter table "public"."assignment_team_members" add constraint "assignment_team_members_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.assignment_teams(id) ON DELETE CASCADE not valid;

alter table "public"."assignment_team_members" validate constraint "assignment_team_members_team_id_fkey";

alter table "public"."assignment_teams" add constraint "assignment_teams_assignment_id_fkey" FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE not valid;

alter table "public"."assignment_teams" validate constraint "assignment_teams_assignment_id_fkey";

alter table "public"."assignments" add constraint "assignments_bank_id_fkey" FOREIGN KEY (bank_id) REFERENCES public.assignment_bank(id) ON DELETE SET NULL not valid;

alter table "public"."assignments" validate constraint "assignments_bank_id_fkey";

alter table "public"."assignments" add constraint "assignments_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE not valid;

alter table "public"."assignments" validate constraint "assignments_course_id_fkey";

alter table "public"."assignments" add constraint "assignments_criteria_id_fkey" FOREIGN KEY (criteria_id) REFERENCES public.activities(id) ON DELETE CASCADE not valid;

alter table "public"."assignments" validate constraint "assignments_criteria_id_fkey";

alter table "public"."assignments" add constraint "assignments_format_check" CHECK ((format = ANY (ARRAY['individual'::text, 'team'::text]))) not valid;

alter table "public"."assignments" validate constraint "assignments_format_check";

alter table "public"."assignments" add constraint "assignments_submission_type_check" CHECK ((submission_type = ANY (ARRAY['file'::text, 'workspace'::text, 'forum'::text, 'hybrid'::text]))) not valid;

alter table "public"."assignments" validate constraint "assignments_submission_type_check";

alter table "public"."assignments" add constraint "assignments_unit_id_fkey" FOREIGN KEY (unit_id) REFERENCES public.course_units(id) ON DELETE CASCADE not valid;

alter table "public"."assignments" validate constraint "assignments_unit_id_fkey";

alter table "public"."attendance" add constraint "attendance_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE not valid;

alter table "public"."attendance" validate constraint "attendance_course_id_fkey";

alter table "public"."attendance" add constraint "attendance_session_number_check" CHECK ((session_number = ANY (ARRAY[1, 2]))) not valid;

alter table "public"."attendance" validate constraint "attendance_session_number_check";

alter table "public"."attendance" add constraint "attendance_status_check" CHECK ((status = ANY (ARRAY[(0)::numeric, 0.5, (1)::numeric]))) not valid;

alter table "public"."attendance" validate constraint "attendance_status_check";

alter table "public"."attendance" add constraint "attendance_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."attendance" validate constraint "attendance_student_id_fkey";

alter table "public"."attendance" add constraint "attendance_student_id_session_date_session_number_key" UNIQUE using index "attendance_student_id_session_date_session_number_key";

alter table "public"."bitacora_eln" add constraint "bitacora_eln_autor_id_fkey" FOREIGN KEY (autor_id) REFERENCES public.perfiles(id) ON DELETE CASCADE not valid;

alter table "public"."bitacora_eln" validate constraint "bitacora_eln_autor_id_fkey";

alter table "public"."canvas_documentos" add constraint "canvas_documentos_autor_id_fkey" FOREIGN KEY (autor_id) REFERENCES public.perfiles(id) not valid;

alter table "public"."canvas_documentos" validate constraint "canvas_documentos_autor_id_fkey";

alter table "public"."canvas_documentos" add constraint "canvas_documentos_proyecto_id_fkey" FOREIGN KEY (proyecto_id) REFERENCES public.proyectos_investigacion(id) ON DELETE CASCADE not valid;

alter table "public"."canvas_documentos" validate constraint "canvas_documentos_proyecto_id_fkey";

alter table "public"."citas_asesoria" add constraint "citas_asesoria_docente_id_fkey" FOREIGN KEY (docente_id) REFERENCES public.perfiles(id) not valid;

alter table "public"."citas_asesoria" validate constraint "citas_asesoria_docente_id_fkey";

alter table "public"."citas_asesoria" add constraint "citas_asesoria_status_check" CHECK ((status = ANY (ARRAY['pendiente'::text, 'confirmada'::text, 'cancelada'::text]))) not valid;

alter table "public"."citas_asesoria" validate constraint "citas_asesoria_status_check";

alter table "public"."courses" add constraint "courses_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."courses" validate constraint "courses_teacher_id_fkey";

alter table "public"."enrollments" add constraint "enrollments_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE not valid;

alter table "public"."enrollments" validate constraint "enrollments_course_id_fkey";

alter table "public"."enrollments" add constraint "enrollments_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."enrollments" validate constraint "enrollments_student_id_fkey";

alter table "public"."entregas" add constraint "entregas_alumno_id_fkey" FOREIGN KEY (alumno_id) REFERENCES public.perfiles(id) ON DELETE CASCADE not valid;

alter table "public"."entregas" validate constraint "entregas_alumno_id_fkey";

alter table "public"."entregas" add constraint "entregas_tarea_id_alumno_id_key" UNIQUE using index "entregas_tarea_id_alumno_id_key";

alter table "public"."evaluations" add constraint "evaluations_evaluator_type_check" CHECK ((evaluator_type = ANY (ARRAY['ai'::text, 'peer'::text, 'teacher'::text]))) not valid;

alter table "public"."evaluations" validate constraint "evaluations_evaluator_type_check";

alter table "public"."evaluations" add constraint "evaluations_submission_id_fkey" FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE not valid;

alter table "public"."evaluations" validate constraint "evaluations_submission_id_fkey";

alter table "public"."fondos_investigacion" add constraint "fondos_investigacion_proyecto_id_fkey" FOREIGN KEY (proyecto_id) REFERENCES public.proyectos_investigacion(id) ON DELETE CASCADE not valid;

alter table "public"."fondos_investigacion" validate constraint "fondos_investigacion_proyecto_id_fkey";

alter table "public"."fondos_investigacion" add constraint "fondos_investigacion_status_check" CHECK ((status = ANY (ARRAY['Activo'::text, 'Por Cerrar'::text, 'Cerrado'::text]))) not valid;

alter table "public"."fondos_investigacion" validate constraint "fondos_investigacion_status_check";

alter table "public"."geocercas_materia" add constraint "geocercas_materia_materia_id_fkey" FOREIGN KEY (materia_id) REFERENCES public.materias(id) ON DELETE CASCADE not valid;

alter table "public"."geocercas_materia" validate constraint "geocercas_materia_materia_id_fkey";

alter table "public"."geocercas_materia" add constraint "geocercas_materia_materia_id_key" UNIQUE using index "geocercas_materia_materia_id_key";

alter table "public"."grades" add constraint "grades_activity_id_fkey" FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE not valid;

alter table "public"."grades" validate constraint "grades_activity_id_fkey";

alter table "public"."grades" add constraint "grades_student_id_activity_id_key" UNIQUE using index "grades_student_id_activity_id_key";

alter table "public"."grades" add constraint "grades_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."grades" validate constraint "grades_student_id_fkey";

alter table "public"."horarios_docente" add constraint "horarios_docente_materia_id_fkey" FOREIGN KEY (materia_id) REFERENCES public.materias(id) ON DELETE CASCADE not valid;

alter table "public"."horarios_docente" validate constraint "horarios_docente_materia_id_fkey";

alter table "public"."inscripciones" add constraint "inscripciones_alumno_id_fkey" FOREIGN KEY (alumno_id) REFERENCES public.perfiles(id) ON DELETE CASCADE not valid;

alter table "public"."inscripciones" validate constraint "inscripciones_alumno_id_fkey";

alter table "public"."inscripciones" add constraint "inscripciones_materia_id_fkey" FOREIGN KEY (materia_id) REFERENCES public.materias(id) ON DELETE CASCADE not valid;

alter table "public"."inscripciones" validate constraint "inscripciones_materia_id_fkey";

alter table "public"."literatura_referencias" add constraint "literatura_referencias_doi_key" UNIQUE using index "literatura_referencias_doi_key";

alter table "public"."literatura_referencias" add constraint "literatura_referencias_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public.perfiles(id) not valid;

alter table "public"."literatura_referencias" validate constraint "literatura_referencias_usuario_id_fkey";

alter table "public"."materiales_boveda" add constraint "materiales_boveda_materia_id_fkey" FOREIGN KEY (materia_id) REFERENCES public.materias(id) ON DELETE CASCADE not valid;

alter table "public"."materiales_boveda" validate constraint "materiales_boveda_materia_id_fkey";

alter table "public"."materiales_boveda" add constraint "materiales_boveda_unit_id_fkey" FOREIGN KEY (unit_id) REFERENCES public.course_units(id) ON DELETE CASCADE not valid;

alter table "public"."materiales_boveda" validate constraint "materiales_boveda_unit_id_fkey";

alter table "public"."materias" add constraint "materias_docente_id_fkey" FOREIGN KEY (docente_id) REFERENCES public.perfiles(id) ON DELETE CASCADE not valid;

alter table "public"."materias" validate constraint "materias_docente_id_fkey";

alter table "public"."materias_avisos" add constraint "materias_avisos_autor_id_fkey" FOREIGN KEY (autor_id) REFERENCES public.perfiles(id) ON DELETE CASCADE not valid;

alter table "public"."materias_avisos" validate constraint "materias_avisos_autor_id_fkey";

alter table "public"."materias_avisos" add constraint "materias_avisos_materia_id_fkey" FOREIGN KEY (materia_id) REFERENCES public.materias(id) ON DELETE CASCADE not valid;

alter table "public"."materias_avisos" validate constraint "materias_avisos_materia_id_fkey";

alter table "public"."perfiles" add constraint "perfiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."perfiles" validate constraint "perfiles_id_fkey";

alter table "public"."perfiles" add constraint "perfiles_matricula_rfc_key" UNIQUE using index "perfiles_matricula_rfc_key";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."proyectos_investigacion" add constraint "proyectos_investigacion_estado_check" CHECK ((estado = ANY (ARRAY['Propuesta'::text, 'En Ejecución'::text, 'Finalizado'::text, 'Suspendido'::text]))) not valid;

alter table "public"."proyectos_investigacion" validate constraint "proyectos_investigacion_estado_check";

alter table "public"."proyectos_investigacion" add constraint "proyectos_investigacion_investigador_principal_id_fkey" FOREIGN KEY (investigador_principal_id) REFERENCES public.perfiles(id) ON DELETE CASCADE not valid;

alter table "public"."proyectos_investigacion" validate constraint "proyectos_investigacion_investigador_principal_id_fkey";

alter table "public"."questions" add constraint "questions_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE not valid;

alter table "public"."questions" validate constraint "questions_exam_id_fkey";

alter table "public"."sesiones_insitu" add constraint "sesiones_insitu_materia_id_fkey" FOREIGN KEY (materia_id) REFERENCES public.materias(id) ON DELETE CASCADE not valid;

alter table "public"."sesiones_insitu" validate constraint "sesiones_insitu_materia_id_fkey";

alter table "public"."student_exams" add constraint "student_exams_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE not valid;

alter table "public"."student_exams" validate constraint "student_exams_exam_id_fkey";

alter table "public"."student_exams" add constraint "student_exams_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."student_exams" validate constraint "student_exams_student_id_fkey";

alter table "public"."students" add constraint "students_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE not valid;

alter table "public"."students" validate constraint "students_course_id_fkey";

alter table "public"."students" add constraint "students_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL not valid;

alter table "public"."students" validate constraint "students_team_id_fkey";

alter table "public"."submissions" add constraint "submissions_assignment_id_fkey" FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE not valid;

alter table "public"."submissions" validate constraint "submissions_assignment_id_fkey";

alter table "public"."submissions" add constraint "submissions_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'late'::text, 'graded'::text]))) not valid;

alter table "public"."submissions" validate constraint "submissions_status_check";

alter table "public"."submissions" add constraint "submissions_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE not valid;

alter table "public"."submissions" validate constraint "submissions_student_id_fkey";

alter table "public"."submissions" add constraint "submissions_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.assignment_teams(id) ON DELETE CASCADE not valid;

alter table "public"."submissions" validate constraint "submissions_team_id_fkey";

alter table "public"."tareas_usuario" add constraint "tareas_usuario_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES public.perfiles(id) ON DELETE CASCADE not valid;

alter table "public"."tareas_usuario" validate constraint "tareas_usuario_usuario_id_fkey";

alter table "public"."teams" add constraint "teams_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE not valid;

alter table "public"."teams" validate constraint "teams_course_id_fkey";

alter table "public"."telemetria_iot" add constraint "telemetria_iot_equipo_id_fkey" FOREIGN KEY (equipo_id) REFERENCES public.equipos_lab(id) ON DELETE CASCADE not valid;

alter table "public"."telemetria_iot" validate constraint "telemetria_iot_equipo_id_fkey";

alter table "public"."tesistas" add constraint "tesistas_alumno_id_fkey" FOREIGN KEY (alumno_id) REFERENCES public.perfiles(id) not valid;

alter table "public"."tesistas" validate constraint "tesistas_alumno_id_fkey";

alter table "public"."tesistas" add constraint "tesistas_director_id_fkey" FOREIGN KEY (director_id) REFERENCES public.perfiles(id) not valid;

alter table "public"."tesistas" validate constraint "tesistas_director_id_fkey";

alter table "public"."tesistas" add constraint "tesistas_progreso_check" CHECK (((progreso >= 0) AND (progreso <= 100))) not valid;

alter table "public"."tesistas" validate constraint "tesistas_progreso_check";

grant delete on table "public"."activities" to "anon";

grant insert on table "public"."activities" to "anon";

grant references on table "public"."activities" to "anon";

grant select on table "public"."activities" to "anon";

grant trigger on table "public"."activities" to "anon";

grant truncate on table "public"."activities" to "anon";

grant update on table "public"."activities" to "anon";

grant delete on table "public"."activities" to "authenticated";

grant insert on table "public"."activities" to "authenticated";

grant references on table "public"."activities" to "authenticated";

grant select on table "public"."activities" to "authenticated";

grant trigger on table "public"."activities" to "authenticated";

grant truncate on table "public"."activities" to "authenticated";

grant update on table "public"."activities" to "authenticated";

grant delete on table "public"."activities" to "service_role";

grant insert on table "public"."activities" to "service_role";

grant references on table "public"."activities" to "service_role";

grant select on table "public"."activities" to "service_role";

grant trigger on table "public"."activities" to "service_role";

grant truncate on table "public"."activities" to "service_role";

grant update on table "public"."activities" to "service_role";

grant delete on table "public"."anuncios" to "anon";

grant insert on table "public"."anuncios" to "anon";

grant references on table "public"."anuncios" to "anon";

grant select on table "public"."anuncios" to "anon";

grant trigger on table "public"."anuncios" to "anon";

grant truncate on table "public"."anuncios" to "anon";

grant update on table "public"."anuncios" to "anon";

grant delete on table "public"."anuncios" to "authenticated";

grant insert on table "public"."anuncios" to "authenticated";

grant references on table "public"."anuncios" to "authenticated";

grant select on table "public"."anuncios" to "authenticated";

grant trigger on table "public"."anuncios" to "authenticated";

grant truncate on table "public"."anuncios" to "authenticated";

grant update on table "public"."anuncios" to "authenticated";

grant delete on table "public"."anuncios" to "service_role";

grant insert on table "public"."anuncios" to "service_role";

grant references on table "public"."anuncios" to "service_role";

grant select on table "public"."anuncios" to "service_role";

grant trigger on table "public"."anuncios" to "service_role";

grant truncate on table "public"."anuncios" to "service_role";

grant update on table "public"."anuncios" to "service_role";

grant delete on table "public"."asistencias_validadas" to "anon";

grant insert on table "public"."asistencias_validadas" to "anon";

grant references on table "public"."asistencias_validadas" to "anon";

grant select on table "public"."asistencias_validadas" to "anon";

grant trigger on table "public"."asistencias_validadas" to "anon";

grant truncate on table "public"."asistencias_validadas" to "anon";

grant update on table "public"."asistencias_validadas" to "anon";

grant delete on table "public"."asistencias_validadas" to "authenticated";

grant insert on table "public"."asistencias_validadas" to "authenticated";

grant references on table "public"."asistencias_validadas" to "authenticated";

grant select on table "public"."asistencias_validadas" to "authenticated";

grant trigger on table "public"."asistencias_validadas" to "authenticated";

grant truncate on table "public"."asistencias_validadas" to "authenticated";

grant update on table "public"."asistencias_validadas" to "authenticated";

grant delete on table "public"."asistencias_validadas" to "service_role";

grant insert on table "public"."asistencias_validadas" to "service_role";

grant references on table "public"."asistencias_validadas" to "service_role";

grant select on table "public"."asistencias_validadas" to "service_role";

grant trigger on table "public"."asistencias_validadas" to "service_role";

grant truncate on table "public"."asistencias_validadas" to "service_role";

grant update on table "public"."asistencias_validadas" to "service_role";

grant delete on table "public"."assignment_bank" to "anon";

grant insert on table "public"."assignment_bank" to "anon";

grant references on table "public"."assignment_bank" to "anon";

grant select on table "public"."assignment_bank" to "anon";

grant trigger on table "public"."assignment_bank" to "anon";

grant truncate on table "public"."assignment_bank" to "anon";

grant update on table "public"."assignment_bank" to "anon";

grant delete on table "public"."assignment_bank" to "authenticated";

grant insert on table "public"."assignment_bank" to "authenticated";

grant references on table "public"."assignment_bank" to "authenticated";

grant select on table "public"."assignment_bank" to "authenticated";

grant trigger on table "public"."assignment_bank" to "authenticated";

grant truncate on table "public"."assignment_bank" to "authenticated";

grant update on table "public"."assignment_bank" to "authenticated";

grant delete on table "public"."assignment_bank" to "service_role";

grant insert on table "public"."assignment_bank" to "service_role";

grant references on table "public"."assignment_bank" to "service_role";

grant select on table "public"."assignment_bank" to "service_role";

grant trigger on table "public"."assignment_bank" to "service_role";

grant truncate on table "public"."assignment_bank" to "service_role";

grant update on table "public"."assignment_bank" to "service_role";

grant delete on table "public"."assignment_team_members" to "anon";

grant insert on table "public"."assignment_team_members" to "anon";

grant references on table "public"."assignment_team_members" to "anon";

grant select on table "public"."assignment_team_members" to "anon";

grant trigger on table "public"."assignment_team_members" to "anon";

grant truncate on table "public"."assignment_team_members" to "anon";

grant update on table "public"."assignment_team_members" to "anon";

grant delete on table "public"."assignment_team_members" to "authenticated";

grant insert on table "public"."assignment_team_members" to "authenticated";

grant references on table "public"."assignment_team_members" to "authenticated";

grant select on table "public"."assignment_team_members" to "authenticated";

grant trigger on table "public"."assignment_team_members" to "authenticated";

grant truncate on table "public"."assignment_team_members" to "authenticated";

grant update on table "public"."assignment_team_members" to "authenticated";

grant delete on table "public"."assignment_team_members" to "service_role";

grant insert on table "public"."assignment_team_members" to "service_role";

grant references on table "public"."assignment_team_members" to "service_role";

grant select on table "public"."assignment_team_members" to "service_role";

grant trigger on table "public"."assignment_team_members" to "service_role";

grant truncate on table "public"."assignment_team_members" to "service_role";

grant update on table "public"."assignment_team_members" to "service_role";

grant delete on table "public"."assignment_teams" to "anon";

grant insert on table "public"."assignment_teams" to "anon";

grant references on table "public"."assignment_teams" to "anon";

grant select on table "public"."assignment_teams" to "anon";

grant trigger on table "public"."assignment_teams" to "anon";

grant truncate on table "public"."assignment_teams" to "anon";

grant update on table "public"."assignment_teams" to "anon";

grant delete on table "public"."assignment_teams" to "authenticated";

grant insert on table "public"."assignment_teams" to "authenticated";

grant references on table "public"."assignment_teams" to "authenticated";

grant select on table "public"."assignment_teams" to "authenticated";

grant trigger on table "public"."assignment_teams" to "authenticated";

grant truncate on table "public"."assignment_teams" to "authenticated";

grant update on table "public"."assignment_teams" to "authenticated";

grant delete on table "public"."assignment_teams" to "service_role";

grant insert on table "public"."assignment_teams" to "service_role";

grant references on table "public"."assignment_teams" to "service_role";

grant select on table "public"."assignment_teams" to "service_role";

grant trigger on table "public"."assignment_teams" to "service_role";

grant truncate on table "public"."assignment_teams" to "service_role";

grant update on table "public"."assignment_teams" to "service_role";

grant delete on table "public"."assignments" to "anon";

grant insert on table "public"."assignments" to "anon";

grant references on table "public"."assignments" to "anon";

grant select on table "public"."assignments" to "anon";

grant trigger on table "public"."assignments" to "anon";

grant truncate on table "public"."assignments" to "anon";

grant update on table "public"."assignments" to "anon";

grant delete on table "public"."assignments" to "authenticated";

grant insert on table "public"."assignments" to "authenticated";

grant references on table "public"."assignments" to "authenticated";

grant select on table "public"."assignments" to "authenticated";

grant trigger on table "public"."assignments" to "authenticated";

grant truncate on table "public"."assignments" to "authenticated";

grant update on table "public"."assignments" to "authenticated";

grant delete on table "public"."assignments" to "service_role";

grant insert on table "public"."assignments" to "service_role";

grant references on table "public"."assignments" to "service_role";

grant select on table "public"."assignments" to "service_role";

grant trigger on table "public"."assignments" to "service_role";

grant truncate on table "public"."assignments" to "service_role";

grant update on table "public"."assignments" to "service_role";

grant delete on table "public"."attendance" to "anon";

grant insert on table "public"."attendance" to "anon";

grant references on table "public"."attendance" to "anon";

grant select on table "public"."attendance" to "anon";

grant trigger on table "public"."attendance" to "anon";

grant truncate on table "public"."attendance" to "anon";

grant update on table "public"."attendance" to "anon";

grant delete on table "public"."attendance" to "authenticated";

grant insert on table "public"."attendance" to "authenticated";

grant references on table "public"."attendance" to "authenticated";

grant select on table "public"."attendance" to "authenticated";

grant trigger on table "public"."attendance" to "authenticated";

grant truncate on table "public"."attendance" to "authenticated";

grant update on table "public"."attendance" to "authenticated";

grant delete on table "public"."attendance" to "service_role";

grant insert on table "public"."attendance" to "service_role";

grant references on table "public"."attendance" to "service_role";

grant select on table "public"."attendance" to "service_role";

grant trigger on table "public"."attendance" to "service_role";

grant truncate on table "public"."attendance" to "service_role";

grant update on table "public"."attendance" to "service_role";

grant delete on table "public"."bitacora_eln" to "anon";

grant insert on table "public"."bitacora_eln" to "anon";

grant references on table "public"."bitacora_eln" to "anon";

grant select on table "public"."bitacora_eln" to "anon";

grant trigger on table "public"."bitacora_eln" to "anon";

grant truncate on table "public"."bitacora_eln" to "anon";

grant update on table "public"."bitacora_eln" to "anon";

grant delete on table "public"."bitacora_eln" to "authenticated";

grant insert on table "public"."bitacora_eln" to "authenticated";

grant references on table "public"."bitacora_eln" to "authenticated";

grant select on table "public"."bitacora_eln" to "authenticated";

grant trigger on table "public"."bitacora_eln" to "authenticated";

grant truncate on table "public"."bitacora_eln" to "authenticated";

grant update on table "public"."bitacora_eln" to "authenticated";

grant delete on table "public"."bitacora_eln" to "service_role";

grant insert on table "public"."bitacora_eln" to "service_role";

grant references on table "public"."bitacora_eln" to "service_role";

grant select on table "public"."bitacora_eln" to "service_role";

grant trigger on table "public"."bitacora_eln" to "service_role";

grant truncate on table "public"."bitacora_eln" to "service_role";

grant update on table "public"."bitacora_eln" to "service_role";

grant delete on table "public"."canvas_documentos" to "anon";

grant insert on table "public"."canvas_documentos" to "anon";

grant references on table "public"."canvas_documentos" to "anon";

grant select on table "public"."canvas_documentos" to "anon";

grant trigger on table "public"."canvas_documentos" to "anon";

grant truncate on table "public"."canvas_documentos" to "anon";

grant update on table "public"."canvas_documentos" to "anon";

grant delete on table "public"."canvas_documentos" to "authenticated";

grant insert on table "public"."canvas_documentos" to "authenticated";

grant references on table "public"."canvas_documentos" to "authenticated";

grant select on table "public"."canvas_documentos" to "authenticated";

grant trigger on table "public"."canvas_documentos" to "authenticated";

grant truncate on table "public"."canvas_documentos" to "authenticated";

grant update on table "public"."canvas_documentos" to "authenticated";

grant delete on table "public"."canvas_documentos" to "service_role";

grant insert on table "public"."canvas_documentos" to "service_role";

grant references on table "public"."canvas_documentos" to "service_role";

grant select on table "public"."canvas_documentos" to "service_role";

grant trigger on table "public"."canvas_documentos" to "service_role";

grant truncate on table "public"."canvas_documentos" to "service_role";

grant update on table "public"."canvas_documentos" to "service_role";

grant delete on table "public"."citas_asesoria" to "anon";

grant insert on table "public"."citas_asesoria" to "anon";

grant references on table "public"."citas_asesoria" to "anon";

grant select on table "public"."citas_asesoria" to "anon";

grant trigger on table "public"."citas_asesoria" to "anon";

grant truncate on table "public"."citas_asesoria" to "anon";

grant update on table "public"."citas_asesoria" to "anon";

grant delete on table "public"."citas_asesoria" to "authenticated";

grant insert on table "public"."citas_asesoria" to "authenticated";

grant references on table "public"."citas_asesoria" to "authenticated";

grant select on table "public"."citas_asesoria" to "authenticated";

grant trigger on table "public"."citas_asesoria" to "authenticated";

grant truncate on table "public"."citas_asesoria" to "authenticated";

grant update on table "public"."citas_asesoria" to "authenticated";

grant delete on table "public"."citas_asesoria" to "service_role";

grant insert on table "public"."citas_asesoria" to "service_role";

grant references on table "public"."citas_asesoria" to "service_role";

grant select on table "public"."citas_asesoria" to "service_role";

grant trigger on table "public"."citas_asesoria" to "service_role";

grant truncate on table "public"."citas_asesoria" to "service_role";

grant update on table "public"."citas_asesoria" to "service_role";

grant delete on table "public"."course_units" to "anon";

grant insert on table "public"."course_units" to "anon";

grant references on table "public"."course_units" to "anon";

grant select on table "public"."course_units" to "anon";

grant trigger on table "public"."course_units" to "anon";

grant truncate on table "public"."course_units" to "anon";

grant update on table "public"."course_units" to "anon";

grant delete on table "public"."course_units" to "authenticated";

grant insert on table "public"."course_units" to "authenticated";

grant references on table "public"."course_units" to "authenticated";

grant select on table "public"."course_units" to "authenticated";

grant trigger on table "public"."course_units" to "authenticated";

grant truncate on table "public"."course_units" to "authenticated";

grant update on table "public"."course_units" to "authenticated";

grant delete on table "public"."course_units" to "service_role";

grant insert on table "public"."course_units" to "service_role";

grant references on table "public"."course_units" to "service_role";

grant select on table "public"."course_units" to "service_role";

grant trigger on table "public"."course_units" to "service_role";

grant truncate on table "public"."course_units" to "service_role";

grant update on table "public"."course_units" to "service_role";

grant delete on table "public"."courses" to "anon";

grant insert on table "public"."courses" to "anon";

grant references on table "public"."courses" to "anon";

grant select on table "public"."courses" to "anon";

grant trigger on table "public"."courses" to "anon";

grant truncate on table "public"."courses" to "anon";

grant update on table "public"."courses" to "anon";

grant delete on table "public"."courses" to "authenticated";

grant insert on table "public"."courses" to "authenticated";

grant references on table "public"."courses" to "authenticated";

grant select on table "public"."courses" to "authenticated";

grant trigger on table "public"."courses" to "authenticated";

grant truncate on table "public"."courses" to "authenticated";

grant update on table "public"."courses" to "authenticated";

grant delete on table "public"."courses" to "service_role";

grant insert on table "public"."courses" to "service_role";

grant references on table "public"."courses" to "service_role";

grant select on table "public"."courses" to "service_role";

grant trigger on table "public"."courses" to "service_role";

grant truncate on table "public"."courses" to "service_role";

grant update on table "public"."courses" to "service_role";

grant delete on table "public"."enrollments" to "anon";

grant insert on table "public"."enrollments" to "anon";

grant references on table "public"."enrollments" to "anon";

grant select on table "public"."enrollments" to "anon";

grant trigger on table "public"."enrollments" to "anon";

grant truncate on table "public"."enrollments" to "anon";

grant update on table "public"."enrollments" to "anon";

grant delete on table "public"."enrollments" to "authenticated";

grant insert on table "public"."enrollments" to "authenticated";

grant references on table "public"."enrollments" to "authenticated";

grant select on table "public"."enrollments" to "authenticated";

grant trigger on table "public"."enrollments" to "authenticated";

grant truncate on table "public"."enrollments" to "authenticated";

grant update on table "public"."enrollments" to "authenticated";

grant delete on table "public"."enrollments" to "service_role";

grant insert on table "public"."enrollments" to "service_role";

grant references on table "public"."enrollments" to "service_role";

grant select on table "public"."enrollments" to "service_role";

grant trigger on table "public"."enrollments" to "service_role";

grant truncate on table "public"."enrollments" to "service_role";

grant update on table "public"."enrollments" to "service_role";

grant delete on table "public"."entregas" to "anon";

grant insert on table "public"."entregas" to "anon";

grant references on table "public"."entregas" to "anon";

grant select on table "public"."entregas" to "anon";

grant trigger on table "public"."entregas" to "anon";

grant truncate on table "public"."entregas" to "anon";

grant update on table "public"."entregas" to "anon";

grant delete on table "public"."entregas" to "authenticated";

grant insert on table "public"."entregas" to "authenticated";

grant references on table "public"."entregas" to "authenticated";

grant select on table "public"."entregas" to "authenticated";

grant trigger on table "public"."entregas" to "authenticated";

grant truncate on table "public"."entregas" to "authenticated";

grant update on table "public"."entregas" to "authenticated";

grant delete on table "public"."entregas" to "service_role";

grant insert on table "public"."entregas" to "service_role";

grant references on table "public"."entregas" to "service_role";

grant select on table "public"."entregas" to "service_role";

grant trigger on table "public"."entregas" to "service_role";

grant truncate on table "public"."entregas" to "service_role";

grant update on table "public"."entregas" to "service_role";

grant delete on table "public"."equipos_lab" to "anon";

grant insert on table "public"."equipos_lab" to "anon";

grant references on table "public"."equipos_lab" to "anon";

grant select on table "public"."equipos_lab" to "anon";

grant trigger on table "public"."equipos_lab" to "anon";

grant truncate on table "public"."equipos_lab" to "anon";

grant update on table "public"."equipos_lab" to "anon";

grant delete on table "public"."equipos_lab" to "authenticated";

grant insert on table "public"."equipos_lab" to "authenticated";

grant references on table "public"."equipos_lab" to "authenticated";

grant select on table "public"."equipos_lab" to "authenticated";

grant trigger on table "public"."equipos_lab" to "authenticated";

grant truncate on table "public"."equipos_lab" to "authenticated";

grant update on table "public"."equipos_lab" to "authenticated";

grant delete on table "public"."equipos_lab" to "service_role";

grant insert on table "public"."equipos_lab" to "service_role";

grant references on table "public"."equipos_lab" to "service_role";

grant select on table "public"."equipos_lab" to "service_role";

grant trigger on table "public"."equipos_lab" to "service_role";

grant truncate on table "public"."equipos_lab" to "service_role";

grant update on table "public"."equipos_lab" to "service_role";

grant delete on table "public"."evaluations" to "anon";

grant insert on table "public"."evaluations" to "anon";

grant references on table "public"."evaluations" to "anon";

grant select on table "public"."evaluations" to "anon";

grant trigger on table "public"."evaluations" to "anon";

grant truncate on table "public"."evaluations" to "anon";

grant update on table "public"."evaluations" to "anon";

grant delete on table "public"."evaluations" to "authenticated";

grant insert on table "public"."evaluations" to "authenticated";

grant references on table "public"."evaluations" to "authenticated";

grant select on table "public"."evaluations" to "authenticated";

grant trigger on table "public"."evaluations" to "authenticated";

grant truncate on table "public"."evaluations" to "authenticated";

grant update on table "public"."evaluations" to "authenticated";

grant delete on table "public"."evaluations" to "service_role";

grant insert on table "public"."evaluations" to "service_role";

grant references on table "public"."evaluations" to "service_role";

grant select on table "public"."evaluations" to "service_role";

grant trigger on table "public"."evaluations" to "service_role";

grant truncate on table "public"."evaluations" to "service_role";

grant update on table "public"."evaluations" to "service_role";

grant delete on table "public"."exams" to "anon";

grant insert on table "public"."exams" to "anon";

grant references on table "public"."exams" to "anon";

grant select on table "public"."exams" to "anon";

grant trigger on table "public"."exams" to "anon";

grant truncate on table "public"."exams" to "anon";

grant update on table "public"."exams" to "anon";

grant delete on table "public"."exams" to "authenticated";

grant insert on table "public"."exams" to "authenticated";

grant references on table "public"."exams" to "authenticated";

grant select on table "public"."exams" to "authenticated";

grant trigger on table "public"."exams" to "authenticated";

grant truncate on table "public"."exams" to "authenticated";

grant update on table "public"."exams" to "authenticated";

grant delete on table "public"."exams" to "service_role";

grant insert on table "public"."exams" to "service_role";

grant references on table "public"."exams" to "service_role";

grant select on table "public"."exams" to "service_role";

grant trigger on table "public"."exams" to "service_role";

grant truncate on table "public"."exams" to "service_role";

grant update on table "public"."exams" to "service_role";

grant delete on table "public"."fondos_investigacion" to "anon";

grant insert on table "public"."fondos_investigacion" to "anon";

grant references on table "public"."fondos_investigacion" to "anon";

grant select on table "public"."fondos_investigacion" to "anon";

grant trigger on table "public"."fondos_investigacion" to "anon";

grant truncate on table "public"."fondos_investigacion" to "anon";

grant update on table "public"."fondos_investigacion" to "anon";

grant delete on table "public"."fondos_investigacion" to "authenticated";

grant insert on table "public"."fondos_investigacion" to "authenticated";

grant references on table "public"."fondos_investigacion" to "authenticated";

grant select on table "public"."fondos_investigacion" to "authenticated";

grant trigger on table "public"."fondos_investigacion" to "authenticated";

grant truncate on table "public"."fondos_investigacion" to "authenticated";

grant update on table "public"."fondos_investigacion" to "authenticated";

grant delete on table "public"."fondos_investigacion" to "service_role";

grant insert on table "public"."fondos_investigacion" to "service_role";

grant references on table "public"."fondos_investigacion" to "service_role";

grant select on table "public"."fondos_investigacion" to "service_role";

grant trigger on table "public"."fondos_investigacion" to "service_role";

grant truncate on table "public"."fondos_investigacion" to "service_role";

grant update on table "public"."fondos_investigacion" to "service_role";

grant delete on table "public"."geocercas_materia" to "anon";

grant insert on table "public"."geocercas_materia" to "anon";

grant references on table "public"."geocercas_materia" to "anon";

grant select on table "public"."geocercas_materia" to "anon";

grant trigger on table "public"."geocercas_materia" to "anon";

grant truncate on table "public"."geocercas_materia" to "anon";

grant update on table "public"."geocercas_materia" to "anon";

grant delete on table "public"."geocercas_materia" to "authenticated";

grant insert on table "public"."geocercas_materia" to "authenticated";

grant references on table "public"."geocercas_materia" to "authenticated";

grant select on table "public"."geocercas_materia" to "authenticated";

grant trigger on table "public"."geocercas_materia" to "authenticated";

grant truncate on table "public"."geocercas_materia" to "authenticated";

grant update on table "public"."geocercas_materia" to "authenticated";

grant delete on table "public"."geocercas_materia" to "service_role";

grant insert on table "public"."geocercas_materia" to "service_role";

grant references on table "public"."geocercas_materia" to "service_role";

grant select on table "public"."geocercas_materia" to "service_role";

grant trigger on table "public"."geocercas_materia" to "service_role";

grant truncate on table "public"."geocercas_materia" to "service_role";

grant update on table "public"."geocercas_materia" to "service_role";

grant delete on table "public"."grades" to "anon";

grant insert on table "public"."grades" to "anon";

grant references on table "public"."grades" to "anon";

grant select on table "public"."grades" to "anon";

grant trigger on table "public"."grades" to "anon";

grant truncate on table "public"."grades" to "anon";

grant update on table "public"."grades" to "anon";

grant delete on table "public"."grades" to "authenticated";

grant insert on table "public"."grades" to "authenticated";

grant references on table "public"."grades" to "authenticated";

grant select on table "public"."grades" to "authenticated";

grant trigger on table "public"."grades" to "authenticated";

grant truncate on table "public"."grades" to "authenticated";

grant update on table "public"."grades" to "authenticated";

grant delete on table "public"."grades" to "service_role";

grant insert on table "public"."grades" to "service_role";

grant references on table "public"."grades" to "service_role";

grant select on table "public"."grades" to "service_role";

grant trigger on table "public"."grades" to "service_role";

grant truncate on table "public"."grades" to "service_role";

grant update on table "public"."grades" to "service_role";

grant delete on table "public"."horarios_docente" to "anon";

grant insert on table "public"."horarios_docente" to "anon";

grant references on table "public"."horarios_docente" to "anon";

grant select on table "public"."horarios_docente" to "anon";

grant trigger on table "public"."horarios_docente" to "anon";

grant truncate on table "public"."horarios_docente" to "anon";

grant update on table "public"."horarios_docente" to "anon";

grant delete on table "public"."horarios_docente" to "authenticated";

grant insert on table "public"."horarios_docente" to "authenticated";

grant references on table "public"."horarios_docente" to "authenticated";

grant select on table "public"."horarios_docente" to "authenticated";

grant trigger on table "public"."horarios_docente" to "authenticated";

grant truncate on table "public"."horarios_docente" to "authenticated";

grant update on table "public"."horarios_docente" to "authenticated";

grant delete on table "public"."horarios_docente" to "service_role";

grant insert on table "public"."horarios_docente" to "service_role";

grant references on table "public"."horarios_docente" to "service_role";

grant select on table "public"."horarios_docente" to "service_role";

grant trigger on table "public"."horarios_docente" to "service_role";

grant truncate on table "public"."horarios_docente" to "service_role";

grant update on table "public"."horarios_docente" to "service_role";

grant delete on table "public"."inscripciones" to "anon";

grant insert on table "public"."inscripciones" to "anon";

grant references on table "public"."inscripciones" to "anon";

grant select on table "public"."inscripciones" to "anon";

grant trigger on table "public"."inscripciones" to "anon";

grant truncate on table "public"."inscripciones" to "anon";

grant update on table "public"."inscripciones" to "anon";

grant delete on table "public"."inscripciones" to "authenticated";

grant insert on table "public"."inscripciones" to "authenticated";

grant references on table "public"."inscripciones" to "authenticated";

grant select on table "public"."inscripciones" to "authenticated";

grant trigger on table "public"."inscripciones" to "authenticated";

grant truncate on table "public"."inscripciones" to "authenticated";

grant update on table "public"."inscripciones" to "authenticated";

grant delete on table "public"."inscripciones" to "service_role";

grant insert on table "public"."inscripciones" to "service_role";

grant references on table "public"."inscripciones" to "service_role";

grant select on table "public"."inscripciones" to "service_role";

grant trigger on table "public"."inscripciones" to "service_role";

grant truncate on table "public"."inscripciones" to "service_role";

grant update on table "public"."inscripciones" to "service_role";

grant delete on table "public"."literatura_referencias" to "anon";

grant insert on table "public"."literatura_referencias" to "anon";

grant references on table "public"."literatura_referencias" to "anon";

grant select on table "public"."literatura_referencias" to "anon";

grant trigger on table "public"."literatura_referencias" to "anon";

grant truncate on table "public"."literatura_referencias" to "anon";

grant update on table "public"."literatura_referencias" to "anon";

grant delete on table "public"."literatura_referencias" to "authenticated";

grant insert on table "public"."literatura_referencias" to "authenticated";

grant references on table "public"."literatura_referencias" to "authenticated";

grant select on table "public"."literatura_referencias" to "authenticated";

grant trigger on table "public"."literatura_referencias" to "authenticated";

grant truncate on table "public"."literatura_referencias" to "authenticated";

grant update on table "public"."literatura_referencias" to "authenticated";

grant delete on table "public"."literatura_referencias" to "service_role";

grant insert on table "public"."literatura_referencias" to "service_role";

grant references on table "public"."literatura_referencias" to "service_role";

grant select on table "public"."literatura_referencias" to "service_role";

grant trigger on table "public"."literatura_referencias" to "service_role";

grant truncate on table "public"."literatura_referencias" to "service_role";

grant update on table "public"."literatura_referencias" to "service_role";

grant delete on table "public"."materiales_boveda" to "anon";

grant insert on table "public"."materiales_boveda" to "anon";

grant references on table "public"."materiales_boveda" to "anon";

grant select on table "public"."materiales_boveda" to "anon";

grant trigger on table "public"."materiales_boveda" to "anon";

grant truncate on table "public"."materiales_boveda" to "anon";

grant update on table "public"."materiales_boveda" to "anon";

grant delete on table "public"."materiales_boveda" to "authenticated";

grant insert on table "public"."materiales_boveda" to "authenticated";

grant references on table "public"."materiales_boveda" to "authenticated";

grant select on table "public"."materiales_boveda" to "authenticated";

grant trigger on table "public"."materiales_boveda" to "authenticated";

grant truncate on table "public"."materiales_boveda" to "authenticated";

grant update on table "public"."materiales_boveda" to "authenticated";

grant delete on table "public"."materiales_boveda" to "service_role";

grant insert on table "public"."materiales_boveda" to "service_role";

grant references on table "public"."materiales_boveda" to "service_role";

grant select on table "public"."materiales_boveda" to "service_role";

grant trigger on table "public"."materiales_boveda" to "service_role";

grant truncate on table "public"."materiales_boveda" to "service_role";

grant update on table "public"."materiales_boveda" to "service_role";

grant delete on table "public"."materias" to "anon";

grant insert on table "public"."materias" to "anon";

grant references on table "public"."materias" to "anon";

grant select on table "public"."materias" to "anon";

grant trigger on table "public"."materias" to "anon";

grant truncate on table "public"."materias" to "anon";

grant update on table "public"."materias" to "anon";

grant delete on table "public"."materias" to "authenticated";

grant insert on table "public"."materias" to "authenticated";

grant references on table "public"."materias" to "authenticated";

grant select on table "public"."materias" to "authenticated";

grant trigger on table "public"."materias" to "authenticated";

grant truncate on table "public"."materias" to "authenticated";

grant update on table "public"."materias" to "authenticated";

grant delete on table "public"."materias" to "service_role";

grant insert on table "public"."materias" to "service_role";

grant references on table "public"."materias" to "service_role";

grant select on table "public"."materias" to "service_role";

grant trigger on table "public"."materias" to "service_role";

grant truncate on table "public"."materias" to "service_role";

grant update on table "public"."materias" to "service_role";

grant delete on table "public"."materias_avisos" to "anon";

grant insert on table "public"."materias_avisos" to "anon";

grant references on table "public"."materias_avisos" to "anon";

grant select on table "public"."materias_avisos" to "anon";

grant trigger on table "public"."materias_avisos" to "anon";

grant truncate on table "public"."materias_avisos" to "anon";

grant update on table "public"."materias_avisos" to "anon";

grant delete on table "public"."materias_avisos" to "authenticated";

grant insert on table "public"."materias_avisos" to "authenticated";

grant references on table "public"."materias_avisos" to "authenticated";

grant select on table "public"."materias_avisos" to "authenticated";

grant trigger on table "public"."materias_avisos" to "authenticated";

grant truncate on table "public"."materias_avisos" to "authenticated";

grant update on table "public"."materias_avisos" to "authenticated";

grant delete on table "public"."materias_avisos" to "service_role";

grant insert on table "public"."materias_avisos" to "service_role";

grant references on table "public"."materias_avisos" to "service_role";

grant select on table "public"."materias_avisos" to "service_role";

grant trigger on table "public"."materias_avisos" to "service_role";

grant truncate on table "public"."materias_avisos" to "service_role";

grant update on table "public"."materias_avisos" to "service_role";

grant delete on table "public"."perfiles" to "anon";

grant insert on table "public"."perfiles" to "anon";

grant references on table "public"."perfiles" to "anon";

grant select on table "public"."perfiles" to "anon";

grant trigger on table "public"."perfiles" to "anon";

grant truncate on table "public"."perfiles" to "anon";

grant update on table "public"."perfiles" to "anon";

grant delete on table "public"."perfiles" to "authenticated";

grant insert on table "public"."perfiles" to "authenticated";

grant references on table "public"."perfiles" to "authenticated";

grant select on table "public"."perfiles" to "authenticated";

grant trigger on table "public"."perfiles" to "authenticated";

grant truncate on table "public"."perfiles" to "authenticated";

grant update on table "public"."perfiles" to "authenticated";

grant delete on table "public"."perfiles" to "service_role";

grant insert on table "public"."perfiles" to "service_role";

grant references on table "public"."perfiles" to "service_role";

grant select on table "public"."perfiles" to "service_role";

grant trigger on table "public"."perfiles" to "service_role";

grant truncate on table "public"."perfiles" to "service_role";

grant update on table "public"."perfiles" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."proyectos_investigacion" to "anon";

grant insert on table "public"."proyectos_investigacion" to "anon";

grant references on table "public"."proyectos_investigacion" to "anon";

grant select on table "public"."proyectos_investigacion" to "anon";

grant trigger on table "public"."proyectos_investigacion" to "anon";

grant truncate on table "public"."proyectos_investigacion" to "anon";

grant update on table "public"."proyectos_investigacion" to "anon";

grant delete on table "public"."proyectos_investigacion" to "authenticated";

grant insert on table "public"."proyectos_investigacion" to "authenticated";

grant references on table "public"."proyectos_investigacion" to "authenticated";

grant select on table "public"."proyectos_investigacion" to "authenticated";

grant trigger on table "public"."proyectos_investigacion" to "authenticated";

grant truncate on table "public"."proyectos_investigacion" to "authenticated";

grant update on table "public"."proyectos_investigacion" to "authenticated";

grant delete on table "public"."proyectos_investigacion" to "service_role";

grant insert on table "public"."proyectos_investigacion" to "service_role";

grant references on table "public"."proyectos_investigacion" to "service_role";

grant select on table "public"."proyectos_investigacion" to "service_role";

grant trigger on table "public"."proyectos_investigacion" to "service_role";

grant truncate on table "public"."proyectos_investigacion" to "service_role";

grant update on table "public"."proyectos_investigacion" to "service_role";

grant delete on table "public"."questions" to "anon";

grant insert on table "public"."questions" to "anon";

grant references on table "public"."questions" to "anon";

grant select on table "public"."questions" to "anon";

grant trigger on table "public"."questions" to "anon";

grant truncate on table "public"."questions" to "anon";

grant update on table "public"."questions" to "anon";

grant delete on table "public"."questions" to "authenticated";

grant insert on table "public"."questions" to "authenticated";

grant references on table "public"."questions" to "authenticated";

grant select on table "public"."questions" to "authenticated";

grant trigger on table "public"."questions" to "authenticated";

grant truncate on table "public"."questions" to "authenticated";

grant update on table "public"."questions" to "authenticated";

grant delete on table "public"."questions" to "service_role";

grant insert on table "public"."questions" to "service_role";

grant references on table "public"."questions" to "service_role";

grant select on table "public"."questions" to "service_role";

grant trigger on table "public"."questions" to "service_role";

grant truncate on table "public"."questions" to "service_role";

grant update on table "public"."questions" to "service_role";

grant delete on table "public"."quick_comments" to "anon";

grant insert on table "public"."quick_comments" to "anon";

grant references on table "public"."quick_comments" to "anon";

grant select on table "public"."quick_comments" to "anon";

grant trigger on table "public"."quick_comments" to "anon";

grant truncate on table "public"."quick_comments" to "anon";

grant update on table "public"."quick_comments" to "anon";

grant delete on table "public"."quick_comments" to "authenticated";

grant insert on table "public"."quick_comments" to "authenticated";

grant references on table "public"."quick_comments" to "authenticated";

grant select on table "public"."quick_comments" to "authenticated";

grant trigger on table "public"."quick_comments" to "authenticated";

grant truncate on table "public"."quick_comments" to "authenticated";

grant update on table "public"."quick_comments" to "authenticated";

grant delete on table "public"."quick_comments" to "service_role";

grant insert on table "public"."quick_comments" to "service_role";

grant references on table "public"."quick_comments" to "service_role";

grant select on table "public"."quick_comments" to "service_role";

grant trigger on table "public"."quick_comments" to "service_role";

grant truncate on table "public"."quick_comments" to "service_role";

grant update on table "public"."quick_comments" to "service_role";

grant delete on table "public"."sesiones_insitu" to "anon";

grant insert on table "public"."sesiones_insitu" to "anon";

grant references on table "public"."sesiones_insitu" to "anon";

grant select on table "public"."sesiones_insitu" to "anon";

grant trigger on table "public"."sesiones_insitu" to "anon";

grant truncate on table "public"."sesiones_insitu" to "anon";

grant update on table "public"."sesiones_insitu" to "anon";

grant delete on table "public"."sesiones_insitu" to "authenticated";

grant insert on table "public"."sesiones_insitu" to "authenticated";

grant references on table "public"."sesiones_insitu" to "authenticated";

grant select on table "public"."sesiones_insitu" to "authenticated";

grant trigger on table "public"."sesiones_insitu" to "authenticated";

grant truncate on table "public"."sesiones_insitu" to "authenticated";

grant update on table "public"."sesiones_insitu" to "authenticated";

grant delete on table "public"."sesiones_insitu" to "service_role";

grant insert on table "public"."sesiones_insitu" to "service_role";

grant references on table "public"."sesiones_insitu" to "service_role";

grant select on table "public"."sesiones_insitu" to "service_role";

grant trigger on table "public"."sesiones_insitu" to "service_role";

grant truncate on table "public"."sesiones_insitu" to "service_role";

grant update on table "public"."sesiones_insitu" to "service_role";

grant delete on table "public"."student_exams" to "anon";

grant insert on table "public"."student_exams" to "anon";

grant references on table "public"."student_exams" to "anon";

grant select on table "public"."student_exams" to "anon";

grant trigger on table "public"."student_exams" to "anon";

grant truncate on table "public"."student_exams" to "anon";

grant update on table "public"."student_exams" to "anon";

grant delete on table "public"."student_exams" to "authenticated";

grant insert on table "public"."student_exams" to "authenticated";

grant references on table "public"."student_exams" to "authenticated";

grant select on table "public"."student_exams" to "authenticated";

grant trigger on table "public"."student_exams" to "authenticated";

grant truncate on table "public"."student_exams" to "authenticated";

grant update on table "public"."student_exams" to "authenticated";

grant delete on table "public"."student_exams" to "service_role";

grant insert on table "public"."student_exams" to "service_role";

grant references on table "public"."student_exams" to "service_role";

grant select on table "public"."student_exams" to "service_role";

grant trigger on table "public"."student_exams" to "service_role";

grant truncate on table "public"."student_exams" to "service_role";

grant update on table "public"."student_exams" to "service_role";

grant delete on table "public"."students" to "anon";

grant insert on table "public"."students" to "anon";

grant references on table "public"."students" to "anon";

grant select on table "public"."students" to "anon";

grant trigger on table "public"."students" to "anon";

grant truncate on table "public"."students" to "anon";

grant update on table "public"."students" to "anon";

grant delete on table "public"."students" to "authenticated";

grant insert on table "public"."students" to "authenticated";

grant references on table "public"."students" to "authenticated";

grant select on table "public"."students" to "authenticated";

grant trigger on table "public"."students" to "authenticated";

grant truncate on table "public"."students" to "authenticated";

grant update on table "public"."students" to "authenticated";

grant delete on table "public"."students" to "service_role";

grant insert on table "public"."students" to "service_role";

grant references on table "public"."students" to "service_role";

grant select on table "public"."students" to "service_role";

grant trigger on table "public"."students" to "service_role";

grant truncate on table "public"."students" to "service_role";

grant update on table "public"."students" to "service_role";

grant delete on table "public"."submissions" to "anon";

grant insert on table "public"."submissions" to "anon";

grant references on table "public"."submissions" to "anon";

grant select on table "public"."submissions" to "anon";

grant trigger on table "public"."submissions" to "anon";

grant truncate on table "public"."submissions" to "anon";

grant update on table "public"."submissions" to "anon";

grant delete on table "public"."submissions" to "authenticated";

grant insert on table "public"."submissions" to "authenticated";

grant references on table "public"."submissions" to "authenticated";

grant select on table "public"."submissions" to "authenticated";

grant trigger on table "public"."submissions" to "authenticated";

grant truncate on table "public"."submissions" to "authenticated";

grant update on table "public"."submissions" to "authenticated";

grant delete on table "public"."submissions" to "service_role";

grant insert on table "public"."submissions" to "service_role";

grant references on table "public"."submissions" to "service_role";

grant select on table "public"."submissions" to "service_role";

grant trigger on table "public"."submissions" to "service_role";

grant truncate on table "public"."submissions" to "service_role";

grant update on table "public"."submissions" to "service_role";

grant delete on table "public"."tareas_usuario" to "anon";

grant insert on table "public"."tareas_usuario" to "anon";

grant references on table "public"."tareas_usuario" to "anon";

grant select on table "public"."tareas_usuario" to "anon";

grant trigger on table "public"."tareas_usuario" to "anon";

grant truncate on table "public"."tareas_usuario" to "anon";

grant update on table "public"."tareas_usuario" to "anon";

grant delete on table "public"."tareas_usuario" to "authenticated";

grant insert on table "public"."tareas_usuario" to "authenticated";

grant references on table "public"."tareas_usuario" to "authenticated";

grant select on table "public"."tareas_usuario" to "authenticated";

grant trigger on table "public"."tareas_usuario" to "authenticated";

grant truncate on table "public"."tareas_usuario" to "authenticated";

grant update on table "public"."tareas_usuario" to "authenticated";

grant delete on table "public"."tareas_usuario" to "service_role";

grant insert on table "public"."tareas_usuario" to "service_role";

grant references on table "public"."tareas_usuario" to "service_role";

grant select on table "public"."tareas_usuario" to "service_role";

grant trigger on table "public"."tareas_usuario" to "service_role";

grant truncate on table "public"."tareas_usuario" to "service_role";

grant update on table "public"."tareas_usuario" to "service_role";

grant delete on table "public"."teams" to "anon";

grant insert on table "public"."teams" to "anon";

grant references on table "public"."teams" to "anon";

grant select on table "public"."teams" to "anon";

grant trigger on table "public"."teams" to "anon";

grant truncate on table "public"."teams" to "anon";

grant update on table "public"."teams" to "anon";

grant delete on table "public"."teams" to "authenticated";

grant insert on table "public"."teams" to "authenticated";

grant references on table "public"."teams" to "authenticated";

grant select on table "public"."teams" to "authenticated";

grant trigger on table "public"."teams" to "authenticated";

grant truncate on table "public"."teams" to "authenticated";

grant update on table "public"."teams" to "authenticated";

grant delete on table "public"."teams" to "service_role";

grant insert on table "public"."teams" to "service_role";

grant references on table "public"."teams" to "service_role";

grant select on table "public"."teams" to "service_role";

grant trigger on table "public"."teams" to "service_role";

grant truncate on table "public"."teams" to "service_role";

grant update on table "public"."teams" to "service_role";

grant delete on table "public"."telemetria_iot" to "anon";

grant insert on table "public"."telemetria_iot" to "anon";

grant references on table "public"."telemetria_iot" to "anon";

grant select on table "public"."telemetria_iot" to "anon";

grant trigger on table "public"."telemetria_iot" to "anon";

grant truncate on table "public"."telemetria_iot" to "anon";

grant update on table "public"."telemetria_iot" to "anon";

grant delete on table "public"."telemetria_iot" to "authenticated";

grant insert on table "public"."telemetria_iot" to "authenticated";

grant references on table "public"."telemetria_iot" to "authenticated";

grant select on table "public"."telemetria_iot" to "authenticated";

grant trigger on table "public"."telemetria_iot" to "authenticated";

grant truncate on table "public"."telemetria_iot" to "authenticated";

grant update on table "public"."telemetria_iot" to "authenticated";

grant delete on table "public"."telemetria_iot" to "service_role";

grant insert on table "public"."telemetria_iot" to "service_role";

grant references on table "public"."telemetria_iot" to "service_role";

grant select on table "public"."telemetria_iot" to "service_role";

grant trigger on table "public"."telemetria_iot" to "service_role";

grant truncate on table "public"."telemetria_iot" to "service_role";

grant update on table "public"."telemetria_iot" to "service_role";

grant delete on table "public"."tesistas" to "anon";

grant insert on table "public"."tesistas" to "anon";

grant references on table "public"."tesistas" to "anon";

grant select on table "public"."tesistas" to "anon";

grant trigger on table "public"."tesistas" to "anon";

grant truncate on table "public"."tesistas" to "anon";

grant update on table "public"."tesistas" to "anon";

grant delete on table "public"."tesistas" to "authenticated";

grant insert on table "public"."tesistas" to "authenticated";

grant references on table "public"."tesistas" to "authenticated";

grant select on table "public"."tesistas" to "authenticated";

grant trigger on table "public"."tesistas" to "authenticated";

grant truncate on table "public"."tesistas" to "authenticated";

grant update on table "public"."tesistas" to "authenticated";

grant delete on table "public"."tesistas" to "service_role";

grant insert on table "public"."tesistas" to "service_role";

grant references on table "public"."tesistas" to "service_role";

grant select on table "public"."tesistas" to "service_role";

grant trigger on table "public"."tesistas" to "service_role";

grant truncate on table "public"."tesistas" to "service_role";

grant update on table "public"."tesistas" to "service_role";


  create policy "Alumnos ven anuncios de sus materias"
  on "public"."anuncios"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.inscripciones
  WHERE ((inscripciones.materia_id = anuncios.materia_id) AND (inscripciones.alumno_id = auth.uid())))));



  create policy "Docentes gestionan sus anuncios"
  on "public"."anuncios"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.materias
  WHERE ((materias.id = anuncios.materia_id) AND (materias.docente_id = auth.uid())))));



  create policy "Alumnos insertan y ven su propia asistencia"
  on "public"."asistencias_validadas"
  as permissive
  for insert
  to public
with check ((alumno_id = auth.uid()));



  create policy "Alumnos ven su asistencia"
  on "public"."asistencias_validadas"
  as permissive
  for select
  to public
using ((alumno_id = auth.uid()));



  create policy "Docentes ven asistencias de sus materias"
  on "public"."asistencias_validadas"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.sesiones_insitu s
     JOIN public.materias m ON ((s.materia_id = m.id)))
  WHERE ((s.id = asistencias_validadas.sesion_id) AND (m.docente_id = auth.uid())))));



  create policy "Autores gestionan sus propias bitácoras"
  on "public"."bitacora_eln"
  as permissive
  for all
  to public
using ((autor_id = auth.uid()));



  create policy "Privacidad del Canvas AI"
  on "public"."canvas_documentos"
  as permissive
  for all
  to public
using ((autor_id = auth.uid()));



  create policy "Gestión de citas propias"
  on "public"."citas_asesoria"
  as permissive
  for all
  to public
using ((docente_id = auth.uid()));



  create policy "Docentes pueden actualizar sus cursos"
  on "public"."courses"
  as permissive
  for update
  to public
using ((auth.uid() = teacher_id));



  create policy "Docentes pueden eliminar sus cursos"
  on "public"."courses"
  as permissive
  for delete
  to public
using ((auth.uid() = teacher_id));



  create policy "Docentes pueden insertar cursos"
  on "public"."courses"
  as permissive
  for insert
  to public
with check ((auth.uid() = teacher_id));



  create policy "Docentes pueden ver sus cursos"
  on "public"."courses"
  as permissive
  for select
  to public
using ((auth.uid() = teacher_id));



  create policy "Alumnos leen y actualizan sus entregas"
  on "public"."entregas"
  as permissive
  for select
  to public
using ((alumno_id = auth.uid()));



  create policy "Gestión de equipos por staff"
  on "public"."equipos_lab"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.perfiles
  WHERE ((perfiles.id = auth.uid()) AND (perfiles.rol = ANY (ARRAY['docente'::public.rol_usuario, 'investigador'::public.rol_usuario]))))));



  create policy "Lectura pública de equipos"
  on "public"."equipos_lab"
  as permissive
  for select
  to public
using (true);



  create policy "Alumnos leen geocercas de sus materias"
  on "public"."geocercas_materia"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.inscripciones
  WHERE ((inscripciones.materia_id = geocercas_materia.materia_id) AND (inscripciones.alumno_id = auth.uid())))));



  create policy "Docentes controlan geocercas"
  on "public"."geocercas_materia"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.materias
  WHERE ((materias.id = geocercas_materia.materia_id) AND (materias.docente_id = auth.uid())))));



  create policy "Acceso total"
  on "public"."horarios_docente"
  as permissive
  for all
  to public
using (true);



  create policy "Gestión de horarios propios"
  on "public"."horarios_docente"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.materias
  WHERE ((materias.id = horarios_docente.materia_id) AND (materias.docente_id = auth.uid())))));



  create policy "Permitir todo a usuarios autenticados"
  on "public"."horarios_docente"
  as permissive
  for all
  to public
using (true);



  create policy "Alumnos ven sus propias inscripciones"
  on "public"."inscripciones"
  as permissive
  for select
  to public
using ((alumno_id = auth.uid()));



  create policy "Docentes gestionan inscripciones de sus materias"
  on "public"."inscripciones"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.materias
  WHERE ((materias.id = inscripciones.materia_id) AND (materias.docente_id = auth.uid())))));



  create policy "Alumnos solo ven archivos visibles de sus materias"
  on "public"."materiales_boveda"
  as permissive
  for select
  to public
using (((es_visible = true) AND (EXISTS ( SELECT 1
   FROM public.inscripciones
  WHERE ((inscripciones.materia_id = materiales_boveda.materia_id) AND (inscripciones.alumno_id = auth.uid()))))));



  create policy "Docentes gestionan archivos de sus materias"
  on "public"."materiales_boveda"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.materias
  WHERE ((materias.id = materiales_boveda.materia_id) AND (materias.docente_id = auth.uid())))));



  create policy "Alumnos ven materias donde están inscritos"
  on "public"."materias"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.inscripciones
  WHERE ((inscripciones.materia_id = materias.id) AND (inscripciones.alumno_id = auth.uid())))));



  create policy "Docentes gestionan sus materias"
  on "public"."materias"
  as permissive
  for all
  to public
using ((docente_id = auth.uid()));



  create policy "Docentes gestionan sus propias materias"
  on "public"."materias"
  as permissive
  for all
  to public
using ((auth.uid() = docente_id));



  create policy "Alumnos ven avisos de sus materias"
  on "public"."materias_avisos"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.inscripciones
  WHERE ((inscripciones.materia_id = materias_avisos.materia_id) AND (inscripciones.alumno_id = auth.uid())))));



  create policy "Docentes gestionan avisos de sus materias"
  on "public"."materias_avisos"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.materias
  WHERE ((materias.id = materias_avisos.materia_id) AND (materias.docente_id = auth.uid())))));



  create policy "Lectura pública de perfiles"
  on "public"."perfiles"
  as permissive
  for select
  to public
using (true);



  create policy "Usuarios actualizan su propio perfil"
  on "public"."perfiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Usuarios pueden ver perfiles"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Investigadores gestionan sus proyectos"
  on "public"."proyectos_investigacion"
  as permissive
  for all
  to public
using ((investigador_principal_id = auth.uid()));



  create policy "Alumnos leen sesiones activas de sus materias"
  on "public"."sesiones_insitu"
  as permissive
  for select
  to public
using (((is_activa = true) AND (EXISTS ( SELECT 1
   FROM public.inscripciones
  WHERE ((inscripciones.materia_id = sesiones_insitu.materia_id) AND (inscripciones.alumno_id = auth.uid()))))));



  create policy "Docentes controlan sesiones QR"
  on "public"."sesiones_insitu"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.materias
  WHERE ((materias.id = sesiones_insitu.materia_id) AND (materias.docente_id = auth.uid())))));



  create policy "Gestión de tareas propias"
  on "public"."tareas_usuario"
  as permissive
  for all
  to public
using ((usuario_id = auth.uid()));



  create policy "Inserción abierta de sensores"
  on "public"."telemetria_iot"
  as permissive
  for insert
  to public
with check (true);



  create policy "Lectura pública de telemetría"
  on "public"."telemetria_iot"
  as permissive
  for select
  to public
using (true);



  create policy "Gestión de tesistas personal"
  on "public"."tesistas"
  as permissive
  for all
  to public
using ((director_id = auth.uid()));



