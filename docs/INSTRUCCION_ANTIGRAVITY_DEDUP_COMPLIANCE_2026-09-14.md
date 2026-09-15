# Instrucción para Antigravity — Deduplicación de código + opt-out de notificaciones (2ª tanda, parte 2)

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-14
**Origen:** hallazgos de code-reviewer y solutions-architect de la auditoría de 9 personas de esta sesión. Los hallazgos de compliance/legal (aviso de privacidad para IA, retención de datos, ARCO) NO están en esta instrucción — no son fixes de código, requieren decisión institucional aparte.

Al terminar, reporta: archivos nuevos/modificados (ruta completa), resultado de `npx tsc --noEmit` + `npm run build`.

---

## 1. Extraer `formatStudentName()` — duplicado en ~14 archivos con 4 variantes inconsistentes

Confirmado: no existe ningún helper compartido; cada archivo reconstruye el nombre del alumno a mano, con variantes que a veces omiten el apellido materno (pérdida real de información, no solo estilo).

**Fix:**
1. Crear `lib/formatStudentName.ts`:
   ```ts
   export function formatStudentName(
     s: { apellido_paterno: string; apellido_materno?: string | null; nombres: string },
     opts?: { order?: "apellido-nombre" | "nombre-apellido" }
   ): string {
     const apellidos = [s.apellido_paterno, s.apellido_materno].filter(Boolean).join(" ");
     return opts?.order === "nombre-apellido" ? `${s.nombres} ${apellidos}`.trim() : `${apellidos}, ${s.nombres}`.trim();
   }
   ```
   (Ajustar la firma si al revisar los 14 usos reales encuentras una forma más simple que cubra todos los casos — usa criterio, el objetivo es una sola función, no que la firma calce con esta propuesta al pie de la letra.)
2. Reemplazar las reconstrucciones manuales en (lista confirmada por la auditoría, verificar línea exacta al tocar cada archivo porque puede haber cambiado):
   - `app/(docente)/panel/materias/[id]/calificaciones/_hooks/useCalificaciones.ts`
   - `app/(docente)/panel/materias/[id]/calificaciones/_components/FinalGradesView.tsx`
   - `app/(docente)/panel/materias/[id]/calificaciones/_components/CaptureView.tsx`
   - `app/(docente)/panel/materias/[id]/alumnos/asistencia/_hooks/useAsistencia.ts`
   - `app/(docente)/panel/materias/[id]/evaluaciones/[examId]/_hooks/useEvaluacionDetalle.ts`
   - `app/(docente)/panel/materias/[id]/evaluaciones/[examId]/resultados/page.tsx`
   - `app/(docente)/panel/materias/[id]/alumnos/equipos/_hooks/useEquipos.ts`
   - `app/(docente)/panel/materias/[id]/alumnos/equipos/_components/TeamsGrid.tsx`
   - `app/(docente)/panel/materias/[id]/alumnos/equipos/_components/StudentPickerList.tsx`
   - `app/(docente)/panel/materias/[id]/alumnos/equipos/_components/EditTeamModal.tsx`
   - `app/(docente)/panel/materias/[id]/evaluaciones/_components/AudienceSelector.tsx`
   - `app/(docente)/panel/materias/[id]/alumnos/historial/_hooks/useHistorial.ts`
   - `app/(docente)/panel/materias/[id]/alumnos/historial/_components/AttendanceTable.tsx`
   - `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/page.tsx`
   - `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/auditoria/[submissionId]/page.tsx`
   - `app/(docente)/panel/materias/[id]/evaluaciones/[examId]/revision/[studentId]/page.tsx`

   **Importante:** al unificar, usa la variante que SÍ incluye apellido materno (no la que lo omite) como comportamiento final en todos los casos — es la más completa y correcta; los archivos que hoy lo omiten estaban perdiendo información real, no es una preferencia de estilo.

## 2. Extraer `sumWeights()`/`isWeightComplete()` — validación "debe sumar 100%" duplicada en 4 hooks

**Fix:** crear `lib/weightValidation.ts`:
```ts
export function sumWeights(items: { weight: number }[]): number {
  return items.reduce((sum, item) => sum + Number(item.weight), 0);
}
export function isWeightComplete(total: number, tolerance = 0.01): boolean {
  return Math.abs(total - 100) < tolerance;
}
```
Reemplazar en:
- `app/(docente)/panel/materias/[id]/actividades/nueva/_hooks/useNuevaActividad.ts` (`totalRubricWeight`/`isRubricValid`)
- `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/editar/_hooks/useEditarActividad.ts` (mismo patrón)
- `app/(docente)/panel/materias/[id]/drive/nuevo/_hooks/useCrearMaterial.ts`
- `app/(docente)/panel/materias/[id]/calificaciones/_hooks/useCalificaciones.ts` (aplicado a `unitCriteria`)

Nota: al introducir la tolerancia (`< 0.01` en vez de `=== 100` estricto), verifica que no cambie el comportamiento visible para el docente en casos ya probados (100.0 exacto sigue pasando igual) — es una mejora de robustez para floats, no un cambio de regla de negocio.

## 3. Extraer cálculo de "resumen de calificación de unidad" — duplicado 3-4 veces dentro de `useCalificaciones.ts`

`handleOpenCapture`, `handleOpenFinalGrades`, y `handleExportToSheets` reimplementan, cada uno por su cuenta, la lógica de traer `assignments`/`submissions`/`exams`/`evaluation_responses` de una unidad y calcular el promedio ponderado del alumno.

**Fix:** extraer una función interna al mismo archivo (no hace falta una capa de servicio nueva para esto, alcance acotado): `async function getUnitGradeSummary(unitId, activities, assignments, exams, students, supabase)` que centralice esa lógica, y que los 3 handlers la consuman en vez de reimplementarla. Mantener el comportamiento actual exacto de cada handler (no es momento de cambiar la regla de cálculo, solo de dejar de copiarla) — si notas que las 3 copias YA divergen en algún detalle (posible, dado que son copias independientes), señálalo explícitamente en el reporte en vez de decidir tú cuál versión es la "correcta" a unificar.

## 4. Tablón sin invalidación hacia el alumno

Confirmado: al publicar un aviso, el alumno no tiene ningún mecanismo (ni realtime, ni polling, ni revalidación) para enterarse si ya tenía la pantalla de comunicación abierta — solo lo ve si recarga manualmente.

**Fix mínimo, sin sobre-ingeniería** (no agregar Supabase Realtime, es más de lo que esta escala necesita): en `app/(alumno)/alumno/comunicacion/page.tsx` (o el archivo real que renderiza el Tablón del lado alumno — confirmar ruta exacta), agregar revalidación en foco/navegación: `router.refresh()` o un refetch al volver a enfocar la pestaña (`visibilitychange` o el equivalente ya usado en algún otro módulo del proyecto si existe un patrón — revisar antes de inventar uno nuevo). El objetivo es que un alumno que vuelve a la pestaña vea avisos nuevos sin recargar manualmente, no garantizar entrega instantánea.

## 5. Opt-out de notificaciones automáticas (hallazgo de compliance, pero sí es código simple)

Hoy `notify-exam-results` envía correo a todos los alumnos sin ningún control de preferencia.

**Fix:**
1. Migración nueva: `supabase/migrations/20260914130000_students_notification_opt_out.sql`
   ```sql
   alter table public.students add column if not exists notifications_opt_out boolean not null default false;
   ```
2. En `notify-exam-results/index.ts`: filtrar `resultados` excluyendo alumnos con `notifications_opt_out = true` antes de enviar (agregar el campo al `.select()` de `evaluation_responses(...students(...))`).
3. En la pantalla de perfil/edición de alumno del docente (`app/(docente)/panel/materias/[id]/alumnos/page.tsx` o donde se edite un alumno existente — confirmar ruta real), agregar un checkbox simple "No enviar notificaciones automáticas por correo a este alumno".

## Explícitamente FUERA de esta instrucción (no tocar, no son fixes de código)

- Aviso de privacidad institucional sobre transferencia de datos a Gemini/Google (requiere decisión legal/institucional del TecNM, no verificable ni resoluble desde el código).
- Política de retención/borrado de datos de exalumnos (requiere decisión institucional sobre plazos de conservación).
- Mecanismos ARCO formales (acceso/rectificación/cancelación/oposición) — requiere decisión de producto y probablemente de control escolar, no es un simple fix.
- El rediseño de Unidades/Calificaciones (columna `exams.weight_data`, separación de `is_closed`) — eso vive en una instrucción aparte ya redactada (`docs/INSTRUCCION_ANTIGRAVITY_UNIDADES_CALIFICACIONES_2026-09-14.md`), no mezclar aquí.

## Reglas de esta sesión (aplican igual)

- No hacer deploy ni `supabase db push` — el usuario autoriza después.
- `useEffect`+`useState` siempre, nunca `use()`/Suspense.
- Sin `alert()`/`confirm()` nativos nuevos.
- Cambios quirúrgicos — no refactorices más allá de lo que cada punto pide.
