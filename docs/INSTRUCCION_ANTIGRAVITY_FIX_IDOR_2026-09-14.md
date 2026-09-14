# Instrucción para Antigravity — Fix IDOR en 5 puntos (Edge Functions)

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-14
**Objetivo:** cerrar 5 huecos IDOR (Insecure Direct Object Reference) encontrados en la auditoría de esta sesión. Todas usan `serviceClient` (bypassa RLS), así que el chequeo de ownership en código es la única protección — sin él, cualquier docente/alumno autenticado puede operar sobre datos de otro con solo conocer/adivinar un ID.

Al terminar, reporta: **lista de archivos modificados (ruta relativa completa)**, resultado de `npx tsc --noEmit`, y confirma que cada uno de los 5 puntos quedó cerrado (con el número de línea donde quedó el chequeo nuevo).

---

## Patrón de referencia (YA aplicado y en producción en 3 funciones)

Ver [`supabase/functions/analyze-exam-group-results/index.ts`](../supabase/functions/analyze-exam-group-results/index.ts) líneas 12 y 93-101 como ejemplo exacto:

```ts
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
// ...
if (!course?.id || !(await verifyCourseOwnership(serviceClient, course.id, userId))) {
  return new Response(
    JSON.stringify({ error: "No tienes permiso sobre este examen." }),
    { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
  )
}
```

Firma exacta ([`supabase/functions/_shared/auth.ts:117-131`](../supabase/functions/_shared/auth.ts)):
```ts
export async function verifyCourseOwnership(
  client: SupabaseClient,
  courseId: string,
  userId: string,
): Promise<boolean>
```
Devuelve `true` si el usuario es admin O si `courses.teacher_id === userId`. Ya está probado, no hay que tocarlo — solo importarlo y llamarlo donde falta.

También ver `notify-exam-results/index.ts` y `bulk-evaluate-exams/index.ts` como segundo/tercer ejemplo del mismo patrón ya aplicado.

**Nota importante:** la tabla `exams` ya tiene `course_id` poblado y sincronizado por trigger desde esta sesión (migración `20260914040000_sync_exams_course_id.sql`), así que en funciones que trabajan con `exams` se puede usar `exams.course_id` directo sin pasar por `unit_id → course_units.course_id`.

---

## 1. `supabase/functions/calibrate-ai-thresholds/index.ts`

Recibe `course_id` (body, opcional) y lee/escribe `ai_calibration_state` para ese curso usando `serviceClient`, sin validar que el curso sea del docente autenticado.

**Fix:** justo después de leer `course_id` del body (y antes de cualquier `.from("ai_calibration_state")` u otra tabla scoped por curso), agregar:
```ts
if (course_id && !(await verifyCourseOwnership(serviceClient, course_id, userId))) {
  return new Response(JSON.stringify({ error: "No tienes permiso sobre este curso." }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } })
}
```
Agregar `verifyCourseOwnership` al import de `../_shared/auth.ts`. Revisar el nombre real de la variable `userId` en el contexto de auth de este archivo (puede llamarse distinto, usar el que ya exista en `auth.ctx`).

## 2. `supabase/functions/validate-ai-grading/index.ts`

Mismo patrón: recibe `course_id` (body, opcional), filtra `exams`/`assignments` por él e inserta en `ai_calibration_state` sin chequeo de ownership.

**Fix:** mismo bloque que el punto 1, insertado después de obtener `course_id` y antes de cualquier query/insert scoped por ese curso.

## 3. `supabase/functions/evaluate-submissions-ia/index.ts`

Recibe `assignment_id` y `submission_ids` (body). Ya lee `assignment.course_id` en algún punto del archivo (confirmar dónde exactamente al leer el archivo), pero nunca lo compara contra el docente autenticado antes de sobrescribir `ai_score`/`ai_feedback`/`status`/`ai_integrity_flag` en `submissions`.

**Fix:** inmediatamente después de obtener `assignment.course_id` (o el `course_id` que corresponda al `assignment_id` recibido), agregar el mismo chequeo:
```ts
if (!(await verifyCourseOwnership(serviceClient, assignment.course_id, userId))) {
  return new Response(JSON.stringify({ error: "No tienes permiso sobre esta actividad." }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } })
}
```
antes de procesar cualquier `submission_id` de la lista.

## 4. `supabase/functions/master-copilot-orchestrator/index.ts`

Recibe `course_id` (body, opcional) y lo pasa sin validar a `fetchCourseContext` (en `_shared/retriever.ts`), que lee `course_units`/`assignments`/`exams` de cualquier curso y los inyecta en el prompt del copiloto.

**Fix:** en `master-copilot-orchestrator/index.ts`, justo antes de llamar a `fetchCourseContext(...)`, agregar el mismo chequeo de `verifyCourseOwnership` sobre el `course_id` recibido (si viene definido). NO modificar `_shared/retriever.ts` — el chequeo va en el caller, igual que en los otros 3 puntos, para no afectar a otros callers de `fetchCourseContext` que ya podrían validar ownership por su cuenta (revisar rápido si hay otros callers antes de decidir, y si TODOS los callers de `fetchCourseContext` tienen el mismo hueco, entonces sí mover el chequeo dentro de `fetchCourseContext` — usar criterio, pero reportar la decisión).

## 5. `supabase/functions/_shared/auth.ts` — rama `exam_prep` de `verifyAlumnoSandbox`

Líneas 208-219 (ver el archivo). La rama `assignment` (líneas 201-206) sí valida `.eq("course_id", courseId)` sobre `assignments`. La rama `exam_prep` (208-219) solo hace:
```ts
const { data: exam } = await serviceClient
  .from("exams").select("id, start_at, unit_id").eq("id", examId).single()
```
sin comparar contra `courseId` — un alumno con sandbox activo en su propia materia puede mandar el `examId` de otra materia y obtener contexto de ese examen ajeno.

**Fix:** ya que `exams.course_id` está poblado y sincronizado (ver nota arriba), cambiar el `.select(...)` para incluir `course_id` y agregar el filtro directo:
```ts
const { data: exam } = await serviceClient
  .from("exams").select("id, start_at, course_id").eq("id", examId).eq("course_id", courseId).single()
if (!exam) return { ok: false, err: { status: 404, message: "Examen no encontrado en esta materia." } }
```
(Quitar `unit_id` del select si ya no se usa en el resto de la función — revisar antes de quitarlo por si se usa más abajo en el mismo bloque `exam_prep`.)

---

## Fuera de alcance de esta tarea (NO corregir ahora, solo para que quede registrado)

- `supabase/functions/iot-copilot/index.ts` — clasificada como DUDOSA: la consulta a `telemetria_iot` no filtra por docente (a diferencia de `equipos_lab` en el mismo archivo, que sí usa `.eq("docente_responsable_id", user.id)`). No es un IDOR clásico (no llega un ID ajeno adivinable en el body), es una fuga de scoping. Señalar en el reporte si de paso se detecta algo más, pero no corregir en esta tarea — vuelve al backlog para revisión aparte.

## Reglas de esta sesión (aplican igual aquí)

- No hacer deploy de ninguna función — el usuario lo autoriza explícitamente después, por separado (`supabase functions deploy <nombre>`).
- No modificar lógica de negocio más allá del chequeo de ownership — cambio quirúrgico, no refactor.
- Reportar explícitamente cualquier duda sobre nombres de variables reales (`userId` vs `user.id` vs `auth.ctx.userId`, etc.) si difieren de lo asumido aquí — cada archivo puede tener su propio nombre de contexto de auth, hay que leer el archivo real antes de pegar el snippet.
