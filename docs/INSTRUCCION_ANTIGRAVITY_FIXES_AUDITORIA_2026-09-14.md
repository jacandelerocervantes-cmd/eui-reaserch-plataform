# Instrucción única para Antigravity — Cierre de auditoría del módulo docente

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-14
**Objetivo:** resolver en una sola corrida TODOS los hallazgos pendientes de la auditoría de esta sesión (seguridad, DBA, performance, QA) más limpieza de archivos obsoletos. El hallazgo de RLS crítico (assignments/course_units) YA fue corregido y desplegado por separado — no es parte de esta tarea. `materiales_boveda.materia_id` (inconsistencia de nombre de columna) se deja explícitamente PENDIENTE — no lo toques, no es prioridad.

Al terminar, reporta: archivos nuevos/modificados/eliminados (ruta completa), migración(es) SQL creada(s), resultado de `npx tsc --noEmit` + `npm run build`.

---

## 1. 🔴 CRÍTICO — `submissions` le falta `final_score`/`final_feedback`/`is_late`

Verificado en vivo contra la BD real: estas 3 columnas NO EXISTEN en `submissions`, pero el código las usa por nombre en selects/updates, lo que hace fallar silenciosamente (PostgREST devuelve error, el código solo destructura `data` sin chequear `error`) estas pantallas:
- `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/page.tsx` (línea ~29 select, ~166-167 update) — Control de Entregas.
- `app/(docente)/panel/materias/[id]/calificaciones/_hooks/useCalificaciones.ts` (líneas ~298, ~351, ~403) — Calificaciones de Actividades.
- `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/auditoria/[submissionId]/page.tsx` (~173-174) — Auditoría de entrega.

**Decisión ya tomada: agregar las columnas faltantes (no reescribir el código que ya las asume en decenas de lugares).**

Migración nueva: `supabase/migrations/20260914090000_fix_submissions_missing_columns.sql`
```sql
alter table public.submissions
  add column if not exists final_score double precision,
  add column if not exists final_feedback text,
  add column if not exists is_late boolean not null default false;
```
No ejecutar `supabase db push` — dejar el archivo listo, el usuario lo aplica.

## 2. 🔴 ALTO — feedback falso de "éxito" tras guardar sin chequear error

`app/(docente)/panel/materias/[id]/calificaciones/_hooks/useCalificaciones.ts`:
- `handleUpdateUnitPillars` (líneas ~144-185): el `delete` (línea ~175) y el `upsert` (línea ~178) no chequean `error`, y aun así se muestra `setFeedback({type:"success",...})` incondicionalmente después. Agregar chequeo de `error` en ambas llamadas; si falla cualquiera, mostrar `setFeedback({type:"error", message:"..."})` en vez del success, y no continuar como si hubiera funcionado.
- `handleUpdateAssignmentWeight` (líneas ~187-197): mismo problema, agregar chequeo de `error` y feedback correspondiente.
- `fetchData` (líneas ~60-89): las 5 queries iniciales (`course_units`,`activities`,`assignments`,`exams`,`students`) solo destructuran `data`. Agregar chequeo de `error` en cada una; si alguna falla, setear un estado de error visible en vez de dejar listas vacías silenciosas.

`app/(docente)/panel/materias/[id]/unidades/_hooks/useUnidades.ts`:
- `handleUpdateUnitPillars` (~147-161), `handleUpdateAssignmentWeight` (~163-170), y el loop de `handleUpdateUnitFull` (~199-205): mismo patrón, sin chequeo de `error`. Agregar chequeo y feedback de error consistente con `handleAdd`/`handleEdit`/`handleDelete` del mismo archivo (que sí lo hacen bien — usar esos como plantilla).

`app/(docente)/panel/materias/[id]/alumnos/equipos/_hooks/useEquipos.ts` (línea ~146): al editar un equipo, el `delete` de `team_members` antes de insertar los nuevos miembros no chequea `error` — agregar chequeo para evitar duplicados de membresía si el delete falla silenciosamente.

`app/(docente)/panel/materias/[id]/evaluaciones/[examId]/configuracion/_hooks/useConfiguracionExamen.ts` (línea ~158): mismo patrón, `delete` de `exam_students` sin chequear `error` antes del insert de audiencia nueva.

## 3. 🟡 Seguridad media — guardrails de IA faltantes

- `supabase/functions/extract-exam-questions-ia/index.ts` (líneas ~77-86): el contenido extraído de archivos (CSV de Excel, texto de docx, texto plano) se interpola directo al prompt sin pasar por ningún guardrail. Agregar `scanPromptInjection`/`applyInputGuardrail` (de `../_shared/guardrail.ts`, mismo patrón que ya usan `master-copilot-orchestrator`/`evaluate-submissions-ia`) sobre el texto extraído antes de mandarlo a Gemini, y `guardOutputOrBlock`/`applyOutputGuardrail` sobre la respuesta antes de devolverla al cliente.
- `supabase/functions/generate-exam-ia/index.ts` (líneas ~192,219) y `supabase/functions/generate-rubric-ia/index.ts`: el `instruction`/`extractedText` del docente no pasa por `applyInputGuardrail`/`scanAndRedactPii` antes de ir a Gemini — agregar esa llamada sobre el texto libre e instrucción del docente antes de construir el prompt final, mismo patrón que ya usan las funciones que sí lo hacen.

## 4. 🟡 Performance — N+1 sin batching (agregar `Promise.all` o batch real donde aplique)

- `app/(docente)/panel/materias/[id]/unidades/_hooks/useUnidades.ts:199-205` (`handleUpdateUnitFull`, loop de `asgnWeights`): paralelizar con `Promise.all` en vez de `for...await` secuencial, y chequear errores de cada una (ver punto 2).
- `app/(docente)/panel/materias/[id]/evaluaciones/[examId]/configuracion/_hooks/useConfiguracionExamen.ts:174-178` (`handleSaveExam`, loop de preguntas): paralelizar con `Promise.all`. Ya chequea `error` por iteración, mantenerlo.
- `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/page.tsx:161-173` (`handlePublishSelected`): paralelizar con `Promise.all`. Ya chequea `error`, mantenerlo.
- `app/(docente)/panel/materias/[id]/calificaciones/_hooks/useCalificaciones.ts:402-407` (`handleSaveGrades`, los dos loops de `submissions`/`evaluation_responses`): paralelizar con `Promise.all` Y agregar chequeo de `error` que hoy no tienen (combina con el punto 2).
- `useCalificaciones.ts` líneas ~483-485 y ~556-558 (`handleOpenFinalGrades`/`handleOpenSabana`, loop de `autoFillStandardCriteria` por unidad): paralelizar con `Promise.all(units.map(...))` ya que cada unidad escribe en claves distintas sin colisión.

## 5. 🟡 Índices faltantes / duplicados

Nueva migración: `supabase/migrations/20260914100000_fix_indexes.sql`
```sql
create index if not exists idx_questions_exam_id on public.questions(exam_id);
create index if not exists idx_teams_course_id on public.teams(course_id);
-- idx_announcements_course e idx_announcements_course_id son el mismo índice duplicado sobre course_id
drop index if exists public.idx_announcements_course;
```
(Confirmar antes de dropear cuál de los dos nombres es el que de verdad está en uso/referenciado en algún lado antes de decidir cuál de los dos conservar — si tienen exactamente la misma definición, cualquiera de los dos se puede quedar, con que quede solo uno.)

## 6. 🟡 Código muerto adicional en Calificaciones (mismo patrón que ya se limpió antes)

Confirmado: ningún componente montado en `calificaciones/page.tsx` importa estos 4 archivos — eliminarlos:
- `app/(docente)/panel/materias/[id]/calificaciones/_components/NewActivityModal.tsx`
- `app/(docente)/panel/materias/[id]/calificaciones/_components/NewUnitModal.tsx`
- `app/(docente)/panel/materias/[id]/calificaciones/_components/SabanaView.tsx`
- `app/(docente)/panel/materias/[id]/calificaciones/_components/UnitsView.tsx`

Y en `useCalificaciones.ts`, eliminar los handlers/estado que solo alimentaban esos componentes muertos (confirmar con grep antes de cada borrado que nada más los usa): `currentView/setCurrentView`, `showUnitModal/setShowUnitModal`, `showActivityModal/setShowActivityModal`, `editingActivityId`, `newUnitName/setNewUnitName`, `activeUnitId/setActiveUnitId`, `newActivity/setNewActivity`, `unitCriteria/totalWeight/isWeightValid`, `handleAddUnitCriterion/handleRemoveUnitCriterion/handleUpdateUnitCriterion`, `selectedUnit`, `lockedUnits`, `collapsedUnits/setCollapsedUnits`, `getUnitTotalWeight`, `openNewUnitModal`, `openAddActivityModal`, `openEditActivityModal`, `handleAddUnit`, `handleAddActivity`, `handleDeleteActivity`, `handleOpenSabana`, `toggleLockSabana`.

**No tocar** `handleUpdateUnitPillars`/`handleUpdateAssignmentWeight`/`handleSaveGrades`/`handleOpenFinalGrades`/`handleOpenSabana`(el de exportar sábana real, distinto del muerto `handleOpenSabana` de arriba — verificar cuál es cuál por nombre exacto de función antes de borrar, pueden coincidir en nombre) — esos SÍ están en uso real, ya cubiertos en los puntos 2 y 4.

## 7. 🟡 Validación de fechas faltante en Actividades

`app/(docente)/panel/materias/[id]/actividades/nueva/_hooks/useNuevaActividad.ts` (`handleSave`, ~líneas 226-238): agregar validación de que `hard_deadline` (si se define) sea posterior a `soft_deadline`, mismo patrón que ya usa `useNuevaEvaluacion.ts:287-288`/`useConfiguracionExamen.ts:133` (`endAt > startAt`) — bloquear el guardado con mensaje claro si están invertidos.

## 8. 🟡 Políticas RLS duplicadas (consolidar, no solo documentar)

`course_units` tiene 3 políticas `ALL` equivalentes (`docente_manage_units`, `docente_own_units`, más la de admin que sí es distinta y se queda) con el mismo `qual` (`course_id IN (select id from courses where teacher_id=auth.uid())`). `course_announcements` tiene 4 variantes de "docente gestiona sus avisos" con el mismo `qual`. Antes de escribir la migración: consultar `pg_policies` real (`npx supabase db query --linked --file <archivo.sql>`, con `dangerouslyDisableSandbox: true` si hace falta) para confirmar el texto EXACTO de cada política duplicada en ambas tablas, y generar una migración `supabase/migrations/20260914110000_dedupe_rls_policies.sql` que haga `DROP POLICY` de las redundantes dejando UNA sola política `ALL` por tabla (además de la política de admin, que se queda intacta). No modificar el comportamiento, solo eliminar duplicados con `qual` idéntico confirmado.

## 9. Limpieza de archivos obsoletos — confirmado, no es especulativo

**`supabase/pendiente/` — carpeta completa (13 `.sql` + 3 `.md`) — ELIMINAR ENTERA.** Verificado uno por uno esta sesión contra la BD real: las 7 tablas y 5 columnas que estos 13 archivos declaran **ya existen todas en producción** — no hay nada pendiente ahí, es 100% ruido. Comando: eliminar el directorio `supabase/pendiente/` completo.

**`.md` de raíz — eliminar estos 3** (contenido de estado/sesión ya superado, confirmado explícitamente en contexto de esta sesión que su información vive ahora en `docs/PLAN_ACTIVIDADES_EVALUACIONES_2026-09-14.md`):
- `PROXIMA_SESION.md`
- `PENDIENTE_FIXES_EDGE_FUNCTIONS.md`
- `SECURITY_AUDIT.md`

**Mantener sin tocar**: `README.md`, `ARCHITECTURE_AND_DESIGN.md` (documentación estructural, no transitoria), toda la serie `docs/01_...` a `docs/10_...` (documentación de arquitectura base, no confirmado que esté obsoleta), `docs/especificaciones/**`, y **todos** los `docs/INSTRUCCION_ANTIGRAVITY_*.md` de esta sesión (son el registro de auditoría activo, no basura).

**NUNCA tocar `supabase/migrations/**`** — esa es la única carpeta con el historial real aplicado y trackeado por Supabase; borrar algo ahí desincroniza la migración remota. Esta limpieza es solo sobre `supabase/pendiente/` (que es un borrador manual aparte, no trackeado) y los 3 `.md` de raíz listados arriba.

## 10. Explícitamente NO tocar en esta tarea

- `materiales_boveda.materia_id` (inconsistencia de nombre de columna) — queda pendiente para otra sesión, no es prioridad.
- Cualquier archivo de `app/(admin)/**` o `app/(alumno)/**`.
- Los 8 archivos del lado alumno con el bug de `use()`/Suspense (documentados en `docs/PLAN_ACTIVIDADES_EVALUACIONES_2026-09-14.md` sección 3.5) — fuera de alcance, es lado alumno.

## Reglas de esta sesión (aplican igual)

- No hacer deploy de Edge Functions ni `supabase db push` — el usuario autoriza después.
- `useEffect`+`useState` siempre, nunca `use()`/Suspense.
- Sin `alert()`/`confirm()` nativos nuevos.
- Cambios quirúrgicos por punto — no refactorices más allá de lo que cada punto pide.
