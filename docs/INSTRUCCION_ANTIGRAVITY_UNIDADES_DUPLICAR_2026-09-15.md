# Instrucción para Antigravity — Fix Unidad 1, badge duplicado, ponderación, duplicar examen

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-15
**Origen:** reportado por el docente en producción anoche (2026-09-14), diagnosticado con evidencia de código antes de escribir esta instrucción — no son hipótesis sin verificar.

Al terminar, reporta: archivos modificados (ruta completa), migración SQL si aplica, resultado de `npx tsc --noEmit` + `npm run build`.

---

## 1. 🔴 Error real al editar Unidad 1 (`23502: null value in column "id" of relation "activities"`)

**Causa raíz confirmada** (leída línea por línea antes de escribir esto, no es una suposición):

`app/(docente)/panel/materias/[id]/unidades/_hooks/useUnidades.ts`, dos lugares con el mismo patrón:
- `handleUpdateUnitPillars` (líneas ~153-159)
- `handleUpdateUnitFull` (líneas ~195-200)

```ts
const upserts = [
  { id: assistAct?.id, unit_id: unitId, name: "Asistencia", weight_percentage: assist },
  { id: activAct?.id, unit_id: unitId, name: "Actividades", weight_percentage: activ },
  { id: evalAct?.id, unit_id: unitId, name: "Evaluaciones", weight_percentage: evalw },
];
const { error } = await supabase.from("activities").upsert(upserts);
```

Si `assistAct`/`activAct`/`evalAct` no se encuentran (la unidad nunca tuvo esos 3 criterios creados — probable en Unidad 1, que es de antes de que `handleAdd` empezara a sembrar los 3 pilares automáticamente al crear una unidad nueva), `?.id` es `undefined`. Al serializar a JSON para el `upsert`, la propiedad se omite, Postgres intenta un INSERT sin `id`, y como `activities.id` no tiene `DEFAULT gen_random_uuid()` (confirmar con una consulta real a `information_schema.columns`/`pg_attrdef` antes de escribir la migración, no asumir), la inserción falla con `23502`. Esto explica por qué solo falla en unidades viejas sin sus 3 pilares — las unidades nuevas sí los tienen desde que se crean.

**Fix — dos partes:**

1. **Migración de datos** (backfill, no de esquema): `supabase/migrations/20260915010000_backfill_missing_unit_pillars.sql` — para cada `course_units` que no tenga los 3 criterios estándar (Asistencia/Actividades/Evaluaciones) en `activities`, insertarlos con los valores default 10/40/50 (mismo criterio que ya usa `handleAdd` al crear una unidad nueva). Antes de escribir el INSERT, correr una consulta de solo lectura para confirmar cuántas unidades reales están en este estado (probablemente solo Unidad 1, pero confirmar, podría haber más).
2. **Fix de código, para que esto no vuelva a pasar** nunca aunque falte un criterio: en ambos `upsert` de `useUnidades.ts`, filtrar el array antes de enviarlo, separando los que sí tienen `id` (van por `upsert` normal) de los que no (van por `insert` explícito, sin campo `id`, dejando que la BD lo genere — esto requiere que `activities.id` sí tenga default; si NO lo tiene, agregarlo en la misma migración: `alter table public.activities alter column id set default gen_random_uuid();`, confirmando primero con una consulta real que hoy no lo tiene).

Aplica el mismo patrón de fix a `app/(docente)/panel/materias/[id]/calificaciones/_hooks/useCalificaciones.ts` si tiene el mismo tipo de `upsert` con `id` opcional (revisar `handleUpdateUnitPillars` de ese archivo también, puede tener el mismo bug).

## 2. 🟡 Badge de unidad duplicado ("Unidad 1: Unidad 1") en Calificaciones

Confirmado por el usuario con captura en `https://eui-reaserch-plataform.vercel.app/panel/materias/[id]/calificaciones`. El selector de píldoras de unidad arma el texto como `Unidad ${unit_number}: ${nombre}` (ubicar el componente exacto — probablemente en `calificaciones/page.tsx`, el selector de unidades con las píldoras, buscar el template string que arma esta etiqueta). Cuando `nombre` es literalmente "Unidad 1" (el valor por defecto que se le da a una unidad sin título custom), el resultado es "Unidad 1: Unidad 1".

**Fix:** si `nombre` (case-insensitive, sin espacios extra) ya coincide con `Unidad ${unit_number}` o empieza con "unidad", mostrar solo `Unidad ${unit_number}` sin el `: ${nombre}` repetido. Si el nombre es distinto (ej. "Introducción y Fundamentos"), mostrar `Unidad ${unit_number}: ${nombre}` normal.

## 4. 🟢 Ponderación individual dentro de "Actividades" — probablemente se resuelve solo con el punto 1

El desglose por tarea dentro del pilar "Actividades" de una unidad (ej. 30 pts totales repartidos 5/15/7/3 entre 4 tareas) ya existe en `unidades/page.tsx` (`UnitConfigModal`, sección "Desglose por tarea") y en el backend (`assignments.rubric_data.weight_percentage`, `handleUpdateAssignmentWeight`). Es muy probable que el docente no pudiera ni llegar a usarlo por el error `23502` del punto 1, que bloqueaba el modal completo de configurar la Unidad 1.

**No implementar nada nuevo en este punto todavía** — después de aplicar el fix del punto 1, probar en producción (con la materia de prueba, "QA Red Team - Materia Prueba") si el desglose por tarea ya funciona normalmente en la Unidad 1. Si el usuario pide algo adicional al probarlo (ej. el mismo desglose pero para el pilar "Evaluaciones"), eso ya está especificado aparte en `docs/INSTRUCCION_ANTIGRAVITY_UNIDADES_CALIFICACIONES_2026-09-14.md` sección 4 — no mezclar con esta instrucción.

## 5. 🔴 Construir "Duplicar" para Exámenes (no existe todavía) — punto importante

Actividades ya tiene este feature (`DuplicateActivityModal.tsx`, modo "Copiar 1:1"), Evaluaciones no tiene nada equivalente — confirmado, no hay ningún archivo con "duplicar"/"duplicate" en `evaluaciones/`. Construir la versión 1:1 (copia exacta a otra materia/unidad) — la versión "Generar similar" (reabrir el chat de IA con el examen original como contexto) queda fuera de esta tarea, se especifica aparte si se pide después.

**Diferencia importante con Actividades — esto es más simple y más seguro:** guardar/duplicar un examen NO pasa por ninguna Edge Function con efectos secundarios (Drive/correo) — `useNuevaEvaluacion.ts` (líneas ~306-334) inserta el examen directo con el cliente de Supabase del navegador (`supabase.from("exams").insert(...)`, siempre en `status: "draft"`) y luego las preguntas en `questions` vía `buildQuestionRow` (`app/(docente)/panel/materias/[id]/evaluaciones/_components/questionMapping.ts:33`). Ni la creación de Google Form (`publish-exam-form`) ni la notificación de resultados (`notify-exam-results`) se disparan automáticamente — son acciones separadas que el docente dispara explícitamente después. Es decir, duplicar un examen así no tiene el riesgo de notificar a nadie por accidente — no hace falta ningún flag tipo `skip_notification`.

**Fix — construir el modal:**
1. Nuevo componente `DuplicateExamModal.tsx` en `app/(docente)/panel/materias/[id]/evaluaciones/[examId]/configuracion/_components/` (mismo patrón visual que `DuplicateActivityModal.tsx` — selector de materia destino + selector de unidad destino dentro de esa materia, botón "Copiar 1:1").
2. Botón "Duplicar a otra materia" en `evaluaciones/[examId]/configuracion/page.tsx` (el equivalente de "editar" para exámenes) que abre el modal — mismo lugar/patrón que Actividades tiene en su pantalla de editar.
3. Lógica de copia (en el modal o en un handler del hook de configuración):
   - Leer el examen original completo (`exams` + todas sus `questions` ordenadas por `order_index`) — probablemente ya se tiene cargado en `useConfiguracionExamen.ts`, reusar en vez de refetch si es posible.
   - Insertar un nuevo `exams` con `unit_id` de la materia/unidad destino, mismo `title` (o con sufijo "(copia)", usar criterio), `status: "draft"` siempre, fechas: usar un placeholder razonable (mismo criterio que Actividades usa +7 días, o dejar `start_at`/`end_at` vacíos para que el docente las defina al revisar — usar criterio, señalar la decisión en el reporte), copiar `randomize_questions`/`randomize_options`/`show_all_questions` tal cual.
   - Insertar las `questions` del examen nuevo copiando `q_type`, `content`, `options`, `correct_answer`, `points`, `order_index` de cada pregunta original (usar `buildQuestionRow` si aplica, o el mismo shape que espera la tabla).
   - NO copiar `exam_students` (audiencia restringida) — la audiencia es de la materia original, no tiene sentido en destino, igual que Actividades no copia equipos.
   - Al terminar, navegar a `evaluaciones/${targetCourseId}/${examId nuevo}/configuracion` (o el equivalente de "revisar la copia recién creada").
4. Verificar ownership: el docente debe ser dueño tanto del examen original como de la materia destino — esto ya se puede validar en el cliente (el selector de materia destino solo debería listar materias del propio docente, igual que ya hace `DuplicateActivityModal.tsx` — revisar cómo arma esa lista ahí y replicar).

## Reglas de esta sesión (aplican igual)

- No hacer deploy ni `supabase db push` — el usuario autoriza después.
- Antes de escribir cualquier migración, confirmar contra la BD real (`npx supabase db query --linked --file <archivo.sql>`, con `dangerouslyDisableSandbox: true` si hace falta) el estado real de `activities.id` (¿tiene default o no?) y cuántas unidades reales están sin sus 3 pilares — no asumir.
- `useEffect`+`useState` siempre, nunca `use()`/Suspense.
- Sin `alert()`/`confirm()` nativos nuevos.
- Cambios quirúrgicos — no toques nada fuera de los 4 puntos listados.
