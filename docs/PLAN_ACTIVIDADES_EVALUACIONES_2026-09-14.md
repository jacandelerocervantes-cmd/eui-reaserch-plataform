# Plan — Módulo Actividades y Evaluaciones (EUI)
**Fecha:** 2026-09-14
**Fuentes:** `docs/TRASPASO_ACTIVIDADES_2026-09-14.md` (contexto/roadmap), sesión de diseño en Claude.ai normal (arquitectura de creación por chat), auditoría de código de esta sesión (docente/actividades + docente/evaluaciones, Edge Functions y migraciones asociadas).

Este documento junta dos cosas que hasta ahora vivían separadas: **qué queremos que el módulo llegue a ser** (rediseño conversacional, decidido en Claude.ai) y **qué tan roto está lo que ya existe hoy** (auditoría de código de esta sesión, solo lectura). Sirve de punto de partida para la siguiente sesión de implementación — no se tocó código en ninguna de las dos partes.

---

## Parte 1 — Hacia dónde vamos: creación por chat con IA

Decidido en sesión aparte de diseño (Claude.ai), sin tocar código. Cambia **cómo se crean** actividades y exámenes; no resuelve por sí solo los bugs/seguridad de la Parte 2.

### Decisión central
El modal/formulario actual (`nueva/page.tsx` de Actividades, `nuevo/page.tsx` de Evaluaciones) **no desaparece, cambia de rol**: de "herramienta para crear desde cero" pasa a ser la pantalla de **"Resultado"** — donde el docente ve cómo quedó lo que generó el chat, con el mismo diseño visual de hoy (solo cambia título/contexto). La creación real pasa a un **chat con IA**.

### Flujo de creación — Exámenes
1. El docente inicia el chat. Puede adjuntar material (PDF, PPT, Word o imagen — ej. foto de apuntes/pizarrón) **o** describir el tema en texto libre; el material es opcional.
2. El chat pregunta en orden fijo: (1) tema o archivo, (2) cantidad de preguntas, (3) dificultad general (punto de partida, no definitivo), (4) tipos de pregunta deseados.
3. Mientras genera, muestra mensajes de estado por etapa ("Leyendo el PDF...", "Identificando temas...", "Redactando preguntas...") y un contador ("Pregunta 3 de 10").
4. Cada pregunta aparece como **tarjeta inline en el mismo hilo**, colapsada por defecto (enunciado + tipo), expandible para ver opciones/respuesta correcta, con controles de editar / regenerar / cambiar dificultad.
5. La dificultad se ajusta **pregunta por pregunta** después de generadas, no solo a nivel global.
6. El docente puede pedir una pregunta específica por texto libre dentro del mismo hilo ("agrega una de opción múltiple sobre...") — no hay editor de formulario aparte para esto.
7. Si la IA no puede leer el material (escaneado borroso, archivo corrupto), el chat ofrece ambas salidas: reintentar con otro archivo, o continuar solo con descripción en texto.
8. El examen se marca explícitamente como **"Borrador"** mientras se trabaja.
9. El docente se queda ajustando en el chat lo que quiera; solo al presionar **"Guardar examen"** se confirma y navega a la pantalla de Resultado.

### Flujo de creación — Actividades
Mismo mecanismo de chat, pero más simple: no genera tarjetas ni tipos de pregunta. Solo ayuda a **redactar instrucciones y rúbrica en texto libre** — asistente de redacción, no generador de estructura compleja.

### Pantalla de Resultado
Visualmente casi idéntica al modal actual; solo cambia el título/contexto ("así quedó", no "estoy creando"). No se definió aún si la edición ahí es directa, por chat, o híbrida — pendiente de profundizar en otra sesión si hace falta.

### Duplicar a otra materia
- Botón "Duplicar" vive en la pantalla de **Resultado**, no en el listado.
- Dos modos: **1:1** (copia exacta, solo cambia la materia; fechas se ajustan después como cualquier examen/actividad) o **Generar similar** (reabre el chat con el original como contexto precargado, para pedir ajustes conversacionales — "más difícil", "cambia 3 preguntas" — antes de guardar en la nueva materia; pasa por el mismo flujo de chat, incluyendo estado "Borrador" hasta "Guardar").
- Esto resuelve directamente el pendiente #3 de `TRASPASO_ACTIVIDADES_2026-09-14.md` ("no existe forma de exportar/duplicar una actividad o examen ya creado hacia otro grupo/materia").

### Notas técnicas para cuando se implemente
- Requiere extracción de texto de PDF/PPT/Word/imagen (posible OCR para imágenes) + llamada a un modelo de IA para generar preguntas/rúbricas — probablemente una nueva Edge Function.
- Evaluar generar primero un borrador estructurado (JSON) antes de renderizar las tarjetas, para que "regenerar una pregunta" sea una operación aislada y no reprocese todo el examen.
- Definir si el estado "Borrador" se persiste en base de datos como borrador real o se mantiene solo en cliente hasta "Guardar".

### ✅ Actividades — chat de rúbrica implementado y desplegado (2026-09-14)
Primera rebanada del rediseño (Actividades, más simple que Exámenes): el botón único "Autogenerar con IA" de `RubricSection.tsx` se reemplazó por un chat multi-turno.
- **`generate-rubric-ia`** (Edge Function) extendida: acepta `instruction` + `current_rubrics` opcionales — si ya hay una rúbrica trabajada en el chat, el prompt le pide a Gemini **ajustarla** (conservando criterios no mencionados) en vez de regenerar desde cero.
- **`ActivityChatAssistant.tsx`** (nuevo): hilo de conversación con mensaje inicial, input + adjuntar archivo, estado "Pensando la rúbrica...".
- **Tarjetas de criterio expandibles**: cada una tiene un botón (`Maximize2`/`Minimize2`) integrado en su propia fila (sin caja/borde aparte) que crece el textarea de 2 a 6 filas — feedback del usuario tras ver que el espacio por defecto era muy chico. Ajuste de diseño posterior: al inicio expandir una tarjeta la hacía ocupar toda la fila del grid (`gridColumn: 1/-1`), lo que desacomodaba a las demás — corregido para que cada tarjeta crezca de forma independiente, sin afectar a sus vecinas.
- **`alert()` nativos reemplazados por toast propio**: los 12 `alert()` de `useNuevaActividad.ts` (validaciones + éxito/error de guardado + puzzle) se reemplazaron por un `feedback: {type, message}` con auto-dismiss a 4s, igual patrón que ya usan Asistencia/Historial — pero renderizado como **toast fijo en la esquina superior derecha** (`position: fixed`), no como banner inline, porque el formulario es largo con scroll y un banner al inicio del documento no se ve si el docente está desplazado hasta el botón "Guardar" al final.
- Verificado en producción de punta a punta: generación inicial (4 criterios, 100%), ajuste conservando contexto (agregó un 5º criterio de trabajo en equipo sin perder los 4 anteriores), expandir/contraer tarjeta, y guardado real de una actividad de prueba sin ningún `alert()` nativo.
- **✅ Resuelto (2026-09-14)**: se creó [`components/ui/DateTimeFieldMX.tsx`](../components/ui/DateTimeFieldMX.tsx), un selector de fecha propio con segmentos DD/MM/AAAA · HH:mm (auto-avance entre segmentos, clamps de rango), que reemplaza el `<input type="datetime-local">` nativo en los 6 lugares donde se usaba: `actividades/nueva` y `actividades/[id]/editar` (Fecha de Entrega), `evaluaciones/nuevo` y `evaluaciones/[examId]/configuracion` (Inicio/Fin ×2 cada uno). Produce el mismo string `YYYY-MM-DDTHH:mm` que ya esperaban las Edge Functions/BD, así que fue un reemplazo directo sin tocar validaciones. Verificado en producción con datos reales (`soft_deadline: 2026-12-31 23:59:00`, no invertido).

**✅ Chat también redacta instrucciones (2026-09-14)**: `generate-rubric-ia` ahora devuelve `{instructions, rubrics}` en un solo turno — el prompt le pide a Gemini redactar/ajustar las instrucciones para el alumno (texto plano, 3-6 oraciones) junto con la rúbrica, usando el mismo mecanismo de "ajustar lo existente en vez de reemplazar" que ya tenía la rúbrica. El hook aplica `data.instructions` a `formData.description` automáticamente cuando viene presente. Verificado en producción: un solo mensaje ("Es individual, 800-1000 palabras, debe citar al menos 3 fuentes académicas") generó tanto el texto de instrucciones en el campo correcto como una rúbrica de 4 criterios sumando 100%.

**✅ Duplicar a otra materia — implementado, con hallazgo mayor (2026-09-14)**
- Nuevo modal `DuplicateActivityModal.tsx` en la pantalla de edición de una actividad ya guardada (equivalente de "Resultado" para algo existente): elige materia destino, y dos modos — **Copiar 1:1** (llama a `create-assignment-hub` con el mismo título/instrucciones/rúbrica, fecha provisional +7 días, equipos no se copian) o **Generar similar** (deja el original en `sessionStorage` y reabre el chat de creación en la materia destino, precargado con `hasGeneratedRubric=true` para que el primer ajuste conserve el contexto en vez de regenerar desde cero).
- **Hallazgo mayor durante la prueba**: la pantalla "Editar Actividad" tenía un bug preexistente que bloqueaba **absolutamente todos los clics** (selectores de modalidad, candado de asistencia, Añadir/Quitar Criterio, "Regenerar con IA", "Cancelar" — confirmado con `console.log` inyectado directo en el handler: nunca se ejecutaba pese a que el evento nativo sí llegaba al DOM). Escribir texto sí funcionaba. Causa raíz: `useEditarActividad.ts` leía sus datos con `use(resource)` (Suspense) en vez del patrón `useEffect`+`useState` que ya usa `useNuevaActividad.ts` sin problemas — cambiar al segundo patrón resolvió el bug por completo, verificado en producción (los 3 selectores, el candado y el modal de Duplicar ya responden).
- Verificado en producción de punta a punta: actividad duplicada 1:1 desde "QA Red Team" hacia "PRUEBA 1", con la fecha provisional correcta y la rúbrica copiada.
- Ajuste de diseño tras feedback: los botones del modal se acortaron ("Copiar 1:1 (mismo contenido)" → "Copiar 1:1", "Generar similar (con chat)" → "Generar similar") y el texto de ayuda se redujo a una sola línea.

Con esto, las 3 tareas pedidas para esta sesión (fecha dd/mm/aaaa, chat que también redacta instrucciones, Duplicar a otra materia) quedan completas y verificadas en producción para el módulo de Actividades.

---

## 🔄 TRASPASO PARA NUEVA SESIÓN (contexto agotado 2026-09-14, ~87% límite de 5h / ~81% ventana de contexto)

### Estado: todo lo desplegado está verificado y funcionando en producción. Nada roto pendiente de rollback.

### Pendiente, en orden sugerido:

**1. Evaluaciones (exámenes) — el rediseño de chat nunca se aplicó aquí.** Todo el trabajo de esta sesión (chat multi-turno, DateTimeFieldMX para fechas, Duplicar) fue exclusivamente para **Actividades**. Evaluaciones sigue con:
   - `nuevo/page.tsx` + `AIPromptBar.tsx`: un solo prompt de un turno (no chat conversacional), llama a una función distinta a `generate-rubric-ia` — hay que revisar cuál Edge Function usa (`generate-exam-ia` o similar, no confirmado en esta sesión) antes de replicar el patrón de "ajustar en vez de regenerar" que sí se hizo en `generate-rubric-ia`.
   - Sin botón "Duplicar" en `[examId]/configuracion/page.tsx` (el equivalente de "editar" para exámenes).
   - Los selectores de fecha (`PropertiesPanel.tsx`, `configuracion/page.tsx`) **ya usan `DateTimeFieldMX`** (se hizo en esta sesión) — eso no falta.
   - Antes de tocar código: confirmar con el usuario si quiere el mismo patrón de chat que Actividades, o algo distinto dado que Evaluaciones genera reactivos estructurados (tarjetas de pregunta), no solo texto+rúbrica — el documento de diseño original (`TRASPASO_DISEÑO_ACTIVIDADES_EXAMENES_2026-09-14.md`, ya consumido, contenido resumido en la Parte 1 de este archivo) especifica un flujo más elaborado para Exámenes (tema→cantidad→dificultad→tipos, tarjetas colapsables, estado "Borrador").

**2. Limpieza de paleta/`alert()`/`StatCard` en Evaluaciones** (nunca absorbida por el rediseño de Actividades):
   - Azul genérico `#2563eb`/`#eff6ff` en 8 puntos de Evaluaciones.
   - ~20 `alert()` nativos sin reemplazar por el patrón de toast/banner ya usado en Asistencia y ahora en Actividades (`feedback: {type, message}` con auto-dismiss).
   - `StatCard` duplicado con fórmula de color distinta entre Actividades y Evaluaciones — considerar componente compartido.

**3. ⚠️ Hallazgo crítico sin investigar — riesgo sistémico de clics rotos.** El bug raíz de esta sesión (ningún `onClick` funcionaba en "Editar Actividad") venía de `useEditarActividad.ts` usando `const result = use(resource)` (Suspense) en vez de `useEffect`+`useState`. Se corrigió SOLO ese archivo. Un grep encontró **18 archivos** en `app/(docente)` que importan `use` de React o tienen `const result = use(...)` — **no se verificó cuáles de ellos tienen controles interactivos (botones/toggles/selectores) que podrían sufrir el mismo bug silencioso**. Lista completa para auditar:
   - `evaluaciones/[examId]/resultados/page.tsx`
   - `evaluaciones/[examId]/revision/[studentId]/_hooks/useRevisionExamen.ts`
   - `alumnos/page.tsx`
   - `alumnos/historial/_hooks/useHistorial.ts`
   - `actividades/[assignmentId]/auditoria/[submissionId]/page.tsx`
   - `alumnos/riesgo/_hooks/useRiesgoAcademico.ts`
   - `investigacion/proyectos/[id]/_hooks/useProyectoDetalle.ts`
   - `investigacion/config/page.tsx`
   - `investigacion/_hooks/useEscritorioInvestigacion.ts`
   - `campo/misiones/[id]/_hooks/useMisionDetalle.ts`
   - `panel/materias/[id]/_hooks/useTablon.ts`
   - `actividades/[assignmentId]/page.tsx`
   - `actividades/page.tsx`
   - `alumnos/equipos/_hooks/useEquipos.ts`
   - `drive/_hooks/useDriveMateria.ts`
   - `evaluaciones/_hooks/useEvaluaciones.ts`
   - `evaluaciones/[examId]/_hooks/useEvaluacionDetalle.ts`
   - `unidades/_hooks/useUnidades.ts`

   **Cómo probar rápido cada una**: abrir la pantalla en producción, intentar cualquier interacción por clic (toggle, botón, selector visual — no un `<input>` de texto), y confirmar que el estado visual cambia. Si no cambia, aplicar el mismo fix: reemplazar `use(resource)`/Suspense por `useEffect` que llena `useState` al resolver la promesa (ver `useEditarActividad.ts` como plantilla ya corregida, o `useNuevaActividad.ts` como el patrón original que nunca tuvo el bug).

**3.5. ⚠️ Mismo bug de clics rotos confirmado en el lado ALUMNO — pendiente para cuando se aborde ese módulo.** Al corregir el Tablón de Alumno (2026-09-14, sesión de Antigravity) se detectó que 8 archivos más de `app/(alumno)/**` usan el mismo patrón `use(resource)`/Suspense nunca auditado en esta sesión (la auditoría de los 18 fue solo `app/(docente)`). Dos son críticos porque bloquean el flujo académico del alumno si los clics no responden:
   - `app/(alumno)/alumno/materia/[id]/entregar/[assignmentId]/page.tsx` (líneas ~25, ~345) — **entregar una actividad**.
   - `app/(alumno)/alumno/materia/[id]/presentar/[examId]/page.tsx` (líneas ~20, ~250) — **presentar un examen**.
   Resto (menor urgencia pero mismo patrón, confirmar controles clicables reales antes de asumir severidad):
   - `app/(alumno)/alumno/invitacion/page.tsx` (líneas ~86, ~316)
   - `app/(alumno)/alumno/materia/[id]/actividades/page.tsx` (líneas ~154, ~243)
   - `app/(alumno)/alumno/materia/[id]/asistencia/page.tsx` (líneas ~57, ~183)
   - `app/(alumno)/alumno/materia/[id]/calificaciones/page.tsx` (líneas ~334, ~576)
   - `app/(alumno)/alumno/materia/[id]/evaluaciones/page.tsx` (líneas ~164, ~259)
   - `app/(alumno)/alumno/materia/[id]/material/page.tsx` (líneas ~96, ~185)
   **Decisión de la sesión (2026-09-14):** se queda documentado aquí, NO se ataca todavía — el foco actual sigue siendo cerrar el módulo docente. Retomar esto como primer punto al empezar a trabajar el lado alumno, mismo patrón de fix ya usado 18 veces (`useEffect`+`useState`, ver `useEditarActividad.ts`/`actividades/[assignmentId]/page.tsx` como plantilla).

**4. Nunca sincronizado a GitHub.** Todo el trabajo de esta sesión y la anterior se hizo directo sobre el snapshot local (`EUI-Docencia-Plataforma/eui-reaserch-plataform-main/`, sin `.git`) + deploy directo a Vercel/Supabase. El repo remoto (`jacandelerocervantes-cmd/eui-reaserch-plataform`, rama `main`) sigue sin todos estos cambios. Para sincronizar: clonar aparte en el scratchpad, copiar solo los archivos que coinciden en ruta, comitear y hacer push — como se documentó en `docs/QA_RED_TEAM_DOCENTE_2026-09-14.md`.

### Archivos nuevos creados en esta sesión (por si el diff con GitHub los marca como "no existen" del lado remoto):
- `components/ui/DateTimeFieldMX.tsx`
- `app/(docente)/panel/materias/[id]/actividades/nueva/_components/ActivityChatAssistant.tsx`
- `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/editar/_components/DuplicateActivityModal.tsx`
- `supabase/migrations/20260914020000_drop_dead_exam_course_id_policies.sql`
- `supabase/migrations/20260914030000_fix_evaluation_responses_missing_policy.sql`
- `supabase/migrations/20260914040000_sync_exams_course_id.sql`

### Reglas operativas (sin cambios de la sesión anterior):
- Cualquier escritura a producción (deploy Vercel, deploy Edge Function, migración) requiere confirmación explícita del usuario antes de ejecutar.
- Login/consentimiento de Google lo hace el usuario, nunca el agente.
- Materia de prueba: "QA Red Team - Materia Prueba" (`ba00005d-e964-4d02-806b-62f2163baa8f`) — usarla para cualquier prueba nueva en vivo.

### Explícitamente fuera de alcance del rediseño
Todo lo de la Parte 2 (bugs de revisión/calificación, IDOR, RLS) son bugs de código, no decisiones de diseño — van directo al backlog de implementación, no pasan por el rediseño conversacional.

---

## Parte 2 — Qué tan roto está lo que existe hoy (auditoría de código, solo lectura)

Alcance: pantallas/componentes de `docente/actividades` y `docente/evaluaciones`, sus Edge Functions y migraciones, contra las 6 reglas de diseño ya acordadas (cierre de modales, botones eliminar, expand buttons, paleta navy, sin jerga técnica, sin texto redundante) y contra el patrón IDOR ya conocido de `notify-exam-results`.

### ✅ Seguridad — resuelto y verificado en producción (2026-09-14)

1. **IDOR en `analyze-exam-group-results`** — [`supabase/functions/analyze-exam-group-results/index.ts`](../supabase/functions/analyze-exam-group-results/index.ts). Solo validaba `verifyDocente`, nunca `verifyCourseOwnership`. **Corregido y desplegado** (v73): ahora valida ownership vía `unit_id → course_units → courses` antes de devolver los resultados agregados del grupo.
2. **IDOR en `notify-exam-results`** — [`supabase/functions/notify-exam-results/index.ts`](../supabase/functions/notify-exam-results/index.ts). Un docente podía disparar el envío de correos con calificaciones reales a alumnos de otro docente. **Corregido y desplegado** (v40), mismo patrón.
3. **RLS confirmado en producción** sobre `submissions`, `exams`, `questions`, `evaluation_responses`, `exam_students` — las 5 tablas tienen `relrowsecurity = true` con políticas que filtran por `teacher_id = auth.uid()` vía `course_units`/`courses`. Verificado con consulta directa (`pg_class`/`pg_policies`), no había ningún hueco real.
4. **Chequeo de ownership condicional en `bulk-evaluate-exams`** — [`supabase/functions/bulk-evaluate-exams/index.ts`](../supabase/functions/bulk-evaluate-exams/index.ts). Estaba envuelto en `if (exam.course_id)`; se confirmó con datos que `exams.course_id` es `NULL` en el 100% de los registros reales (2/2) — es decir, el chequeo de ownership se saltaba **siempre**, no solo "en algún caso". **Corregido y desplegado** (v73): ahora resuelve el curso vía `unit_id → course_units.course_id` sin condicional, cubriendo el 100% de los exámenes reales.

**Hallazgo colateral, ya limpiado**: `exams` en producción tiene columnas (`course_id`, `questions_count`, `show_all_questions`, `deployment_method`, `google_form_id/url/edit_url`) que no existen en ninguna migración rastreada — deriva de esquema no documentada, mismo patrón que las 9 migraciones "pendientes" reconciliadas en la sesión anterior. Como consecuencia había 4 políticas RLS viejas (`docente_manage_exams` en `exams`, `docente_manage_eval_responses`/`docente_own_eval_responses` en `evaluation_responses`, `docente_manage_questions` en `questions`) que filtraban por `exams.course_id`, columna siempre `NULL` — estaban efectivamente muertas (nunca otorgaron acceso a nadie).

**Eliminadas en `20260914020000_drop_dead_exam_course_id_policies.sql`** (desplegado y verificado). Al revisar, se descubrió que `evaluation_responses` — a diferencia de `exams`/`questions` — **nunca tuvo una política de reemplazo funcional**: sus dos únicas políticas eran las muertas, así que la tabla estaba 100% bloqueada por RLS para cualquier cliente del navegador (docente o alumno) desde antes de esta sesión — un bug preexistente, no introducido por la limpieza. Pantallas afectadas: `resultados/page.tsx`, `useCalificaciones.ts`, `useEvaluacionDetalle.ts`, `useRevisionExamen.ts` (todas usan el cliente del navegador, sujeto a RLS). Corregido agregando la política faltante en `20260914030000_fix_evaluation_responses_missing_policy.sql` (mismo patrón `unit_id → course_units → courses`), desplegada y verificada.

**Actualización — NO se borró la columna.** Al revisar antes de borrar (como pidió el usuario), se encontró que `exams.course_id` sí se usa activamente en 6+ lugares que asumían que estaba poblada, causando bugs silenciosos reales mientras estuvo en `NULL`:
- `useCalificaciones.ts`: la pantalla de Calificaciones nunca mostraba exámenes.
- `detect-exam-anomalies`, `mcp-server`: `verifyCourseOwnership(null, ...)` siempre fallaba → **todo docente real recibía 403** (denegación falsa, dirección opuesta al IDOR).
- `compute-student-risk-signals`: "historial de exámenes" para riesgo académico siempre vacío.
- `validate-ai-grading`: la calibración segmentada por curso nunca encontraba exámenes, caía siempre al fallback global.
- `useNuevaEvaluacion.ts`: al crear un examen nuevo solo se guardaba `unit_id`, nunca `course_id` — el problema se repetiría con cada examen nuevo.

**Corregido en `20260914040000_sync_exams_course_id.sql`** (desplegado y verificado): backfill de `course_id` en los exámenes existentes desde `unit_id → course_units.course_id`, más un trigger (`trg_sync_exam_course_id`) que lo mantiene sincronizado en cada insert/update de `exams` hacia adelante — cubre el código ya auditado y cualquier flujo futuro (incluyendo el chat de creación por IA de la Parte 1) sin depender de que cada lugar recuerde setear el campo. Verificado en producción: los 2 exámenes reales ya tienen `course_id` correcto y el trigger está activo.

### 🔴 Bugs funcionales

- En Revisión de examen, **"Marcar Error en Entrega" nunca se guarda** ([`useRevisionExamen.ts:174`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/revision/[studentId]/_hooks/useRevisionExamen.ts)).
- En Resultados, **el buscador de alumnos es decorativo, no filtra nada** ([`resultados/page.tsx:239`](../app/(docente)/panel/materias/[id]/evaluaciones/[examId]/resultados/page.tsx)).
- En el simulador, las preguntas tipo **"Relación de columnas" son imposibles de responder** (`value=""` en todas las opciones).
- `useNuevaActividad.ts` dispara sus 6 queries de carga **dos veces** por una duplicación `useCallback`+`useEffect` (condición de carrera).

Nota: estos bugs viven en pantallas (revisión, resultados, simulador) que la Parte 1 no toca — siguen siendo necesarios sin importar cómo cambie la creación.

### 🟡 Diseño/UI — inconsistente con las 6 reglas ya acordadas

- Azul genérico `#2563eb`/`#eff6ff` sigue muy presente en Evaluaciones (8 puntos distintos) y en menor medida Actividades — la limpieza de paleta de la sesión anterior nunca llegó a este módulo.
- `NewActivityModal.tsx` tiene el patrón invertido: botón "Cancelar" de texto y sin X de cierre.
- ~20 `alert()` nativos y 1 `confirm()` sin reemplazar — el trabajo de banners que sí se hizo en Asistencia nunca tocó Actividades/Evaluaciones.
- `StatCard` duplicado con fórmula de color ligeramente distinta entre Actividades y Evaluaciones.

Nota: la Parte 1 planea que `NewActivityModal`/`nuevo/page.tsx` pasen a ser la pantalla "Resultado" — al implementarlo, aplicar ahí mismo las reglas de diseño (X en vez de Cancelar, paleta navy) en lugar de arreglarlo dos veces.

---

## Cómo encajan ambas partes

- Los **hallazgos de seguridad** (IDOR, RLS) y los **bugs funcionales** de revisión/resultados/simulador son independientes del rediseño de creación — se pueden y deben corregir sin esperar al chat de IA.
- Los **hallazgos de diseño/UI** en las pantallas de creación (`NewActivityModal`, `nuevo/page.tsx` de exámenes) quedan absorbidos por la Parte 1: al convertirse en pantalla "Resultado", ahí se aplican las reglas de una vez.
- Los hallazgos de diseño en pantallas que la Parte 1 **no** toca (Resultados, Revisión, Simulador, paleta de Evaluaciones en general) siguen como trabajo aparte.

## Sugerencia de orden de implementación
1. ✅ Seguridad (IDOR ×2 + condicional de `bulk-evaluate-exams`) — desplegado y verificado en producción.
2. ✅ RLS real en producción — confirmado correcto, sin cambios necesarios.
3. Bugs funcionales de Revisión/Resultados/Simulador — no dependen del rediseño. **Siguiente pendiente.**
4. Rediseño de creación por chat (Parte 1) — el trabajo más grande, se beneficia de que 1-3 ya estén resueltos para no mezclar seguridad con feature nueva.
5. Limpieza de paleta/`alert()`/`StatCard` en las pantallas que la Parte 1 no absorbe.
6. ✅ Limpieza de políticas RLS muertas + fix del hueco real en `evaluation_responses` — desplegado y verificado. (Baja prioridad, aún pendiente) evaluar `DROP COLUMN exams.course_id` si se confirma que nada la usa.

Todo esto pendiente de confirmación explícita del usuario antes de escribir o desplegar código, siguiendo la regla de sesión ya establecida.

---

## 🔄 TRASPASO PARA SESIÓN SIGUIENTE (2026-09-14, fin de sesión por límite — arrancar 2026-09-15 ~6am)

Reportado por el usuario en producción, sin investigar todavía (sesión se cortó por límite de tiempo/contexto). Los 3 puntos son la prioridad #1 de la siguiente sesión, antes que cualquier otra cosa:

**1. Bug de Unidades — persiste, con un error concreto nuevo.** El intento de arreglo de esta sesión (separar `is_closed` en `attendance_closed_at`/`grades_closed_at`, ver `docs/INSTRUCCION_ANTIGRAVITY_UNIDADES_CALIFICACIONES_2026-09-14.md`) **no llegó a ejecutarse** — quedó redactada pero nunca se le mandó a Antigravity ni se aplicó. El usuario confirma en producción: se pueden editar todas las unidades excepto la Unidad 1. Además, al editar una unidad aparece este error real de Postgres (capturado en logs de Supabase):
```json
{
  "status": "23502",
  "event_message": "null value in column \"id\" of relation \"activities\" violates not-null constraint"
}
```
Hipótesis a verificar primero (no confirmada, investigar antes de asumir): en `useUnidades.ts`/`useCalificaciones.ts`, los `upsert` de `activities` para los pilares (Asistencia/Actividades/Evaluaciones) usan `{ id: assistAct?.id, unit_id, name, weight_percentage }` — si el criterio correspondiente no existe todavía para esa unidad (`assistAct` es `undefined`), `id` se manda como `undefined`/`null` explícito, y como `activities.id` es `NOT NULL` sin default en el `upsert` (o el default no aplica cuando se envía `null` explícito en vez de omitir la columna), Postgres lo rechaza. Revisar por qué esto pasa específicamente al editar (¿la Unidad 1 nunca tuvo sus 3 pilares creados correctamente al inicio, a diferencia de las demás unidades que sí los tienen desde `handleAdd`?) — eso explicaría por qué solo falla la Unidad 1.

**2. Duplicar actividad — dispara Apps Script (carpetas + correos) igual que crear una actividad nueva real.** Aclarado por el usuario: al crear una actividad normal, se dispara Apps Script para crear carpetas en Drive y (dependiendo de configuración) mandar correos a los alumnos — eso es esperado ahí. El problema es que **el flujo de "Duplicar" (`DuplicateActivityModal.tsx`, modo "Copiar 1:1", que llama a `create-assignment-hub`) queda conectado al mismo disparo real** — es decir, duplicar una actividad hacia otra materia dispara de nuevo la creación de carpetas reales y el envío de correos, como si fuera una actividad genuinamente nueva, cuando probablemente no debería (o debería ser más explícito/opcional para el docente). Revisar `create-assignment-hub/index.ts` y decidir si el modo "duplicar" necesita un flag para saltarse la notificación por correo y/o la creación de carpeta hasta que el docente confirme explícitamente, o si debe comportarse distinto a una creación desde cero.

**1b. Badge de unidad duplicado en Calificaciones.** En `https://eui-reaserch-plataform.vercel.app/panel/materias/[id]/calificaciones` (confirmado por el usuario con captura, ej. materia `3f8ec239-1b0a-45a9-9478-7d964d59aa7f`), el selector de píldoras de unidad muestra `"Unidad 1: Unidad 1"` — se ve el patrón `Unidad ${unit_number}: ${nombre}` y cuando el docente dejó el nombre de la unidad como el default genérico "Unidad 1", queda literalmente duplicado. Fix simple: si `nombre` ya empieza con "Unidad" (case-insensitive) o coincide con el default, no repetir el prefijo — o revisar el default que se le da a una unidad nueva sin nombre custom.

**3. Ponderación individual dentro del pilar "Actividades" de una Unidad — el usuario quiere confirmarla/ajustarla.** Ejemplo dado: si el pilar "Actividades" de una unidad vale 30 pts totales, poder asignar 5/15/7/3 pts a cada una de las 4 tareas individuales (suma 30). Esto YA existe parcialmente en el código (`assignments.rubric_data.weight_percentage`, UI de desglose por tarea en `unidades/page.tsx` — confirmado funcionando esta sesión antes de los cambios de Unidades/Calificaciones), pero dado el bug #1 (error al editar unidades), es muy probable que el usuario no pueda siquiera llegar a usar ese desglose hoy. Probablemente se resuelve solo al arreglar #1 — verificar después del fix si el desglose por tarea sigue funcionando como antes, y si el usuario pide algo adicional (ej. el mismo desglose pero para el pilar "Evaluaciones"/exámenes, que es justo lo que ya cubre `docs/INSTRUCCION_ANTIGRAVITY_UNIDADES_CALIFICACIONES_2026-09-14.md` sección 4, sin ejecutar todavía).

### Estado de despliegue al cierre de esta sesión (2026-09-14)
- Repo sincronizado a GitHub (`jacandelerocervantes-cmd/eui-reaserch-plataform`, rama `main`) vía **force push** — el remoto tenía 54 commits previos que se sobrescribieron a petición explícita del usuario. Historial local ahora es la única fuente de verdad en GitHub.
- **Rotar credenciales pendiente**: `env.local` se coló en el primer commit local (`Supabase Secret Key` + `GCP API Key`), GitHub bloqueó el push por secret scanning, se limpió del historial con `git filter-branch` antes de reintentar — nunca llegó a publicarse, pero las credenciales estuvieron en objetos git locales. Recomendado rotarlas por precaución, no confirmado si ya se hizo.
- Todas las migraciones y Edge Functions de la auditoría de 9 personas (seguridad, DBA, performance, QA, code-reviewer, arquitectura, SRE, compliance, ML) ya están aplicadas/desplegadas en Supabase — ver commits `4355827`/`d40f7c0`/`4b1f9fa` en el log local.
- **Pendiente sin enviar a Antigravity todavía**: `docs/INSTRUCCION_ANTIGRAVITY_UNIDADES_CALIFICACIONES_2026-09-14.md` (el rediseño completo de Unidades/Calificaciones con las 4 decisiones ya confirmadas por el usuario) — es la base para atacar el punto #1 de este traspaso, revisarla y actualizarla con el error `23502` antes de mandarla.
- **Deploy de Vercel**: pendiente confirmar si el usuario corrió `npx vercel@59.1.4 deploy --prod --scope jacandelerocervantes-cmds-projects` después del último lote de cambios — verificar al retomar antes de asumir que producción ya refleja todo lo de esta sesión.
- 12 Edge Functions huérfanas de Campo/Laboratorio/Investigación ya se borraron de Supabase (no solo del código).
