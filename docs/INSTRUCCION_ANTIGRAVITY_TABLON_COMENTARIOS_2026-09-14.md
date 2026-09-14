# Instrucción para Antigravity — Comentarios por publicación en Tablón (moderación individual)

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-14
**Estado:** APROBADO por el usuario, listo para ejecutar.

## 0. Decisiones de alcance (confirmadas por el usuario, no reabrir)

1. **Quién comenta:** ambos — el docente y los alumnos inscritos en la materia pueden comentar.
2. **Sobre qué:** solo hay un tipo de publicación en el Tablón — el anuncio que publica el docente (tabla real: `course_announcements`, confirmada abajo). El docente decide **al publicar cada anuncio** si ese anuncio en particular acepta comentarios o no (es una propiedad del anuncio, no de la materia completa).
3. **Switch global `courses.allow_student_comments`:** SE ELIMINA. No se conserva como interruptor maestro. Cada anuncio tiene su propio flag.
4. **Moderación:** reversible (ocultar/mostrar, soft-delete — nunca hard-delete).
5. **Notificación al autor del comentario si se oculta:** NO. Sin aviso.

## 1. Estado actual confirmado (auditoría de esta sesión)

- Tabla real de publicaciones: **`course_announcements`** (columnas confirmadas por uso real: `course_id`, `title`, `content`, `author_id`). Insertada hoy en [`supabase/functions/sync-tablon/index.ts:103-107`](../supabase/functions/sync-tablon/index.ts), acción `publishPost` (línea 83), ya valida `verifyCourseOwnership` (línea 94) — seguir ese mismo patrón para las acciones nuevas.
- No existe tabla de comentarios ni columna `allow_comments` en `course_announcements` todavía — hay que crearlas.
- El switch global a eliminar vive en:
  - [`app/(docente)/panel/materias/[id]/_hooks/useTablon.ts`](../app/(docente)/panel/materias/[id]/_hooks/useTablon.ts) líneas 23, 32, 38-49 (estado `allowComments`, `handleToggleAllowComments`, lee/escribe `courses.allow_student_comments`).
  - [`app/(docente)/panel/materias/[id]/_services/fetchTablon.ts`](../app/(docente)/panel/materias/[id]/_services/fetchTablon.ts) línea 20 (tipo `Materia.allow_student_comments`).
  - Buscar también el componente que renderiza el switch en la UI (probablemente en `app/(docente)/panel/materias/[id]/page.tsx`, el tablón) — quitar el control visual también, no solo el estado.
  - La columna `courses.allow_student_comments` en la base de datos: dejarla (no hacer DROP COLUMN en esta tarea, evitar migraciones destructivas innecesarias) simplemente dejar de leerla/escribirla desde el código.

## 2. Cambios de base de datos (migración nueva, NO ejecutar contra producción — solo dejar el archivo `.sql` listo)

Archivo sugerido: `supabase/migrations/20260914050000_tablon_comments.sql`

```sql
-- Cada anuncio decide si acepta comentarios (reemplaza el switch global por materia)
alter table course_announcements add column allow_comments boolean not null default true;

create table course_announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references course_announcements(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamptz not null default now(),
  hidden_at timestamptz,
  hidden_by uuid references auth.users(id)
);

alter table course_announcement_comments enable row level security;

-- Docente dueño del curso: ve todo (incl. ocultos), puede ocultar/mostrar
create policy "docente_manage_comments" on course_announcement_comments
  for all using (
    exists (
      select 1 from course_announcements ca
      join courses c on c.id = ca.course_id
      where ca.id = announcement_id and c.teacher_id = auth.uid()
    )
  );

-- Alumno inscrito: ve comentarios no ocultos del anuncio si allow_comments=true, puede insertar los suyos
create policy "alumno_read_visible_comments" on course_announcement_comments
  for select using (
    hidden_at is null
    and exists (
      select 1 from course_announcements ca
      join enrollments e on e.course_id = ca.course_id
      where ca.id = announcement_id and e.student_id = auth.uid() and ca.allow_comments = true
    )
  );

create policy "alumno_insert_own_comment" on course_announcement_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from course_announcements ca
      join enrollments e on e.course_id = ca.course_id
      where ca.id = announcement_id and e.student_id = auth.uid() and ca.allow_comments = true
    )
  );
```
Revisar nombres reales de columnas de `enrollments` (`student_id` vs otro nombre) y de `courses` (`teacher_id`) contra el esquema real antes de aplicar — seguir el mismo patrón ya usado en las políticas RLS existentes de `submissions`/`exams` (buscar una migración reciente como referencia de convención exacta).

## 3. Backend — extender `supabase/functions/sync-tablon/index.ts`

Agregar acciones nuevas al mismo switch de `action` que ya existe (junto a `fetchPosts`/`publishPost`):

- **`publishPost`** (ya existe, línea 83): agregar el campo `allow_comments` (boolean, del payload) al `insert` de la línea 103-107.
- **`listComments`**: recibe `announcement_id`, devuelve comentarios visibles según el rol (docente ve todos, alumno solo no-ocultos) — usar `verifyDocente` o el verificador de alumno según corresponda (revisar qué verificador usa ya `sync-tablon` para alumnos, si es que lo tiene, o si esta función es docente-only y hay que crear el endpoint de lectura de alumno en otro lado / o exponer esta acción para ambos roles).
- **`postComment`**: recibe `announcement_id`, `content`. Válido para docente y alumno. Verificar `allow_comments = true` en el anuncio antes de insertar. `author_id` siempre del JWT (nunca del payload del cliente — mismo criterio que ya usa `publishPost` en la línea 102 de ese archivo).
- **`hideComment`** / **`unhideComment`**: recibe `comment_id`. Solo docente, con `verifyCourseOwnership` sobre el curso del anuncio al que pertenece el comentario (join `course_announcement_comments → course_announcements → courses`).

Si `sync-tablon` es actualmente una función solo para docente y los alumnos usan otro mecanismo/función para leer el tablón, evaluar si conviene una función nueva `sync-tablon-comments` en vez de sobrecargar `sync-tablon` — usar criterio y explicar la decisión en el reporte final.

## 4. Frontend

- **`useTablon.ts`**: quitar `allowComments`/`isTogglingComments`/`handleToggleAllowComments` (líneas 23-24, 32, 38-49, 96) y el switch global de la UI donde se renderice. Agregar en su lugar: al publicar un anuncio (`handlePublish`, línea 51), incluir un checkbox/toggle "Permitir comentarios en este anuncio" que viaje como `allow_comments` en el payload de `publishPost`.
- Nuevo componente `_components/AnnouncementComments.tsx` (o nombre similar): lista de comentarios por anuncio, input para publicar (docente y alumno), botón "Ocultar"/"Mostrar" visible **solo cuando el viewer es el docente dueño del curso**.
- **Confirmado: el alumno tiene su propia vista del tablón** en [`app/(alumno)/alumno/materia/[id]/_hooks/useMateriaAlumno.ts`](../app/(alumno)/alumno/materia/[id]/_hooks/useMateriaAlumno.ts) (ya consume `course_announcements`) — esta tarea SÍ incluye agregar ahí la lista de comentarios + input para comentar (sin botón de ocultar, eso es exclusivo del docente). Revisar ese hook y su `page.tsx` correspondiente antes de escribir el componente de alumno, para reusar el mismo patrón de datos que ya usa esa pantalla.
- De paso, ya que se toca `useTablon.ts`: hay 2 `alert()` nativos preexistentes en `handlePublish` (líneas 72 y 80) — reemplazarlos por el patrón `feedback: {type, message}` con toast ya usado en el resto del proyecto (ver `useNuevaActividad.ts` como referencia), ya que se está modificando esta misma función para agregar el campo `allow_comments`.
- Seguir siempre `useEffect`+`useState` para cargar comentarios (nunca `use()`/Suspense).

## 5. Reglas de esta sesión (aplican igual)

- **No ejecutar la migración contra producción** (`supabase db push`) — dejar el archivo `.sql` listo, el usuario la aplica después de revisarla.
- **No hacer deploy de Edge Functions** — el usuario lo autoriza aparte.
- Cualquier acción nueva en `sync-tablon` (o función nueva) que toque datos de un curso: usar `verifyCourseOwnership` para el docente, y verificar inscripción (`enrollments`) para el alumno — mismo rigor que se aplicó en la auditoría IDOR de esta sesión.

## 6. Reportar al terminar

1. Archivos nuevos/modificados (ruta relativa completa), incluida la migración `.sql`.
2. Si se creó una función Edge nueva o se extendió `sync-tablon` — y por qué.
3. Confirmación de nombres reales de columnas usados en las políticas RLS (`enrollments.student_id`, `courses.teacher_id`, etc.) tras revisar el esquema real.
4. Confirmar que se agregó el componente de comentarios también en la vista de alumno (`app/(alumno)/alumno/materia/[id]/...`), incluida en el alcance de esta tarea.
5. Resultado de `npx tsc --noEmit` y `npm run build`.
