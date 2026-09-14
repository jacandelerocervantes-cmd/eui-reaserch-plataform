# Especificación Técnica: Módulo de Docencia y Evaluación (Core Académico)

> **Nota de procedencia**: Especificación reconstruida por ingeniería inversa el 10 de septiembre de 2026, no escrita antes del código — refleja el estado real del sistema, no una versión idealizada.

---

## 1. Propósito y alcance

### 1.1 Propósito
Gestionar el ciclo de vida académico operativo del TecNM Campus Tizimín: administración de cursos, unidades temáticas, asignación de tareas/rúbricas, exámenes cronometrados con mecanismos anti-fraude y evaluación automatizada/asistida por IA con Google Gemini 2.5 Flash. Si esta pieza no existiera, la institución dependería de hojas de cálculo desconectadas o plataformas comerciales costosas, perdiendo la trazabilidad de evaluaciones y el alineamiento pedagógico institucional.

### 1.2 Alcance — qué SÍ incluye
- Gestión CRUD de materias (`courses`), unidades temáticas (`course_units`), tareas (`assignments`) y bancos de preguntas (`questions`).
- Módulo de entregas estudiantiles (`submissions`) individuales y por equipos (`assignment_teams`), con soporte de archivos adjuntos validados por Magic Bytes.
- Motor de exámenes en línea (`exams`, `student_exams`, `evaluation_responses`): sesión cronometrada, aleatorización de preguntas, registro de violaciones de foco/pestaña y autosave periódico.
- Evaluación automatizada asistida por IA mediante Edge Functions (`bulk-evaluate-exams`, `evaluate-submissions-ia`, `generate-rubric-ia`).
- Registro de asistencia presencial vía códigos QR rotativos firmados con HMAC SHA-256 (`attendance`).

### 1.3 Alcance — qué NO incluye
- Motor de tutoría en tiempo real para alumnos (delegado al módulo aislado `ai-tutor-sandbox`).
- Almacenamiento directo de archivos pesados en la base de datos (se usa Supabase Storage y Google Drive con enlaces normalizados).
- Auditoría criptográfica profunda de hash chain (delegado al subsistema de custodia `chain_custody` / `custody_events`).
- Envío directo de correos masivos sin control de cuota (se gestiona mediante funciones batch específicas con rate limiting).

### 1.4 Criterio de inclusión
Entra en este módulo cualquier funcionalidad directamente vinculada a la interacción formal profesor-alumno, diseño curricular del curso o acreditación de calificaciones del ciclo escolar.

### 1.5 Consumidores conocidos hoy
- Portal Web Docente: `app/(docente)/panel/materias/[id]/*` (calificaciones, actividades, exámenes, alumnos).
- Portal Web Alumno: `app/(alumno)/alumno/materia/[id]/*` (entregar actividades, presentar exámenes, ver calificaciones).
- Edge Functions de Supabase en Deno (`bulk-evaluate-exams`, `create-assignment-hub`, `publish-exam-form`, etc.).
- Webhook receptor de Google Forms (`ingest-form-response`).

---

## 2. Dependencias

### 2.1 De qué depende esta pieza
- **Supabase Database (PostgreSQL 15+)**: Persistencia relacional, esquemas y políticas RLS.
- **Supabase Auth**: Autenticación JWT y roles (`docente`, `alumno`, `admin`).
- **Google AI Studio (Gemini 2.5 Flash API)**: Inferencia para corrección de reactivos abiertos y generación de rúbricas.
- **Next.js 16 (App Router)**: Framework SSR/CSR del frontend.

### 2.2 Quién depende de esta pieza
- Módulo de Analítica y MLOps (`compute-student-risk-signals`, `cluster-student-risk`, `kalman_states`).
- Módulo de Integridad y Custodia (`submission_revisions`, `integrity_flag_feedback`).

### 2.3 Naturaleza de la dependencia
- Con Supabase: Síncrona transaccional mediante `@supabase/supabase-js` y `@supabase/ssr`.
- Con Gemini: Síncrona vía HTTPS con semáforo de concurrencia y circuit breaker en `_shared/gemini.ts`.
- Con módulos de analítica: Asíncrona desacoplada por eventos y llamadas batch.

### 2.4 Implicación de diseño
Cualquier cambio en el esquema de `assignments` o `exams` impacta directamente a 38 rutas de Next.js y más de 10 Edge Functions. Las migraciones deben ser idempotentes (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

---

## 3. Inventario de funcionalidades

- **Gestión Curricular y Materias**: Creación de materias, matriculación de estudiantes, importación masiva (`import-ia-students`), configuración de unidades y ponderaciones.
- **Hub de Actividades y Tareas**: Asignación de rúbricas analíticas, recepción de entregas con control de fechas límite (`enforce-assignment-deadlines`), soporte de actividades gamificadas (puzzles interactivos).
- **Sistema de Evaluación y Exámenes**: Creación de exámenes con preguntas abiertas y cerradas, extracción de preguntas vía IA (`extract-exam-questions-ia`), interfaz de presentación con proctoring ligero (`useExamSession.ts`).
- **Calificación Automatizada y Asistida**: Co-evaluación con Gemini Flash comparando respuestas contra rúbrica/criterios oficiales, persistencia de retroalimentación detallada.
- **Pase de Lista Inteligente**: Generación de QR dinámicos con HMAC temporal para evitar capturas de pantalla compartidas entre alumnos.

---

## 4. Modelo de datos

### 4.1 Entidades principales
- `courses`: Materias dictadas por un docente en un ciclo lectivo.
- `course_units`: Unidades temáticas o módulos que integran una materia.
- `assignments`: Tareas y actividades con fecha límite, ponderación y rúbrica JSON.
- `submissions`: Entregas realizadas por los estudiantes (texto, URL de Drive, metadatos de archivo).
- `exams`: Instrumentos de evaluación formal con ventana temporal (`start_at`, `end_at`).
- `questions`: Reactivos asociados a un examen con tipo (`multiple_choice`, `open_text`), ponderación y clave.
- `student_exams`: Sesiones de examen iniciadas por los alumnos (tiempo restante, estado, violaciones detectadas).
- `evaluation_responses`: Respuestas específicas de un alumno a cada reactivo con calificación y feedback IA.
- `attendance`: Registros de asistencia con validación HMAC y geolocalización opcional.

### 4.2 Entidades que NO entran aquí
- `ai_sandbox_logs`: Pertenecen exclusivamente al entorno seguro de tutoría (`modulo-ia-tutor-sandbox`).
- `custody_events`: Pertenecen al libro de contabilidad inmutable (`modulo-integridad-academica-custodia`).
- `knowledge_nodes_docencia`: Pertenecen al motor de GraphRAG.

---

## 5. Esquema técnico resumido

```sql
courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  period text NOT NULL,
  teacher_id uuid NOT NULL REFERENCES profiles(id),
  ai_sandbox_assignments_enabled boolean DEFAULT false,
  ai_sandbox_exam_prep_enabled boolean DEFAULT false,
  ai_sandbox_general_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES course_units(id),
  title text NOT NULL,
  description text,
  due_date timestamptz,
  rubric jsonb,
  max_score numeric DEFAULT 100,
  allow_late boolean DEFAULT false
);

submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id),
  content text,
  file_url text,
  grade numeric,
  feedback text,
  integrity_flag boolean DEFAULT false,
  integrity_reason text,
  status text DEFAULT 'submitted',
  submitted_at timestamptz DEFAULT now()
);
```

---

## 6. Patrón de diseño específico del dominio

- **Patrón Evaluador Asistido (Human-in-the-loop AI Scoring)**: La IA genera un pre-dictamen de calificación y retroalimentación analítica basándose en la rúbrica; el docente mantiene la potestad de ajustar o anular la nota antes de la publicación final.
- **Autosave y Heartbeat de Sesión de Examen**: El hook `useExamSession.ts` sincroniza el estado cada 30 segundos y ante eventos de desenfoque (`blur`), previniendo pérdida de datos por desconexión en redes inestables.

---

## 7. Seguridad, frontera y privacidad

- **Row Level Security (RLS)**: Cada consulta a `courses`, `assignments` y `submissions` filtra por `auth.uid()`. Los alumnos jamás pueden leer entregas de pares ni exámenes antes de su publicación.
- **Validación de Archivos por Magic Bytes**: En `lib/server/fileValidationServer.ts`, las cargas de archivos se verifican examinando los primeros bytes en memoria (firmas PDF `%PDF-`, PNG `\x89PNG`, ZIP `PK\x03\x04`), mitigando ataques de suplantación de extensión.
- **Mitigación de IDOR**: Endpoints críticos validan propiedad (`teacher_id = auth.uid()`) antes de cualquier mutación o notificación.

---

## 8. Estructura de repositorio y stack

- **Frontend**: `app/(docente)/panel/materias/`, `app/(alumno)/alumno/materia/`, `components/courses/`.
- **Backend / DB**: `supabase/migrations/`, `supabase/functions/bulk-evaluate-exams/`, `supabase/functions/evaluate-submissions-ia/`.
- **Stack**: Next.js 16.3.1, React 19.2.3, Tailwind CSS v4, TypeScript 5, Supabase SSR 0.8, Deno 2+.

---

## 9. Pendientes abiertos para la siguiente etapa

1. Corregir vulnerabilidad IDOR documentada en `supabase/functions/notify-exam-results/index.ts` (verificación de docente propietario).
2. Dividir `app/(docente)/panel/materias/[id]/alumnos/page.tsx` (775 líneas) extrayendo tablas y modales a `_components/`.
3. Modularizar `app/(docente)/panel/materias/[id]/calificaciones/_hooks/useCalificaciones.ts` (608 líneas) en submódulos de captura y agregación.
4. Reducir `SimulacionModal.tsx` (668 líneas) y `PuzzlePlayZone.tsx` (650 líneas) para respetar el límite de 300 líneas de presentación UI.
5. Aplicar en producción la migración `20260828160000_fix_course_units_and_assignments_rls.sql` y verificar consistencia de llaves foráneas.

