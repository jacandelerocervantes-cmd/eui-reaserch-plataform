-- Agrega Año y Semestre a courses como columnas reales — hoy solo se usaban
-- de forma transitoria al crear la materia (para armar una clave de Drive) y
-- nunca se guardaban, por lo que no podían editarse después (ver hallazgo de
-- diseño en docs/QA_RED_TEAM_DOCENTE_2026-09-14.md, Paso 2).
--
-- Nullable: las materias existentes no tienen este dato y no hay forma de
-- inferirlo retroactivamente con certeza — se deja en null hasta que el
-- docente lo edite manualmente, en vez de forzar un valor adivinado.
alter table public.courses
  add column if not exists "year" integer,
  add column if not exists "semester" text check ("semester" in ('Enero - Julio', 'Agosto - Diciembre'));
