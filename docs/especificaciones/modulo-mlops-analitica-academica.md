# Especificación Técnica: Módulo de MLOps y Analítica Académica Frugal

> **Nota de procedencia**: Especificación reconstruida por ingeniería inversa el 10 de septiembre de 2026, no escrita antes del código — refleja el estado real del sistema, no una versión idealizada.

---

## 1. Propósito y alcance

### 1.1 Propósito
Calcular trayectorias de aprendizaje, segmentar niveles de riesgo de reprobación y detectar anomalías en la presentación de exámenes mediante modelos matemáticos deterministas ejecutados directamente en Edge Functions sin requerir servidores dedicados de inferencia (Python/GPU). Este módulo materializa el principio de "Ingeniería Frugal", proveyendo analítica predictiva avanzada con costo de infraestructura cero.

### 1.2 Alcance — qué SÍ incluye
- **Filtro de Kalman (1D y Vectorial)** (`_shared/kalman.ts`): Estimación de la competencia latente de cada estudiante, desacoplando la fluctuación aleatoria de una evaluación puntual del nivel real de dominio.
- **Clustering K-Means de Riesgo Académico** (`_shared/kmeans.ts`, `cluster-student-risk`): Agrupación no supervisada de alumnos en clústeres de riesgo (Bajo, Medio, Crítico) combinando porcentaje de asistencia, puntualidad de entrega y tendencia de calificaciones.
- **Detección de Anomalías con Isolation Forest** (`_shared/isolationForest.ts`, `detect-exam-anomalies`): Análisis de anomalías multivariadas en el patrón de resolución de exámenes cronometrados basado en la telemetría `answer_timing` (tiempos de respuesta por reactivo, cambios de foco y velocidad atípica).
- Panel visual docente para visualización de clústeres y trayectorias (`panel/materias/[id]/alumnos/riesgo`).

### 1.3 Alcance — qué NO incluye
- Redes neuronales profundas (Deep Learning) que requieran entrenamiento en GPU.
- Decisiones automáticas vinculantes (el sistema no reprueba ni bloquea a un alumno de forma autónoma; solo emite alertas al docente).
- Inferencia retroactiva en exámenes antiguos que carecen del vector de telemetría `answer_timing`.

### 1.4 Criterio de inclusión
Entra en este módulo cualquier algoritmo estadístico o de machine learning determinista diseñado para procesar telemetría de rendimiento y emitir métricas formativas para el cuerpo docente.

### 1.5 Consumidores conocidos hoy
- Vista de Riesgo de Alumnos: `app/(docente)/panel/materias/[id]/alumnos/riesgo/page.tsx`.
- Vista de Resultados de Examen: `app/(docente)/panel/materias/[id]/evaluaciones/[examId]/resultados/page.tsx`.
- Edge Functions: `compute-student-risk-signals`, `cluster-student-risk`, `detect-exam-anomalies`.

---

## 2. Dependencias

### 2.1 De qué depende esta pieza
- **Módulo de Docencia y Evaluación**: Requiere `grades`, `attendance`, `submissions` y `student_exams`.
- **Supabase Database**: Tablas `kalman_states`, `kalman_vector_states`, `ai_calibration_state`.
- **Runtime Deno**: Ejecución matemática pura en TypeScript compilado sin dependencias externas pesadas (NumPy / SciPy).

### 2.2 Quién depende de esta pieza
- Interfaz del docente para alertas tempranas de deserción.
- Proyecto de investigación científica (Paper 1: MLOps Frugal y Filtrado de Kalman en Educación).

### 2.3 Naturaleza de la dependencia
- Asíncrona bajo demanda o en lotes (batch) disparados al concluir unidades académicas o tras la entrega de un examen formal.

### 2.4 Implicación de diseño
Al estar implementado en TypeScript puro sin bibliotecas de C/Python, los algoritmos se ejecutan en sub-segundos dentro del límite de 150 MB de memoria de las Supabase Edge Functions.

---

## 3. Inventario de funcionalidades

- **Estimación Recurrente de Estado (Kalman)**:
  - Predicción: $\hat{x}_{k|k-1} = F \hat{x}_{k-1}$
  - Corrección: $\hat{x}_{k|k} = \hat{x}_{k|k-1} + K_k (z_k - H \hat{x}_{k|k-1})$
  - Mantiene la matriz de covarianza de error actualizada tras cada nota evaluada.
- **Segmentación No Supervisada K-Means**:
  - Normalización min-max de variables (asistencia, calificaciones, retrasos).
  - Inicialización K-Means++ y convergencia en $<50$ iteraciones.
  - Asignación de etiquetas semánticas basadas en centroides ordenados.
- **Isolation Forest para Exámenes**:
  - Construcción de ensamble de $N=50$ árboles aleatorios binarios (`IsolationTree`).
  - Cálculo de la longitud de camino promedio $h(x)$ y score de anomalía:
    $$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$
  - Puntuaciones $s > 0.6$ marcan al examen con bandera de comportamiento atípico.

---

## 4. Modelo de datos

### 4.1 Entidades principales
- `kalman_states`: Almacena el vector de estado actual, covarianza $P$, y número de observaciones procesadas por estudiante/materia.
- `kalman_vector_states`: Extensión multidimensional para rastrear competencias diferenciadas por unidad temática.
- `ai_calibration_state`: Registro de calibración de sesgo del evaluador automático.
- `student_exams` (columnas de telemetría): `anomaly_score`, `anomaly_reasons`, `answer_timing`.

### 4.2 Entidades que NO entran aquí
- `submissions`: Datos de origen que pertenecen a `modulo-docencia-evaluacion`.
- `custody_events`: Pertenecen al libro de auditoría criptográfica.

---

## 5. Esquema técnico resumido

```sql
kalman_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id),
  course_id uuid NOT NULL REFERENCES courses(id),
  state_estimate double precision NOT NULL DEFAULT 70.0,
  error_covariance double precision NOT NULL DEFAULT 100.0,
  process_noise_q double precision NOT NULL DEFAULT 4.0,
  measurement_noise_r double precision NOT NULL DEFAULT 25.0,
  observations_count integer NOT NULL DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

CREATE TABLE IF NOT EXISTS kalman_vector_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id),
  course_id uuid NOT NULL REFERENCES courses(id),
  state_vector jsonb NOT NULL,
  covariance_matrix jsonb NOT NULL,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);
```

---

## 6. Patrón de diseño específico del dominio

- **Patrón Algorítmico Frugal (Zero-Python Edge Ingestion)**: Sustitución de pipelines tradicionales pesados (Kubeflow, MLflow, Celery) por código matemático puro en TypeScript/Deno, eliminando el coste fijo mensual de servidores dedicados de IA.
- **Exclusión Explícita de Datos Falsificados**: Los exámenes sin telemetría temporal son excluidos de la inferencia de anomalías en vez de imputar tiempos simulados.

---

## 7. Seguridad, frontera y privacidad

- **Anonimización en Agregados**: Los clústeres de riesgo solo son accesibles por el docente titular y la dirección académica; no existe API pública que exponga clasificaciones de riesgo a los propios estudiantes para prevenir estigmatización.
- **Aislamiento Multitenant por Materia**: Los cálculos de K-Means y Kalman se acotan rígidamente por `course_id`.

---

## 8. Estructura de repositorio y stack

- **Frontend**: `app/(docente)/panel/materias/[id]/alumnos/riesgo/`.
- **Lógica Compartida**: `supabase/functions/_shared/kalman.ts`, `_shared/kmeans.ts`, `_shared/isolationForest.ts`.
- **Edge Functions**: `supabase/functions/cluster-student-risk/`, `supabase/functions/detect-exam-anomalies/`, `supabase/functions/compute-student-risk-signals/`.
- **Tests Unitarios**: `kalman.test.ts`, `kmeans.test.ts`, `isolationForest.test.ts` (100% de aserciones numéricas cubiertas en Vitest).

---

## 9. Pendientes abiertos para la siguiente etapa

1. Desplegar a producción las Edge Functions `cluster-student-risk` y `detect-exam-anomalies`.
2. Habilitar la recolección masiva de `answer_timing` en el frontend para acumular histórico suficiente para calibrar el umbral de Isolation Forest.
3. Evaluar la migración a `kalman_vector_states` para permitir seguimiento desglosado por competencias específicas del temario TecNM.

