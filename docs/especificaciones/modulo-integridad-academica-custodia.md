# Especificación Técnica: Módulo de Integridad Académica y Cadena de Custodia Criptográfica

> **Nota de procedencia**: Especificación reconstruida por ingeniería inversa el 10 de septiembre de 2026, no escrita antes del código — refleja el estado real del sistema, no una versión idealizada.

---

## 1. Propósito y alcance

### 1.1 Propósito
Proveer mecanismos objetivos, auditables y científicamente respaldados para verificar la autenticidad de los trabajos académicos, detectar el uso no declarado de IA generativa y blindar las calificaciones frente a alteraciones fraudulentas mediante una cadena de custodia criptográfica inmutable. Si este módulo no existiera, las evaluaciones dependerían de acusaciones subjetivas sin evidencia reproducible y la integridad de las notas en la base de datos podría ser alterada sin registro forense.

### 1.2 Alcance — qué SÍ incluye
- Inserción y extracción de marcas de agua esteganográficas invisibles usando caracteres Unicode de ancho cero (`U+200B`, `U+200C`, `U+200D`) en consignas y materiales (`watermark_codec.py`, `_shared/watermark.ts`).
- Generador y analizador de trampas anti-inyección de prompt en CSS (`prompt_injection_css.py`).
- Cadena de custodia criptográfica secuencial (Hash Chain SHA-256) sobre eventos de calificación y cambios de estado de entregas (`custody_events`, `lib/server/custody.ts`).
- Validador estadístico independiente basado en Regresión Logística (`_shared/logisticValidator.ts`, `validate-submission-integrity`) para auditar las alertas de IA sin depender exclusivamente del propio LLM.
- Captura de retroalimentación docente (`integrity_flag_feedback`) para calibración continua de umbrales.
- Grafo de proveniencia académica (`provenance_graph.py`).

### 1.3 Alcance — qué NO incluye
- Sanción o penalización disciplinaria automática (el sistema solo genera banderas e indicios probabilísticos con valor pedagógico).
- Software invasivo de proctoring a nivel sistema operativo (no instala agentes ni bloquea periféricos locales del alumno).
- Detección universal infalible de texto sintético (se asume que la esteganografía y los clasificadores son herramientas de apoyo, no pruebas jurídicas definitivas).

### 1.4 Criterio de inclusión
Entra en este módulo cualquier mecanismo matemático, criptográfico o heurístico destinado a autenticar la autoría estudiantil, registrar trazabilidad forense de eventos de evaluación o mitigar trampas por inyección de prompts.

### 1.5 Consumidores conocidos hoy
- Panel de Auditoría Docente: `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/auditoria/[submissionId]/page.tsx`.
- Edge Functions: `analyze-submission-integrity`, `validate-submission-integrity`, `submit-integrity-feedback`.
- Scripts forenses locales en Python (`auditoria/custody_audit.py`, `E-grafo-proveniencia/provenance_graph.py`).

---

## 2. Dependencias

### 2.1 De qué depende esta pieza
- **Módulo de Docencia y Evaluación**: Requiere `submissions` y `evaluation_responses` como objetos de análisis.
- **PostgreSQL / Supabase**: Tablas `custody_events`, `submission_revisions`, `integrity_flag_feedback`.
- **Deno / Node Crypto API**: Funciones nativas `crypto.subtle` para cálculo de digests SHA-256.

### 2.2 Quién depende de esta pieza
- Interfaz docente de revisión de entregas.
- Línea de investigación académica (Paper 2 sobre ciberseguridad híbrida y esteganografía robusta en educación).

### 2.3 Naturaleza de la dependencia
- Síncrona en el pipeline de validación de entrega (`validate-submission-integrity`).
- Asíncrona en la auditoría forense de cadena de custodia (`custody_audit.py`).

### 2.4 Implicación de diseño
Las funciones criptográficas deben garantizar reproducibilidad exacta entre entornos Deno (Edge), Node.js (Tests/Server) y Python (Auditoría externa). La canonización JSON es mandataria antes del hashing.

---

## 3. Inventario de funcionalidades

- **Esteganografía Unicode de Ancho Cero**: Codificación binaria de metadatos (ID de curso, ID de entrega, marca temporal) e inserción invisible en textos docentes; detector forense que recupera el payload aun tras copiar y pegar.
- **Cadena de Custodia Criptográfica**: Cada asignación o mutación de calificación calcula $H_k = \text{SHA-256}(H_{k-1} \parallel \text{payload}_k)$, impidiendo la alteración silenciosa de registros históricos en la base de datos.
- **Validador Logístico Independiente**: Modelo de regresión lineal logística entrenado sobre características objetivas (longitud, entropía, marcas de agua, tiempos de respuesta) con función sigmoide:
  $$P(\text{plagio}) = \frac{1}{1 + e^{-(\beta_0 + \sum \beta_i x_i)}}$$
- **Loop de Retroalimentación y Reentrenamiento**: Recolección de veredictos manuales de profesores (`confirmed_cheating` vs `false_positive`) con instantánea JSON de features para refinamiento de pesos (`fitWeights`).

---

## 4. Modelo de datos

### 4.1 Entidades principales
- `custody_events`: Registro inmutable encadenado con hash previo, hash actual, actor, tipo de evento y payload canonizado.
- `submission_revisions`: Historial de versiones de texto y enlaces entregados por el estudiante.
- `integrity_flag_feedback`: Evaluaciones emitidas por los docentes sobre las alertas generadas por el sistema.

### 4.2 Entidades que NO entran aquí
- `submissions`: Entidad de negocio propiedad de `modulo-docencia-evaluacion`.
- `kalman_states`: Métricas de aprendizaje pertenecientes a `modulo-mlops-analitica-academica`.

---

## 5. Esquema técnico resumido

```sql
custody_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_id uuid NOT NULL REFERENCES profiles(id),
  previous_hash text NOT NULL,
  current_hash text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

integrity_flag_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  predicted_probability double precision NOT NULL,
  features jsonb NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('confirmed_cheating', 'false_positive')),
  docente_notes text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
```

---

## 6. Patrón de diseño específico del dominio

- **Patrón Merkle / Hash Chain para Trazabilidad Inmutable**: Garantiza no-repudio sin incurrir en la sobrecarga y costos de una blockchain pública.
- **Doble Veredicto Desacoplado**: Separación intencional entre la opinión del LLM evaluador (`evaluate-submissions-ia`) y el validador estadístico determinista (`logisticValidator.ts`), evitando el sesgo de auto-confirmación de la IA.

---

## 7. Seguridad, frontera y privacidad

- **Políticas RLS**: `custody_events` e `integrity_flag_feedback` son de solo lectura/inserción para docentes y administradores; los estudiantes no tienen acceso de lectura para evitar ingeniería inversa de los patrones de detección.
- **Protección de Datos PII**: Los payloads registrados en la cadena de custodia almacenan identificadores UUID, evitando almacenar datos sensibles de estudiantes en texto plano dentro del grafo.

---

## 8. Estructura de repositorio y stack

- **Frontend**: `app/(docente)/panel/materias/[id]/actividades/[assignmentId]/auditoria/`.
- **Backend / Edge**: `supabase/functions/validate-submission-integrity/`, `_shared/logisticValidator.ts`, `_shared/watermark.ts`.
- **Herramientas de Análisis**: `D-watermark-integridad-academica/` (Python), `E-grafo-proveniencia/` (Python), `auditoria/custody_audit.py`.

---

## 9. Pendientes abiertos para la siguiente etapa

1. Los scripts en Python (`watermark_codec.py`, `custody_audit.py`) están desacoplados del runtime TypeScript de Next.js/Deno; se debe mantener paridad algorítmica garantizada por tests cruzados.
2. Los pesos de regresión logística (`DEFAULT_WEIGHTS`) están fijados heurísticamente en arranque en frío; falta ejecutar `fitWeights()` una vez que se acumulen al menos 100 veredictos reales en producción.
3. La página de auditoría `[submissionId]/page.tsx` tiene 449 líneas; requiere extracción de componentes de visualización del árbol de custodia.

