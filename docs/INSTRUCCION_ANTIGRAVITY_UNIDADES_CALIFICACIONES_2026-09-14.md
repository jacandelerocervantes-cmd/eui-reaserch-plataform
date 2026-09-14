# Instrucción para Antigravity — Fix Unidades + limpieza Calificaciones + ponderación individual por examen

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-14
**Origen:** auditoría de esta sesión (investigación de solo lectura) encontró la causa raíz de 2 reportes del docente + confirmó un gap de feature. 4 decisiones de diseño ya confirmadas por el usuario — no reabrir esas discusiones, ejecutar directo.

Al terminar, reporta: archivos nuevos/modificados/eliminados (ruta relativa completa), migración SQL creada, resultado de `npx tsc --noEmit` + `npm run build`.

---

## Decisiones confirmadas (no cuestionar, ejecutar así)

1. **Eliminar el sistema duplicado de unidades dentro de Calificaciones** (código muerto, inalcanzable desde la UI real).
2. **Mantener el gate secuencial** de "una unidad activa a la vez", pero con mejor UX (avisos claros de qué se cierra y qué implica).
3. **Separar el campo único `course_units.is_closed`** en dos campos independientes: uno para asistencia, otro para calificaciones/notas.
4. **Construir la ponderación individual por examen** (columna nueva en `exams` + UI de desglose, mismo patrón visual que ya existe para tareas).

---

## 1. Eliminar código muerto en Calificaciones

Confirmado por auditoría: estos archivos/funciones NO están montados en ningún JSX real de `calificaciones/page.tsx` (verificar tú mismo con grep antes de borrar, por si acaso, pero está confirmado):

- Eliminar archivos completos:
  - `app/(docente)/panel/materias/[id]/calificaciones/_components/UnitsView.tsx`
  - `app/(docente)/panel/materias/[id]/calificaciones/_components/NewUnitModal.tsx`
  - `app/(docente)/panel/materias/[id]/calificaciones/_components/SabanaView.tsx`
  - `app/(docente)/panel/materias/[id]/calificaciones/_components/NewActivityModal.tsx` (confirmar que tampoco está montado antes de borrar — si sí lo está, no tocarlo y reportarlo)
- En `app/(docente)/panel/materias/[id]/calificaciones/_hooks/useCalificaciones.ts`, eliminar (confirmar antes de cada una que ningún componente montado la usa):
  - `handleAddUnit`, `unitCriteria`, `handleAddUnitCriterion`, `handleRemoveUnitCriterion`, `handleUpdateUnitCriterion`
  - `openAddActivityModal`, `openEditActivityModal`, `handleAddActivity`, `handleDeleteActivity`
  - `handleOpenSabana`, `toggleLockSabana`, `getUnitTotalWeight`
  - El estado `newUnitName`/`openNewUnitModal` y cualquier otro estado que solo alimentaba estas funciones muertas.
- **No tocar** `handleToggleCloseUnit` (línea ~436-451) — esa sí está en uso real desde `CaptureView.tsx`, pero se va a modificar en la sección 3 de este documento (separación de campos), no se elimina.
- **No tocar** `examWeights`/`handleUpdateExamWeight` todavía — se reemplazan por la feature real en la sección 4, no se borran sin más.

## 2. Migración de base de datos — separar `is_closed` en dos campos

Archivo nuevo: `supabase/migrations/20260914060000_unidades_calificaciones_fix.sql` (NO ejecutar `supabase db push`, dejar listo para revisión).

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

**No borrar `is_closed`/`closed_at` en esta migración** — dejarlas como columnas vestigiales sin usar (igual criterio que se aplicó con `courses.allow_student_comments` en la tarea de Tablón: evitar `DROP COLUMN` innecesario). Revisar el nombre real de la columna `closed_at` en el esquema actual antes de escribir el `UPDATE` (el hook `useUnidades.ts` la tipa como `closed_at: string | null` — confirmar que existe tal cual en la tabla real, dado que ya se detectó drift de esquema en esta auditoría; si no existe, ajustar el `UPDATE` para no referenciarla).

## 3. Separar la lógica de "unidad activa" — asistencia vs. calificaciones

Los 4 puntos que hoy calculan "unidad activa" a partir de `is_closed` deben pasar a usar el campo específico según su dominio:

1. `app/(docente)/panel/materias/[id]/unidades/_hooks/useUnidades.ts:213` — `activeUnit = units.find(u => !u.is_closed)`. Esta pantalla es de configuración general (título/sesiones/pesos), no específica de asistencia ni notas — mantenerla usando AMBOS campos: una unidad se considera "abierta" aquí solo si ninguno de los dos (`attendance_closed_at`/`grades_closed_at`) está seteado (para no permitir "reconfigurar" una unidad que ya se cerró en cualquiera de los dos procesos). Ajustar el tipo `CourseUnit` para incluir los nuevos campos.
2. `app/(docente)/panel/materias/[id]/calificaciones/page.tsx:22` — usar `grades_closed_at` (dominio de notas).
3. `app/(docente)/panel/materias/[id]/alumnos/historial/_services/fetchHistorial.ts:19` — usar `attendance_closed_at` (dominio de asistencia).
4. `app/(docente)/panel/materias/[id]/alumnos/asistencia/_hooks/useAsistencia.ts:56-63` — usar `attendance_closed_at`.

**Acción de "Sellar" en Historial** (`app/(docente)/panel/materias/[id]/alumnos/historial/_hooks/useHistorial.ts:162-181`, `confirmarCerrarUnidad`):
- Cambiar el `update` para escribir `attendance_closed_at: new Date().toISOString()` en vez de `is_closed: true`.
- Revisar el texto de confirmación/advertencia que se le muestra al docente antes de sellar: debe decir explícitamente **qué unidad** se va a sellar (número/título) y que **esto NO afecta la captura de calificaciones**, solo bloquea nueva asistencia en esa unidad. Como esta acción de verdad va a ser irreversible ahora (ya no hay ningún botón de "reabrir" que toque este campo), el texto de advertencia debe ser fuerte y explícito — mostrar el número/nombre de unidad en el propio texto del diálogo, no un genérico "¿sellar la unidad?".

**Acción "Cerrar Unidad"/"Reabrir Unidad" en Calificaciones→Captura** (`app/(docente)/panel/materias/[id]/calificaciones/_components/CaptureView.tsx:76-83`, `useCalificaciones.ts:436-451`, `handleToggleCloseUnit`):
- Cambiar para escribir/leer `grades_closed_at` en vez de `is_closed`.
- Mejorar el `confirm()` nativo (línea 440-444) — reemplazar por un modal propio (mismo patrón `feedback`/confirmación ya usado en otras tareas de esta sesión) que muestre explícitamente **cuál unidad se va a cerrar** (usar el título/número de `selectedUnit`, no un texto genérico) — esto es directamente lo que causaba la confusión reportada por el docente ("cerré la Unidad 1 sin querer"). Mantener la reversibilidad (toggle abrir/cerrar) tal como está hoy para este dominio específico.

**Pantalla de creación de unidades** (`unidades/page.tsx`, modal "Nueva Unidad", líneas ~343-379): agregar una nota visible (no bloqueante) cuando ya existe una unidad anterior sin cerrar en asistencia o notas, explicando que esa unidad anterior debe cerrarse desde Historial/Calificaciones respectivamente para que el sistema considere "activa" a la nueva — objetivo: que el docente entienda el requisito ANTES de toparse con el bloqueo, no después.

## 4. Ponderación individual por examen

Mismo patrón visual/funcional que ya existe para tareas en `unidades/page.tsx` (sección "Actividades y Tareas", líneas 225-261 del archivo actual — usar como plantilla exacta).

### Backend/datos
- Columna `exams.weight_data` ya agregada en la migración de la sección 2 (jsonb, mismo espíritu que `assignments.rubric_data`). Estructura sugerida: `{"weight_percentage": number}` (igual forma que `rubric_data` de assignments, para reusar el mismo patrón de código).
- En `app/(docente)/panel/materias/[id]/unidades/_hooks/useUnidades.ts`:
  - Tipo `UnitExam` (línea 27-31): agregar `weight_data: { weight_percentage?: number } | null`.
  - `fetchUnitsData` (línea 69-73): incluir `weight_data` en el `.select()` de exams.
  - Agregar `handleUpdateExamWeight(examId: string, weight: number)` — análogo exacto a `handleUpdateAssignmentWeight` (línea 163-170), pero hace `.from("exams").update({ weight_data: { ...currentData, weight_percentage: weight } }).eq("id", examId)`.
  - Extender `handleUpdateUnitFull` (línea 172-211) para recibir también `examWeights: Record<string, number>` (mismo patrón que `asgnWeights`) y persistirlos igual que se hace con `asgnWeights` (líneas 199-205).

### Frontend — `unidades/page.tsx`
- En `UnitConfigModal`, agregar un bloque de desglose por examen DENTRO de la sección "Evaluaciones" (líneas 263-282 actuales) idéntico en estructura al de "Desglose por tarea" (líneas 225-261): lista de exámenes de la unidad, input de puntos por examen, suma visible contra el total del pilar, mismo estilo visual (ámbar en vez de azul, para diferenciarlo del pilar de actividades — usar los mismos tonos que ya usa esta sección: `#fffbeb`/`#fde68a`/`#92400e`).
- Estado local `examWeights` en el modal (análogo a `asgnWeights` línea 64-70), inicializado desde `unitExams.map(e => e.weight_data?.weight_percentage ?? defaultExamW)` con reparto equitativo (`evalWeight / unitExams.length`) como default si no hay valor guardado — mismo criterio que ya usa `defaultAsgnW` (línea 63).
- Pasar `examWeights` a `onSaveFull` (que ahora, tras el cambio de la sección backend, también los recibe y persiste).

### Limpiar el vestigio en Calificaciones
- En `app/(docente)/panel/materias/[id]/calificaciones/_hooks/useCalificaciones.ts`: eliminar el estado local `examWeights` y `handleUpdateExamWeight` (el que nunca persistía nada, línea ~47 y ~189-191) — ya no hace falta, la fuente de verdad pasa a ser `exams.weight_data` real.
- En `CaptureView.tsx` (líneas 136, 193, 267 según la auditoría): cambiar la lectura de peso por examen para usar `exam.weight_data?.weight_percentage` (del dato real ya persistido, traído por el fetch de la unidad/exámenes) en vez del `examWeights`/`defaultExamW` local — si no hay valor guardado, aplicar el mismo reparto equitativo como fallback de lectura (no como estado editable local).

## 5. Resolver el schema drift detectado (documentar, no adivinar)

La auditoría encontró que la tabla real `course_units` en producción tiene columnas (`title`, `total_sessions`) que no existen en ninguna migración versionada — alguien las agregó directo en el dashboard de Supabase en algún momento. Antes de escribir la migración de la sección 2:
- Correr una consulta de solo lectura contra el esquema real (`information_schema.columns` para `course_units` y `exams`) para confirmar el estado actual exacto antes de escribir `ALTER TABLE`/`ADD COLUMN IF NOT EXISTS` — así la migración no falla ni asume de más.
- Si encuentras columnas reales no documentadas en ninguna migración, agrégalas también a esta misma migración nueva como `add column if not exists` (documentando lo que ya existe, sin cambiar su tipo/default) para que las migraciones vuelvan a reflejar el estado real — mismo criterio ya aplicado en `20260914040000_sync_exams_course_id.sql` de esta sesión.

## 6. Reglas de esta sesión (aplican igual)

- No hacer deploy ni `supabase db push` — el usuario autoriza después.
- `useEffect`+`useState` siempre, nunca `use()`/Suspense, en cualquier archivo tocado.
- Sin `alert()`/`confirm()` nativos nuevos — usar el patrón `feedback`/modal propio ya establecido.
- Cambio quirúrgico: no rediseñar visualmente pantallas más allá de lo que pide esta tarea (esto es fix de bugs + una feature puntual, no una repintada general de Calificaciones — eso, si hace falta, es una tarea aparte a decidir después).
