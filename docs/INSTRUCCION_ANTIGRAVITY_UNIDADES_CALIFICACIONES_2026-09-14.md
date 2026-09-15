# Instrucción para Antigravity — Separar `is_closed` + ponderación individual por examen

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha original:** 2026-09-14 — **actualizada:** 2026-09-15 (la sección "eliminar código muerto" que tenía esta instrucción ya se ejecutó en otra tarea — los 4 componentes/handlers muertos de Calificaciones ya no existen, confirmado justo antes de escribir esto. No repetir esa parte.)

Decisiones de diseño ya confirmadas por el usuario — no reabrir esas discusiones, ejecutar directo:
1. **Mantener el gate secuencial** de "una unidad activa a la vez", pero con mejor UX (avisos claros de qué se cierra y qué implica).
2. **Separar el campo único `course_units.is_closed`** en dos campos independientes: uno para asistencia, otro para calificaciones/notas.
3. **Construir la ponderación individual por examen** (columna nueva en `exams` + UI de desglose, mismo patrón visual que ya existe para tareas).

Estado real de la BD verificado justo antes de esta instrucción (no hace falta que lo reverifiques, pero sí verifica cualquier otra cosa que asumas):
- `course_units.closed_at` e `is_closed` existen tal cual. `attendance_closed_at`/`grades_closed_at` NO existen todavía.
- `exams.weight_data` NO existe todavía.
- Los 4 componentes muertos de Calificaciones (`UnitsView.tsx`, `NewUnitModal.tsx`, `SabanaView.tsx`, `NewActivityModal.tsx`) ya fueron eliminados en una tarea anterior — no están en el árbol, no hay nada que borrar ahí.
- `useCalificaciones.ts` todavía tiene `examWeights`/`handleUpdateExamWeight` (líneas ~24, ~185, ~511, ~514) en su forma vestigial (nunca persiste nada en BD) — sigue pendiente de limpiar, ver sección 3 de este documento.

Al terminar, reporta: archivos nuevos/modificados (ruta relativa completa), migración SQL creada, resultado de `npx tsc --noEmit` + `npm run build`.

---

## 1. Migración de base de datos — separar `is_closed` en dos campos + ponderación de examen

Archivo nuevo: `supabase/migrations/20260915020000_unidades_calificaciones_fix.sql` (NO ejecutar `supabase db push`, dejar listo para revisión). Usa este número de timestamp exacto o uno posterior si al momento de escribir ya existe una migración con esta fecha/hora — revisa `supabase/migrations/` antes de crear el archivo para no colisionar con otra ya creada.

```sql
-- Separar el gate único "is_closed" en dos conceptos independientes:
-- asistencia (Historial/Sellar) y calificaciones (Captura/Cerrar Unidad).
-- Migrar el dato existente: si is_closed=true hoy, asumimos que ambos
-- procesos estaban cerrados (comportamiento previo no distinguía), así que
-- se copia el valor a ambos campos nuevos para no perder estado real.
alter table public.course_units
  add column if not exists attendance_closed_at timestamptz,
  add column if not exists grades_closed_at timestamptz;

update public.course_units
  set attendance_closed_at = coalesce(attendance_closed_at, closed_at, case when is_closed then now() else null end),
      grades_closed_at = coalesce(grades_closed_at, case when is_closed then now() else null end)
  where is_closed = true;

-- Ponderación individual por examen dentro de su unidad (mismo patrón que
-- assignments.rubric_data.weight_percentage, aplicado a exams).
alter table public.exams
  add column if not exists weight_data jsonb;
```

**No borrar `is_closed`/`closed_at`** — dejarlas como columnas vestigiales sin usar (mismo criterio ya aplicado antes con `courses.allow_student_comments`, evitar `DROP COLUMN` innecesario).

## 2. Separar la lógica de "unidad activa" — asistencia vs. calificaciones

Los 4 puntos que hoy calculan "unidad activa" a partir de `is_closed` deben pasar a usar el campo específico según su dominio:

1. `app/(docente)/panel/materias/[id]/unidades/_hooks/useUnidades.ts` (`activeUnit = units.find(u => !u.is_closed)`, verificar número de línea actual). Esta pantalla es de configuración general (título/sesiones/pesos), no específica de asistencia ni notas — mantenerla usando AMBOS campos: una unidad se considera "abierta" aquí solo si ninguno de los dos (`attendance_closed_at`/`grades_closed_at`) está seteado (para no permitir "reconfigurar" una unidad que ya se cerró en cualquiera de los dos procesos). Ajustar el tipo `CourseUnit` para incluir los nuevos campos.
2. `app/(docente)/panel/materias/[id]/calificaciones/page.tsx` — usar `grades_closed_at` (dominio de notas).
3. `app/(docente)/panel/materias/[id]/alumnos/historial/_services/fetchHistorial.ts` — usar `attendance_closed_at` (dominio de asistencia).
4. `app/(docente)/panel/materias/[id]/alumnos/asistencia/_hooks/useAsistencia.ts` — usar `attendance_closed_at`.

**Acción de "Sellar" en Historial** (`app/(docente)/panel/materias/[id]/alumnos/historial/_hooks/useHistorial.ts`, función `confirmarCerrarUnidad`):
- Cambiar el `update` para escribir `attendance_closed_at: new Date().toISOString()` en vez de `is_closed: true`.
- Revisar el texto de confirmación/advertencia que se le muestra al docente antes de sellar: debe decir explícitamente **qué unidad** se va a sellar (número/título) y que **esto NO afecta la captura de calificaciones**, solo bloquea nueva asistencia en esa unidad. Como esta acción de verdad va a ser irreversible ahora (ya no hay ningún botón de "reabrir" que toque este campo), el texto de advertencia debe ser fuerte y explícito — mostrar el número/nombre de unidad en el propio texto del diálogo, no un genérico "¿sellar la unidad?".

**Acción "Cerrar Unidad"/"Reabrir Unidad" en Calificaciones→Captura** (`app/(docente)/panel/materias/[id]/calificaciones/_components/CaptureView.tsx`, `useCalificaciones.ts`, función `handleToggleCloseUnit`):
- Cambiar para escribir/leer `grades_closed_at` en vez de `is_closed`.
- Reemplazar el `confirm()` nativo por un modal propio (mismo patrón `feedback`/confirmación ya usado en el resto del proyecto) que muestre explícitamente **cuál unidad se va a cerrar** (usar el título/número de `selectedUnit`, no un texto genérico) — esto es directamente lo que causaba la confusión reportada por el docente ("cerré la Unidad 1 sin querer"). Mantener la reversibilidad (toggle abrir/cerrar) tal como está hoy para este dominio específico.

**Pantalla de creación de unidades** (`unidades/page.tsx`, modal "Nueva Unidad"): agregar una nota visible (no bloqueante) cuando ya existe una unidad anterior sin cerrar en asistencia o notas, explicando que esa unidad anterior debe cerrarse desde Historial/Calificaciones respectivamente para que el sistema considere "activa" a la nueva — objetivo: que el docente entienda el requisito ANTES de toparse con el bloqueo, no después.

## 3. Ponderación individual por examen

Mismo patrón visual/funcional que ya existe para tareas en `unidades/page.tsx` (sección "Actividades y Tareas", "Desglose por tarea" — usar como plantilla exacta la estructura actual de ese bloque).

### Backend/datos
- Columna `exams.weight_data` ya agregada en la migración de la sección 1 (jsonb, mismo espíritu que `assignments.rubric_data`). Estructura sugerida: `{"weight_percentage": number}` (igual forma que `rubric_data` de assignments).
- En `app/(docente)/panel/materias/[id]/unidades/_hooks/useUnidades.ts`:
  - Tipo `UnitExam`: agregar `weight_data: { weight_percentage?: number } | null`.
  - `fetchUnitsData`: incluir `weight_data` en el `.select()` de exams.
  - Agregar `handleUpdateExamWeight(examId: string, weight: number)` — análogo exacto a `handleUpdateAssignmentWeight`, pero hace `.from("exams").update({ weight_data: { ...currentData, weight_percentage: weight } }).eq("id", examId)`.
  - Extender `handleUpdateUnitFull` para recibir también `examWeights: Record<string, number>` (mismo patrón que `asgnWeights`) y persistirlos igual.

### Frontend — `unidades/page.tsx`
- En `UnitConfigModal`, agregar un bloque de desglose por examen DENTRO de la sección "Evaluaciones" idéntico en estructura al de "Desglose por tarea": lista de exámenes de la unidad, input de puntos por examen, suma visible contra el total del pilar, mismo estilo visual (ámbar en vez de azul — usar los mismos tonos que ya usa esa sección: `#fffbeb`/`#fde68a`/`#92400e`).
- Estado local `examWeights` en el modal (análogo a `asgnWeights`), inicializado desde `unitExams.map(e => e.weight_data?.weight_percentage ?? defaultExamW)` con reparto equitativo (`evalWeight / unitExams.length`) como default si no hay valor guardado.
- Pasar `examWeights` a `onSaveFull` (que ahora, tras el cambio de backend, también los recibe y persiste).

### Limpiar el vestigio en Calificaciones (confirmado que sigue ahí, pendiente)
- En `app/(docente)/panel/materias/[id]/calificaciones/_hooks/useCalificaciones.ts`: eliminar el estado local `examWeights` y `handleUpdateExamWeight` (líneas ~24, ~185, ~511, ~514 — el que nunca persistía nada en BD) — ya no hace falta, la fuente de verdad pasa a ser `exams.weight_data` real.
- En `CaptureView.tsx`: cambiar la lectura de peso por examen para usar `exam.weight_data?.weight_percentage` (del dato real ya persistido) en vez del `examWeights`/`defaultExamW` local — si no hay valor guardado, aplicar el mismo reparto equitativo como fallback de lectura (no como estado editable local).

## 4. Reglas de esta sesión (aplican igual)

- No hacer deploy ni `supabase db push` — el usuario autoriza después.
- `useEffect`+`useState` siempre, nunca `use()`/Suspense, en cualquier archivo tocado.
- Sin `alert()`/`confirm()` nativos nuevos — usar el patrón `feedback`/modal propio ya establecido.
- Cambio quirúrgico: no rediseñar visualmente pantallas más allá de lo que pide esta tarea.
