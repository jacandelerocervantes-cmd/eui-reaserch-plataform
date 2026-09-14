# Pendiente: fixes encontrados en auditoría de Edge Functions recuperadas

Contexto: estas 12 funciones existían en producción (proyecto `EUI-Core-2026`,
ref `inhauwsdbgtiofxxpggp`) pero no en este repo local — se recuperaron con
`supabase functions download <nombre>` y se auditaron una por una. Dos
hallazgos quedaron pendientes de corregir (decisión: no tocar código hasta
probarlo en la copia de GitHub/producción que se descargará aparte).

## 🔴 Prioridad alta — `notify-exam-results`: falta verificar dueño del examen (IDOR)

**Archivo**: `supabase/functions/notify-exam-results/index.ts`

**Problema**: solo llama `verifyDocente(req)` — exige que quien llama sea
docente, pero NO valida que el `examId` recibido pertenezca a una materia de
**ese** docente. Cualquier docente autenticado puede pasar el `examId` de
un curso ajeno y disparar el envío de correo con las calificaciones de esos
alumnos.

**La corrección correcta ya existe en el código, solo hay que copiarla** —
`supabase/functions/publish-exam-form/index.ts` resuelve exactamente el mismo
caso (examen → `course_units` → `courses`, sin columna `course_id` directa en
`exams`) así:

```ts
const { data: exam, error: examErr } = await serviceClient
  .from("exams")
  .select("id, title, unit_id, course_units(title, courses(id, teacher_id, drive_folder_id))")
  .eq("id", examId)
  .single()
if (examErr || !exam) return new Response(/* 404 */)

const course = (exam as any).course_units?.courses
if (!course?.id || !(await verifyCourseOwnership(serviceClient, course.id, userId))) {
  return new Response(/* 403 */)
}
```

Aplicar el mismo patrón en `notify-exam-results` (ahí mismo se hace
`.from("exams").select("title").eq("id", examId).single()` — hay que ampliar
el `select` para traer `course_units(courses(id))` y agregar el check de
`verifyCourseOwnership` antes de seguir).

## 🟡 Prioridad baja — `invite-colaborador`: el envío de correo puede tumbar una operación que sí funcionó

**Archivo**: `supabase/functions/invite-colaborador/index.ts`

**Problema**: la invitación se guarda correctamente en `proyecto_colaboradores`
(upsert exitoso) ANTES de intentar enviar el correo vía Apps Script. Pero el
`fetch` al Apps Script no está en su propio `try/catch` — si falla (timeout,
cuota de Gmail, red), la excepción sube hasta el `catch` general del handler
y la función responde `500` al docente, aunque la invitación **ya existe**
en la base. El docente ve "error" cuando en realidad la invitación sí se
creó, solo no se notificó por correo.

**Corrección sugerida**: envolver el bloque de `fetch` al Apps Script en su
propio `try/catch` que solo loguee (`console.error`) sin relanzar, y devolver
igualmente `{ ok: true, correo_invitado }` — igual que ya hacen
`enforce-assignment-deadlines`/`retry-pending-deliveries` con sus llamadas a
Apps Script (`catch (_) { /* se reintenta en el próximo ciclo */ }`).

## Cómo se encontraron

Auditoría manual, archivo por archivo, de las 12 funciones recién descargadas
(`confirm-invitacion`, `invite-colaborador`, `canvas-copilot`,
`import-ia-teams`, `extract-exam-questions-ia`, `retry-pending-deliveries`,
`notify-exam-results`, `update-assignment-hub`, `publish-exam-form`,
`ingest-form-response`, `enforce-assignment-deadlines`,
`activate-scheduled-exams`) — el resto no tuvo hallazgos.
