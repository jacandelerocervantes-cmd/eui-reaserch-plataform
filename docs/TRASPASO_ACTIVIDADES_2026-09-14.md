# Traspaso — Diseño de Actividades y Exámenes (para sesión en Claude.ai normal)

Este documento es para una conversación en **Claude.ai normal (no Claude Code)**. El objetivo de esa sesión NO es escribir código — es explorar con el usuario, en modo conversación, qué debe hacer y cómo debe verse el flujo de "Actividades y Exámenes" antes de que otra sesión de Claude Code lo implemente. Ver instrucciones exactas para el asistente al final de este archivo.

## Contexto: qué es esta plataforma

EUI Platform (`eui-reaserch-plataform`) — plataforma de gestión académica del Instituto Tecnológico de Tizimín (TecNM). Next.js + Supabase + Vercel, en producción real (`https://eui-reaserch-plataform.vercel.app/`). El usuario (Antonio) es el desarrollador/administrador, no solo el docente de prueba.

## Qué se hizo en la sesión anterior (2026-09-14) — resumen

Sesión larga de QA red-team + implementación sobre el flujo docente (Login → Materias → Unidades → Alumnos → Asistencia → Equipos). Todo lo siguiente ya está **desplegado en producción y verificado**:

1. **Bug crítico de importación de alumnos vía IA resuelto**: `_shared/auth.ts` reemplazó `auth.getUser()` (llamada de red frágil) por `auth.getClaims()` con retry — la importación de PDF/CSV/Excel ya funciona.
2. **16 hallazgos de diseño/UI corregidos y desplegados**: modales con un solo mecanismo de cierre (X, sin "Cancelar" redundante), botones "Eliminar" como ícono fijo, resto de acciones como "expand buttons" (ícono con texto en hover), paleta de color unificada a navy institucional `#1B396A` (se había colado azul genérico `#2563eb` tipo "IA" en varias pantallas), 5 `alert()`/`confirm()` nativos reemplazados por banners propios, grid de Unidades arreglado, etc. Detalle completo en `docs/QA_RED_TEAM_DOCENTE_2026-09-14.md`.
3. **9 migraciones de base de datos pendientes, reconciliadas** con producción (incluía fixes de seguridad RLS ya aplicados de facto, más el esquema Medallón Bronce/Plata/Oro para analítica).
4. **Año y Semestre ahora editables** en "Editar Asignatura" (antes no se guardaban en la BD).
5. **Arreglada la duplicación de alumnos entre materias** (bug arquitectónico): se creó `student_profiles` (identidad única por matrícula a nivel institución); `students` sigue siendo el roster por materia pero ahora enlaza a esa identidad. **Regla de negocio importante establecida**: una vez que una matrícula ya está registrada, **nombre/apellidos/correo/matrícula son de solo administrador** — el docente ya no puede editarlos, solo puede agregar o quitar alumnos de su materia. El modal "Nuevo Alumno" ahora autocompleta y bloquea esos campos automáticamente si la matrícula ya existe en el sistema.

## Reglas de diseño ya acordadas (aplican a todo lo nuevo, incluyendo Actividades)

- **Un solo mecanismo de cierre por modal**: la "X" en la esquina superior derecha. Nunca un botón "Cancelar" además.
- **"Eliminar"/"Cerrar" como ícono fijo sin texto** (basura, X) — su significado ya es obvio.
- **Todo lo demás como "expand button"**: ícono por defecto, texto visible en hover (componente ya existe: `components/ui/ExpandingButton.tsx`).
- **Paleta institucional navy/dorado** (`#1B396A` como acento principal) — evitar azul genérico tipo `#2563eb`/`#eff6ff` que se ve "de librería UI" o "estilo IA".
- **No exponer detalles técnicos de implementación al docente** (ej. se quitó un badge que decía "MOTOR GEMINI 2.5 FLASH" — el docente no necesita saber qué modelo de IA se usa).
- **Minimalista, sin texto redundante**: si el título y el ícono ya explican la acción, no repetir la misma explicación dos veces en el mismo modal.

## Reglas de sesión / operativas (si la conversación deriva a "hazlo ya")

- El login/consentimiento de Google lo hace el usuario, nunca el agente.
- Cualquier escritura a la base de datos de producción o deploy a Vercel requiere confirmación explícita del usuario antes de ejecutarse — no asumir autorización de un paso anterior.
- Datos de alumnos de prueba: dominio `matricula@ittizimin.edu.mx` — nunca el dominio real de la institución. Única excepción: `j.candeleroc@gmail.com` (alumno de validación real).
- El usuario prefiere avanzar en pasos chicos y confirmar antes de que la sesión "se emocione" e implemente de más — mejor preguntar/confirmar el alcance antes de escribir código.

## La tarea pendiente: Actividades y Exámenes (Paso 5 del plan original)

Nunca se probó ni se revisó de diseño. Archivos relevantes ya existentes en el repo (para referencia, no es necesario leerlos en la sesión de Claude.ai — son para la sesión de Claude Code que retome después):

**Actividades** (`app/(docente)/panel/materias/[id]/actividades/`):
- `page.tsx` — listado de actividades de la materia.
- `nueva/page.tsx` + `_components/` (`ActivityFormLeftColumn.tsx`, `ActivityFormRightColumn.tsx`, `OptionCard.tsx`, `PuzzlePreviewModal.tsx`, `RubricSection.tsx`, `TeamPickerModal.tsx`) — creación de actividad nueva, con rúbrica y opción de equipos.
- `[assignmentId]/page.tsx` — detalle de una actividad (con `SubmissionsTable.tsx`, `StatCard.tsx`, `PlagiarismBanner.tsx`, `FloatingActionPill.tsx`).
- `[assignmentId]/editar/page.tsx` — edición.
- `[assignmentId]/auditoria/[submissionId]/page.tsx` — auditoría de integridad de una entrega.

**Evaluaciones/Exámenes** (`app/(docente)/panel/materias/[id]/evaluaciones/`):
- `page.tsx` — listado de exámenes.
- `nuevo/page.tsx` + `_components/` (`AIPromptBar.tsx`, `PropertiesPanel.tsx`, `SimulacionModal.tsx`) — creación de examen, aparentemente con generación asistida por IA.
- `[examId]/page.tsx`, `configuracion/`, `resultados/`, `revision/[studentId]/`, `simulacion/` — ciclo completo de un examen: configurar, publicar, ver resultados, revisar por alumno, simular.
- `_components/`: `QuestionCard.tsx`, `ScoreBar.tsx`, `SecuritySettings.tsx`, `AudienceSelector.tsx`, `EmptyQuestionsState.tsx`, `ExamHeaderNav.tsx` — sugiere ya existe banco de preguntas, configuración de seguridad (anti-copia?), selector de audiencia.

Es decir: **ya existe una implementación construida** para ambos módulos — la tarea no es diseñar desde cero, es **explorar lo que ya existe con el usuario, entender qué tan bien funciona hoy, y decidir junto con él qué UI/funcionalidad ajustar** antes de tocar código. Esto es exploratorio, parecido a cómo se descubrieron los hallazgos de diseño de Unidades/Alumnos en la sesión anterior (usando la app real en producción, no leyendo el código a ciegas).

## Recomendación explícita para la sesión de Claude.ai

El usuario pidió específicamente que esto se explore **en conversación, no como una lista de texto/spec**. Es decir: la sesión de Claude.ai no debe simplemente "adivinar" y presentar un plan cerrado — debe ir haciendo preguntas, presentando 2-3 opciones concretas por decisión de diseño/función (como se hizo en esta sesión con el toggle de puntos/porcentaje, o con la identidad de alumnos), e ir construyendo el plan junto con el usuario en tiempo real. El resultado de esa conversación (una vez que el usuario esté conforme) debe quedar resumido en un nuevo documento de traspaso para que una sesión de Claude Code lo implemente y lo pruebe en producción, siguiendo el mismo patrón de esta sesión: implementar → desplegar → verificar en vivo → documentar.

---

## Instrucciones para el asistente que abra este documento en Claude.ai

Si estás leyendo esto en una conversación nueva de Claude.ai (no Claude Code): tu tarea es tener una conversación exploratoria con el usuario sobre **qué debe hacer y cómo debe verse** el módulo de Actividades y Exámenes de esta plataforma (UI y funcionalidad, ambas). No implementes nada — no tienes acceso al repo ni a producción desde aquí. Usa las reglas de diseño ya acordadas (arriba) como marco de referencia para tus sugerencias, pero no asumas que el usuario ya decidió los detalles de Actividades/Exámenes específicamente — eso es justo lo que hay que conversar. Ve pregunta por pregunta o propuesta por propuesta, no vuelques todo un plan de una vez. Al final, resume las decisiones tomadas en un formato que otra sesión de Claude Code pueda usar como traspaso.
