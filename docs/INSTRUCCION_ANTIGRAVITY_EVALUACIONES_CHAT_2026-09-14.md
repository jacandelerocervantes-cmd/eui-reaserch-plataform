# Instrucción para Antigravity — Chat de creación en Evaluaciones (Exámenes)

**Repo:** `C:\Users\anton\OneDrive\Documents\EUI_Plataforma_Educacion\EUI-Docencia-Plataforma\eui-reaserch-plataform-main`
**Fecha:** 2026-09-14
**Objetivo:** replicar en Evaluaciones (exámenes) el rediseño de creación por chat que ya está en producción para Actividades. Exámenes es más complejo: genera reactivos estructurados (preguntas con tipo/opciones/respuesta), no solo texto libre.

Al terminar, reporta explícitamente: **lista completa de archivos creados y modificados (ruta relativa completa cada uno)**. Sin esa lista no se puede auditar el cambio.

---

## 1. Contexto — qué ya existe hoy (NO tocar todavía, es la base)

- [`app/(docente)/panel/materias/[id]/evaluaciones/nuevo/page.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/nuevo/page.tsx) — pantalla actual de creación.
- [`app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_components/AIPromptBar.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_components/AIPromptBar.tsx) — el prompt de un solo turno actual (a reemplazar por el chat).
- [`app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_components/PropertiesPanel.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_components/PropertiesPanel.tsx)
- [`app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_components/SimulacionModal.tsx`](../app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_components/SimulacionModal.tsx)
- [`app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_hooks/useNuevaEvaluacion.ts`](../app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_hooks/useNuevaEvaluacion.ts) — llama a la Edge Function `generate-exam-ia` (confirmado, línea 62) para generar preguntas, a `extract-exam-questions-ia` (línea 81) para extraer de archivo, y a `publish-exam-form` (línea 150) al publicar.
- [`supabase/functions/generate-exam-ia/index.ts`](../supabase/functions/generate-exam-ia/index.ts) — Edge Function actual, un solo turno.

## 2. Referencia — el mismo patrón YA implementado y verificado en producción para Actividades

Estudiar estos archivos ANTES de escribir nada, son la plantilla de arquitectura (chat multi-turno, "ajustar en vez de regenerar", tarjetas expandibles, toasts):

- [`app/(docente)/panel/materias/[id]/actividades/nueva/_components/ActivityChatAssistant.tsx`](../app/(docente)/panel/materias/[id]/actividades/nueva/_components/ActivityChatAssistant.tsx) — componente de chat (hilo de mensajes, input + adjuntar archivo, estado "Pensando...").
- [`app/(docente)/panel/materias/[id]/actividades/nueva/_components/RubricSection.tsx`](../app/(docente)/panel/materias/[id]/actividades/nueva/_components/RubricSection.tsx) — tarjetas expandibles con botón Maximize2/Minimize2 por fila (sin caja aparte), crecen independiente sin afectar vecinas.
- [`app/(docente)/panel/materias/[id]/actividades/nueva/_hooks/useNuevaActividad.ts`](../app/(docente)/panel/materias/[id]/actividades/nueva/_hooks/useNuevaActividad.ts) — patrón de carga de datos `useEffect`+`useState` (NUNCA usar `use(resource)`/Suspense — ver sección 5), patrón de `feedback: {type, message}` con auto-dismiss 4s como toast fijo en la esquina superior derecha (reemplaza `alert()` nativos).
- [`supabase/functions/generate-rubric-ia/index.ts`](../supabase/functions/generate-rubric-ia/index.ts) — Edge Function que acepta `instruction` + `current_rubrics` opcionales: si ya hay contenido previo, le pide al modelo **ajustar conservando lo no mencionado** en vez de regenerar desde cero. Replicar esta misma idea en `generate-exam-ia`.
- [`app/(docente)/panel/materias/[id]/actividades/[assignmentId]/editar/_components/DuplicateActivityModal.tsx`](../app/(docente)/panel/materias/[id]/actividades/[assignmentId]/editar/_components/DuplicateActivityModal.tsx) — modal "Duplicar a otra materia" (1:1 / Generar similar), para replicar más adelante en `evaluaciones/[examId]/configuracion/page.tsx` (NO es parte de esta tarea, es la síguiente después de esta).

## 3. Especificación funcional del chat de Exámenes (del documento de diseño)

Fuente: `docs/PLAN_ACTIVIDADES_EVALUACIONES_2026-09-14.md`, sección "Flujo de creación — Exámenes". Resumen accionable:

1. El docente inicia el chat. Puede adjuntar material (PDF, PPT, Word o imagen) **o** describir el tema en texto libre — el material es opcional.
2. El chat pregunta en orden fijo: (1) tema o archivo, (2) cantidad de preguntas, (3) dificultad general (punto de partida, ajustable después), (4) tipos de pregunta deseados.
3. Mientras genera, mostrar mensajes de estado por etapa ("Leyendo el PDF...", "Identificando temas...", "Redactando preguntas...") y un contador ("Pregunta 3 de 10").
4. Cada pregunta aparece como **tarjeta inline en el mismo hilo del chat**, colapsada por defecto (enunciado + tipo), expandible para ver opciones/respuesta correcta, con controles de editar / regenerar / cambiar dificultad **por pregunta individual** (no solo a nivel global).
5. El docente puede pedir una pregunta específica por texto libre dentro del mismo hilo ("agrega una de opción múltiple sobre...") — no hay editor de formulario aparte para esto.
6. Si la IA no puede leer el material (escaneado borroso, archivo corrupto), el chat ofrece ambas salidas: reintentar con otro archivo, o continuar solo con descripción en texto.
7. El examen se marca explícitamente como **"Borrador"** mientras se trabaja en el chat.
8. El docente sigue ajustando en el chat lo que quiera; solo al presionar **"Guardar examen"** se confirma y navega a la pantalla de Resultado (el `nuevo/page.tsx` actual, que cambia de rol: pasa de "crear desde cero" a "así quedó").

### Decisión pendiente a confirmar con el usuario antes de escribir código productivo:
¿El estado "Borrador" se persiste en base de datos como fila real (INSERT en `exams`/`questions` con un flag `status='draft'`), o se mantiene solo en memoria del cliente hasta "Guardar examen"? — el documento de diseño lo deja abierto. Si Antigravity necesita decidir para avanzar, usar **solo-cliente** (sin persistir hasta "Guardar") por ser más simple y consistente con que Actividades tampoco persiste el chat hasta guardar — pero señalarlo explícitamente en el reporte final para que se revise.

## 4. Alcance técnico sugerido

- Extraer texto de PDF/PPT/Word/imagen (posible OCR para imágenes) — revisar si ya existe una utilidad de extracción reusable en el repo (Actividades no la necesitó, pero Exámenes con `extract-exam-questions-ia` ya la tiene — **reusar esa Edge Function o su lógica de extracción en vez de reescribirla**).
- Extender `generate-exam-ia` (o crear una nueva Edge Function si la estructura de "ajustar pregunta por pregunta" no encaja en la función actual) para aceptar turnos incrementales: `instruction` + `current_questions` opcionales, mismo patrón que `generate-rubric-ia`.
- Preferible: generar primero un JSON estructurado por pregunta, para que "regenerar una pregunta" sea una llamada aislada (una pregunta a la vez) y no reprocese el examen completo.
- Nuevo componente de chat: `app/(docente)/panel/materias/[id]/evaluaciones/nuevo/_components/ExamChatAssistant.tsx` (nombre sugerido, sigue la convención de `ActivityChatAssistant.tsx`).
- Tarjetas de pregunta colapsables: nuevo componente, ej. `QuestionCard.tsx` en la misma carpeta `_components/`.

## 5. Reglas obligatorias de esta sesión (no negociables)

- **NUNCA usar `use(resource)`/React Suspense para cargar datos.** Se confirmó un bug sistémico esta sesión: con ese patrón, TODOS los `onClick` de la pantalla dejan de responder. Usar siempre `useEffect` + `useState` (ver `useNuevaActividad.ts` como plantilla correcta). Esto aplica a cualquier archivo nuevo o modificado en esta tarea.
- **Sin `alert()`/`confirm()` nativos.** Usar el patrón `feedback: {type, message}` con toast fijo esquina superior derecha, igual que `useNuevaActividad.ts`.
- **Selector de fecha:** si esta tarea toca algún campo de fecha, usar el componente ya existente [`components/ui/DateTimeFieldMX.tsx`](../components/ui/DateTimeFieldMX.tsx) (ya está en uso en `evaluaciones/nuevo` y `configuracion`, no debería hacer falta tocarlo).
- **No hacer deploy ni migraciones de base de datos.** Solo código local. El deploy a Vercel/Supabase lo confirma el usuario explícitamente antes de ejecutarse, en otra sesión de trabajo.
- **No modificar** `app/(docente)/panel/materias/[id]/actividades/**` (módulo ya cerrado y verificado) salvo que sea estrictamente necesario para compartir un componente — si eso pasa, señalarlo explícitamente en el reporte.

## 6. Qué reportar al terminar (obligatorio para poder auditar)

1. Lista completa de archivos **nuevos** creados (ruta relativa completa).
2. Lista completa de archivos **existentes modificados** (ruta relativa completa).
3. Qué Edge Function(s) se tocaron o crearon, y si requieren deploy (`supabase functions deploy <nombre>`) — sin desplegar, solo señalarlo.
4. Si se tomó alguna decisión de diseño no especificada aquí (ej. el estado "Borrador"), decirlo explícitamente.
5. Resultado de `npx tsc --noEmit` y de `npm run build` corridos localmente antes de reportar terminado.
