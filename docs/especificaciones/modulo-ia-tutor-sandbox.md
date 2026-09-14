# Especificación Técnica: Módulo de IA Tutor Sandbox (Entorno Seguro para Alumnos)

> **Nota de procedencia**: Especificación reconstruida por ingeniería inversa el 10 de septiembre de 2026, no escrita antes del código — refleja el estado real del sistema, no una versión idealizada.

---

## 1. Propósito y alcance

### 1.1 Propósito
Habilitar un entorno controlado, pedagógicamente restringido y financieramente protegido para que los estudiantes interactúen con modelos de lenguaje grande (LLMs) sin incurrir en trampas en exámenes ni generar costos imprevistos. Históricamente, el acceso de alumnos a IA estaba deshabilitado por riesgo de plagio y abuso de cuota. Este módulo implementa un piloto acotado con interruptores independientes por modo y materia.

### 1.2 Alcance — qué SÍ incluye
- Tres modos de interacción estrictamente aislados:
  1. `assignment`: Asistencia guiada (método socrático) mientras el alumno resuelve una tarea antes de su entrega.
  2. `exam_prep`: Repaso temático previo a la apertura de un examen formal. Bloqueo estricto e irrevocable en cuanto se cumple `exams.start_at`.
  3. `general`: Dudas conceptuales generales de la materia con interruptor independiente.
- Control de cuota y rate-limiting en dos niveles (por alumno y global) implementado con Upstash Redis con política de falla cerrada (*fail-closed*).
- Guardrails pedagógicos que impiden dar la respuesta directa o el código final listo para copiar y pegar.
- Registro auditable de prompts y respuestas (`ai_sandbox_logs`) con visibilidad exclusiva para el alumno y su docente.

### 1.3 Alcance — qué NO incluye
- Chat de asistencia libre no contextualizado (todo prompt requiere una materia asignada activa).
- Acceso a herramientas externas (browser, intérprete de código, MCP) desde el perfil de estudiante.
- Coexistencia con exámenes en curso (la API rechaza cualquier interacción si el alumno tiene un examen activo).

### 1.4 Criterio de inclusión
Entra en este módulo cualquier interacción en tiempo real entre un estudiante matriculado y un modelo de IA generativa dentro de la plataforma.

### 1.5 Consumidores conocidos hoy
- Componentes de interfaz en el portal del estudiante:
  - `app/(alumno)/alumno/materia/[id]/entregar/[assignmentId]/_components/` (zona de entrega con tutor socrático).
  - Vistas de preparación de examen.
- Edge Function `supabase/functions/ai-tutor-sandbox`.

---

## 2. Dependencias

### 2.1 De qué depende esta pieza
- **Google AI Studio (Gemini 2.5 Flash)**: Proveedor primario de inferencia.
- **Upstash Redis (REST API)**: Almacenamiento volátil para contadores de rate limiting (`AI_TUTOR_MAX_MESSAGES_PER_DAY`).
- **Supabase Database & Auth**: Validación de matrícula activa en `courses` y verificación de JWT.

### 2.2 Quién depende de esta pieza
- Interfaz del estudiante en el portal académico.

### 2.3 Naturaleza de la dependencia
- Con Upstash Redis: Síncrona bloqueante. Si Redis no responde o faltan credenciales, la función devuelve HTTP 503 inmediatamente para proteger el presupuesto de API.
- Con Gemini: Síncrona mediante HTTPS con circuit breaker y timeout de 12 segundos.

### 2.4 Implicación de diseño
El sistema prioriza la contención de costos sobre la disponibilidad: ante dudas de cuota o caídas de infraestructura de rate limiting, la IA se apaga en lugar de operar sin control.

---

## 3. Inventario de funcionalidades

- **Control Fino por Materia**: Columnas booleanas independientes en `courses` (`ai_sandbox_assignments_enabled`, `ai_sandbox_exam_prep_enabled`, `ai_sandbox_general_enabled`).
- **Enclavamiento Temporal Anti-Trampa**: Validación estricta en backend contra `exams.start_at`. Si el reloj del servidor supera el inicio del examen, el modo `exam_prep` queda deshabilitado para ese estudiante.
- **Rate Limiting Doble (Token Bucket en Redis)**:
  - Cuota individual: 40 mensajes diarios por estudiante.
  - Cuota global institucional: 1,200 (ampliable a 2,500 bajo crédito educativo) mensajes diarios totales.
- **Auditoría Docente**: Registro persistente de la conversación con etiquetas de posibles infracciones detectadas por guardrails (`guardrail_reasons`).

---

## 4. Modelo de datos

### 4.1 Entidades principales
- `courses` (columnas extendidas):
  - `ai_sandbox_assignments_enabled` (boolean).
  - `ai_sandbox_exam_prep_enabled` (boolean).
  - `ai_sandbox_general_enabled` (boolean).
- `ai_sandbox_logs`:
  - Registro de cada turno de interacción (prompt, response, metadata, created_at).

### 4.2 Entidades que NO entran aquí
- `evaluation_responses`: Pertenecen a exámenes formales (`modulo-docencia-evaluacion`).
- `rag_benchmark_questions`: Pertenecen a evaluación interna de investigadores.

---

## 5. Esquema técnico resumido

```sql
ai_sandbox_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id),
  course_id uuid NOT NULL REFERENCES courses(id),
  context_type text NOT NULL CHECK (context_type IN ('assignment', 'exam_prep', 'general')),
  assignment_id uuid REFERENCES assignments(id),
  exam_id uuid REFERENCES exams(id),
  prompt text NOT NULL,
  response text NOT NULL,
  guardrail_reasons jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ai_sandbox_logs_context_shape_check CHECK (
    (context_type = 'assignment' AND assignment_id IS NOT NULL AND exam_id IS NULL) OR
    (context_type = 'exam_prep' AND exam_id IS NOT NULL AND assignment_id IS NULL) OR
    (context_type = 'general' AND assignment_id IS NULL AND exam_id IS NULL)
  )
);
```

---

## 6. Patrón de diseño específico del dominio

- **Patrón Fail-Closed Circuit Breaker**: Si el servicio de Redis no puede contactarse o la cuota diaria se agota, la función responde con un mensaje pedagógico explicativo sin tocar la API de Gemini.
- **Prompt Framing Socrático**: El prompt del sistema fuerza al modelo a responder con preguntas guía y pistas conceptuales, bloqueando explícitamente la entrega de soluciones completas.

---

## 7. Seguridad, frontera y privacidad

- **Políticas RLS**:
  - `ai_sandbox_logs_student_select_own`: El estudiante solo puede consultar su propio historial.
  - `ai_sandbox_logs_teacher_select_own_courses`: El docente solo puede auditar logs de materias donde él es el titular (`teacher_id = auth.uid()`).
- **Aislamiento de Sesión**: Los logs de IA de un alumno nunca se comparten con otros compañeros de clase.

---

## 8. Estructura de repositorio y stack

- **Frontend**: Componentes de chat en `app/(alumno)/alumno/materia/[id]/`.
- **Backend / Edge**: `supabase/functions/ai-tutor-sandbox/index.ts`, `_shared/auth.ts`, `_shared/guardrail.ts`.
- **Migración SQL**: `supabase/migrations/20260909000000_ai_tutor_sandbox_pilot.sql`.

---

## 9. Pendientes abiertos para la siguiente etapa

1. Configurar las variables de entorno de Upstash en el proyecto de Supabase de producción (`UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`).
2. Aplicar la migración `20260909000000_ai_tutor_sandbox_pilot.sql` en producción.
3. Activar manualmente los interruptores en las 4-5 materias seleccionadas para el inicio del piloto semestral.
4. Ajustar el límite global de `AI_TUTOR_GLOBAL_MAX_MESSAGES_PER_DAY` de 1,200 a 2,500 aprovechando el crédito anual aprobado de Google AI Studio.

