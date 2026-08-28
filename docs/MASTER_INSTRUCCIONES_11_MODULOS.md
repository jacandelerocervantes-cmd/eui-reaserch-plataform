# MANUAL MAESTRO INTEGRAL DE INGENIERÍA Y CALIDAD (11 MÓDULOS CONSOLIDADOS)
## Proyecto: EUI Research Platform & Herramienta Docente
### Filosofía Operativa: Ingeniería Frugal (Tizimín, Yucatán, México) — Cero Costo, Alta Concurrencia y Resiliencia

---

## ÍNDICE GENERAL DE MÓDULOS

1. [MÓDULO 01 (CORRE 1): Configuración del Panel de Expertos y Reglas de Operación](#módulo-01-corre-1-configuración-del-panel-de-expertos-y-reglas-de-operación)
2. [MÓDULO 02 (CORRE 2): Arquitectura Distribuida, Concurrencia Masiva y DevOps Frugal](#módulo-02-corre-2-arquitectura-distribuida-concurrencia-masiva-y-devops-frugal)
3. [MÓDULO 03 (CORRE 3): Refactor de Diseño Frontend, Arquitectura Física y Límites de Líneas](#módulo-03-corre-3-refactor-de-diseño-frontend-arquitectura-física-y-límites-de-líneas)
4. [MÓDULO 04 (CORRE 4): Ciberseguridad Híbrida, Hardening, RLS y Criptografía](#módulo-04-corre-4-ciberseguridad-híbrida-hardening-rls-y-criptografía)
5. [MÓDULO 05 (CORRE 5): Núcleo de IA, MLOps, Validación Matemática y Circuit Breakers](#módulo-05-corre-5-núcleo-de-ia-mlops-validación-matemática-y-circuit-breakers)
6. [MÓDULO 06 (CORRE 6): Arquitectura Multi-Agente, Servidor MCP y Guardrails Éticos](#módulo-06-corre-6-arquitectura-multi-agente-servidor-mcp-y-guardrails-éticos)
7. [MÓDULO 07 (CORRE 7): Integración OCR de Alto Rendimiento (Unlimited-OCR) en GCP con Fallback](#módulo-07-corre-7-integración-ocr-de-alto-rendimiento-unlimited-ocr-en-gcp-con-fallback)
8. [MÓDULO 08 (CORRE 8): Integridad Académica, Esteganografía Unicode y Watermark Docente](#módulo-08-corre-8-integridad-académica-esteganografía-unicode-y-watermark-docente)
9. [MÓDULO 09 (CORRE 9): Double-Check Implacable, QA Técnico y Cierre de Pendientes](#módulo-09-corre-9-double-check-implacable-qa-técnico-y-cierre-de-pendientes)
10. [MÓDULO 10 (CORRE 10): Investigación Científica (Papers Q1), Estrategia Open Source y Case Study](#módulo-10-corre-10-investigación-científica-papers-q1-estrategia-open-source-y-case-study)
11. [MÓDULO 11 (CORRE 11): Unificación SQL, Consolidación de Credenciales y Despliegue de Edge Functions](#módulo-11-corre-11-unificación-sql-consolidación-de-credenciales-y-despliegue-de-edge-functions)

---

## MÓDULO 01 (CORRE 1): Configuración del Panel de Expertos y Reglas de Operación

### 1.1. Roles del Panel Disciplinario
1. **Staff Engineer & Arquitecto de Sistemas Distribuidos**: Diseño de alta disponibilidad, topología y microservicios.
2. **Arquitecto de Ciberseguridad Cloud & DevSecOps**: Hardening, RLS, HMAC, protección perimetral.
3. **AI Research Scientist & ML Engineer Senior**: Modelado estadístico, LLMs, SLMs y pipelines de inferencia.
4. **Investigador Académico (Scopus/JCR Q1) & Estratega Open Source**: Rigor metodológico, publicaciones y licenciamiento.
5. **Matemático Aplicado & Validador Computacional de IA**: Toda ecuación, modelo estadístico o afirmación cuantitativa debe ir acompañada de una validación computacional ejecutable (tests unitarios y scripts reales con métricas numéricas).

### 1.2. Filosofía de Ingeniería Frugal (Tizimín)
- **Zero-Cost**: Priorizar capas gratuitas y software Open Source.
- **Circuit Breakers**: Fallback automático a SLMs locales cuando las APIs de pago sufran saturación o agotamiento de cuota.
- **Topología Híbrida**: Balance óptimo entre Edge/On-Premise local y Cloud económico.

### 1.3. Regla Universal de 4 Fases
- **Fase 1 (Revisión)**: Auditoría estricta de código y hechos verificables (archivo, línea, estado actual).
- **Punto de Confirmación**: Validación explícita de requisitos antes de mutaciones.
- **Fase 2 (Ejecución)**: Cambios directos sobre archivos del repositorio con tipado estricto y pruebas.
- **Fase 3 (Reauditoría con Evidencia)**: Ejecución de builds, linters y tests pegando la salida real.

---

## MÓDULO 02 (CORRE 2): Arquitectura Distribuida, Concurrencia Masiva y DevOps Frugal

### 2.1. Arquitectura Medallón (Big Data ETL)
- **Capa Bronce (Raw Ingestion)**: Recepción de telemetría de alumnos, entregas y respuestas sin transformar.
- **Capa Plata (Cleaned & Enriched)**: Limpieza de ruido (outliers, nulos), normalización de formatos y enriquecimiento con métricas de curso.
- **Capa Oro (Feature Store & Aggregates)**: Partición estricta de datos (Train / Validation / Test) sin fuga de información (*Data Leakage*).

### 2.2. DevOps Frugal y Pipeline CI/CD
- **Pipeline GitHub Actions**: Verificación de TypeScript (`tsc --noEmit`), ESLint y pruebas automatizadas en cada push/PR.
- **Estrategia de Escala**: Transición progresiva desde despliegues locales / K3s hacia servicios gestionados optimizados (Cloud Run / GKE autoscaling `min=0`).

---

## MÓDULO 03 (CORRE 3): Refactor de Diseño Frontend, Arquitectura Física y Límites de Líneas

### 3.1. Sistema de Diseño Maestro
- **Paleta de Colores**:
  - Primario Institucional: `#1B396A`
  - Acentos de Acción: `#2563eb`, `#3b82f6`
  - Éxito / Aprobado: `#16a34a`, `#10b981`
  - Advertencia / Pendiente: `#f59e0b`, `#d97706`
  - Peligro / Alerta: `#ef4444`, `#dc2626`
  - Fondos / Superficies: `#F8FAFC`, `#FFFFFF`, `#F1F5F9`
  - Texto / Metadatos: `#1E293B`, `#64748B`, `#94A3B8`
- **Componentes Base**: Botones expansibles unificados (`ExpandingButton`), modales accesibles y tarjetas interactivas.

### 3.2. Límites Estrictos de Líneas de Código
- **Componentes de Alta Complejidad** (lógica pesada, editores, stores): Máximo **400 líneas** (tolerancia +20%).
- **Componentes de Baja Complejidad** (UI presentacional, modales simples): Máximo **200 líneas** (tolerancia +20%).
- **Modularización**: Extracción sistemática de lógica hacia Custom Hooks (`_hooks/`) y componentes hijos (`_components/`).

---

## MÓDULO 04 (CORRE 4): Ciberseguridad Híbrida, Hardening, RLS y Criptografía

### 4.1. Row Level Security (RLS) en PostgreSQL
- Todas las tablas (`courses`, `assignments`, `submissions`, `exams`, `evaluation_responses`, `students`, `audit_logs`) cuentan con políticas RLS activas por `auth.uid()`.
- Prevención de ataques IDOR y manipulación de campos (*field tampering*).

### 4.2. Validación Criptográfica y Webhooks
- Firmas HMAC SHA-256 en endpoints receptores de eventos externos.
- Validación de subida de archivos mediante **Magic Bytes** reales (MIME type binario), no solo extensión de archivo.

### 4.3. Custodia y Auditoría Criptográfica
- Registro inmutable de eventos con encadenamiento de hashes (`Hash Chain` / `Merkle Tree`) para trazabilidad de calificaciones.
- Grafo de proveniencia de datos para auditoría de integridad académica.

---

## MÓDULO 05 (CORRE 5): Núcleo de IA, MLOps, Validación Matemática y Circuit Breakers

### 5.1. Gemelo Digital y Filtro de Kalman
Para estimar la trayectoria de rendimiento del alumno y filtrar el ruido en evaluaciones:
- **Ecuación de Predicción de Estado**:
  $$\hat{x}_{k|k-1} = F_k \hat{x}_{k-1|k-1} + B_k u_k$$
- **Ecuación de Covarianza de Error**:
  $$P_{k|k-1} = F_k P_{k-1|k-1} F_k^T + Q_k$$
- **Ganancia de Kalman**:
  $$K_k = P_{k|k-1} H_k^T (H_k P_{k-1|k-1} H_k^T + R_k)^{-1}$$
- **Actualización de Estado**:
  $$\hat{x}_{k|k} = \hat{x}_{k|k-1} + K_k (z_k - H_k \hat{x}_{k|k-1})$$

### 5.2. Patrón Circuit Breaker para LLMs
- **Nivel Primario**: Google Gemini 2.5 Flash (alta velocidad, bajo costo).
- **Nivel Secundario / Fallback**: Modelos Open Source locales (vLLM / Ollama Llama 3) activados automáticamente ante timeouts, errores 429 (Rate Limit) o fallas de red con *Exponential Backoff*.

---

## MÓDULO 06 (CORRE 6): Arquitectura Multi-Agente, Servidor MCP y Guardrails Éticos

### 6.1. Orquestación Multi-Agente
- **Agente Orquestador**: Coordina la intención pedagógica del docente.
- **Agente Recuperador (RAG / GraphRAG)**: Extrae contexto semántico de los materiales de clase.
- **Agente Validador / Evaluador**: Auto-califica reactivos o actividades gamificadas con estricto apego a criterios.

### 6.2. Guardrails de Entrada y Salida
- Filtrado de PII (Información Personal Identificable).
- Mitigación activa de Prompt Injection directo e indirecto.
- Detección de sesgos y prevención de alucinaciones.

---

## MÓDULO 07 (CORRE 7): Integración OCR de Alto Rendimiento (Unlimited-OCR) en GCP con Fallback

### 7.1. Despliegue Costo-Eficiente de OCR
- Despliegue en **Google Cloud Run con GPU (NVIDIA L4)** configurado con `min-instances=0` (escala a cero real cuando no se procesan exámenes/documentos).
- Límite diario estricto de invocaciones (`OCR_MAX_REQUESTS_PER_DAY`).

### 7.2. Fallback Transparente
- Si el servicio OCR de GPU no está disponible, el cliente entra en bypass y transfiere el binario directamente al pipeline multimodal de Gemini, garantizando cero interrupciones de servicio.

---

## MÓDULO 08 (CORRE 8): Integridad Académica, Esteganografía Unicode y Watermark Docente

### 8.1. Marcadores Invisibles de Integridad
- Inserción esteganográfica de caracteres Unicode de ancho cero:
  - `U+200B` (Zero-Width Space)
  - `U+200C` (Zero-Width Non-Joiner)
  - `U+200D` (Zero-Width Joiner)
- Permite al docente rastrear si un texto fue generado sin edición a través de prompts pre-marcados.

### 8.2. Advertencia Ética
- El watermark actúa como una señal de alerta y apoyo pedagógico para iniciar un diálogo formativo con el estudiante, no como prueba disciplinaria infalible.

---

## MÓDULO 09 (CORRE 9): Double-Check Implacable, QA Técnico y Cierre de Pendientes

### 9.1. Matriz de Verificación Técnica
- Comprobación de que cada componente creado tenga su suite de pruebas correspondiente.
- Verificación de tipos TypeScript (`tsc --noEmit` $\rightarrow$ 0 errores).
- Validación de calidad y formato ESLint (`eslint` $\rightarrow$ 0 warnings/errores).

### 9.2. Eliminación de Pendientes Falsos
- Resolución integral en código de configuraciones de alias, tipados y rutas, dejando únicamente pendientes reales de infraestructura (claves privadas y variables de producción).

---

## MÓDULO 10 (CORRE 10): Investigación Científica (Papers Q1), Estrategia Open Source y Case Study

### 10.1. Propuestas de Publicación Científica (JCR Q1)
- **Paper 1: MLOps Frugal y Filtrado de Kalman en Educación**:
  - Modelado de trayectorias académicas con recursos de cómputo limitados.
  - Revistas objetivo: *Computers & Education (Elsevier)*, *IEEE Transactions on Learning Technologies*.
- **Paper 2: Arquitectura de Seguridad Híbrida y Detección de Integridad Académica**:
  - Detección de plagio asistido por IA y esteganografía robusta.
  - Revistas objetivo: *Internet of Things / Journal of Systems Architecture*.

### 10.2. Licenciamiento Open Source y Case Study
- Modularización de componentes bajo licencia Apache 2.0.
- Publicación del caso de éxito: *"Ingeniería Frugal en el Sureste de México: Plataforma de Educación e IA de Cero Costo"*.

---

## MÓDULO 11 (CORRE 11): Unificación SQL, Consolidación de Credenciales y Despliegue de Edge Functions

### 11.1. Migración SQL Idempotente Unificada
- Archivo consolidado de esquema de base de datos con sentencias `CREATE TABLE IF NOT EXISTS`, índices y políticas RLS unificadas.

### 11.2. Checklist de Variables de Entorno (`.env.example`)
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto de Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Llave anónima pública del cliente.
- `SUPABASE_SERVICE_ROLE_KEY`: Llave de servicio segura para Edge Functions.
- `GEMINI_API_KEY`: Clave de acceso a Google AI Studio.

### 11.3. Despliegue de Edge Functions
Comandos estandarizados de despliegue:
```bash
supabase functions deploy generate-rubric-ia --project-ref inhauwsdbgtiofxxpggp
supabase functions deploy bulk-evaluate-exams --project-ref inhauwsdbgtiofxxpggp
supabase functions deploy compute-student-risk-signals --project-ref inhauwsdbgtiofxxpggp
supabase functions deploy sync-grading-matrix --project-ref inhauwsdbgtiofxxpggp
```

---
*Manual Maestro consolidado y sincronizado conforme a los 11 módulos de instrucciones.*
