# Módulo 09 (CORRE 10) — Papers Q1, estrategia Open Source y Case Study

Este documento es el entregable de CORRE 10. No desarrolla los papers a fondo (metodología
completa + script de validación estadística) por decisión explícita del usuario durante la
FASE 1/2: se guarda el catálogo con los puntos clave marcados, listo para retomar cuando se
decida desarrollar alguno en una sesión dedicada.

## 1. Catálogo de propuestas de investigación (Q1)

Enfoque: cada propuesta parte del **área de aplicación** (la plataforma educativa real, EUI /
TecNM Tizimín, docentes y alumnos, integridad académica, evaluación en contexto de bajo
presupuesto), usando la validación computacional ya existente en el repo como evidencia de
soporte — no como el tema central del paper.

### 1. Evaluación asistida por IA con corrección de ruido y garantía de no-fuga de datos
- **Problema educativo**: cómo una institución de bajo presupuesto puede confiar en
  calificación asistida por IA sin que el ruido de medición perjudique a un alumno, y sin que
  el particionado de datos para validar el sistema filtre información entre cursos.
- **Evidencia ya existente**: `supabase/functions/_shared/kalman.ts` (filtro de Kalman
  escalar y vectorial, detección de outliers), `lib/dataSplit.ts` (`computeChronologicalSplit`,
  `findLeakage`), `aiGradingMetrics.ts` (R²/RMSE), todos con tests numéricos reales.
- **Punto clave metodológico pendiente**: calcular el tamaño de muestra mínimo (número de
  entregas/cursos) para que la validación estadística del sistema sea confiable en una
  institución pequeña — no se ha calculado todavía.
- **Revistas Q1 sugeridas**: *Computers & Education*; *IEEE Transactions on Learning
  Technologies*.

### 2. Mitigación de prompt injection en evaluación académica automatizada (híbrido cloud/edge)
- **Problema educativo**: alumnos que intentan manipular al evaluador de IA a través del
  contenido de su propia entrega, en una arquitectura frugal cloud/edge.
- **Evidencia ya existente**: `supabase/functions/_shared/guardrail.ts`, usado en 27 Edge
  Functions; dataset real de 10 ataques + 10 entradas legítimas en `guardrail.test.ts`
  (recall ≥ 0.9 medido); circuit breaker + fallback a SLM local en `gemini.ts` /
  `localSlmFallback.ts`.
- **Punto clave metodológico pendiente**: *Data Drift* no está implementado en el repo — el
  paper debe tratarlo como gap identificado a futuro (deriva en la distribución de entregas a
  medida que cambian cursos/docentes), no como algo ya medido.
- **Revistas Q1 sugeridas**: *International Journal for Educational Integrity*; revista de
  seguridad aplicada a EdTech (definir según convocatoria vigente).

### 3. Watermark invisible para detectar copy-paste de IA en trabajos académicos
- **Problema educativo**: los detectores estadísticos de texto generado por IA
  (perplexity-based) son poco confiables; un watermark embebido en el texto es un enfoque
  distinto y más defendible académicamente.
- **Evidencia ya existente**: `D-watermark-integridad-academica/watermark_codec.py`
  (Unicode de ancho cero) y `prompt_injection_css.py` (canario CSS), con tests reales
  (`tests/`).
- **Punto clave metodológico pendiente**: medir tasa de supervivencia del watermark ante
  transformaciones reales (copiar a texto plano, parafraseo, distintos editores) — hoy
  documentado como limitación conocida en `GUIA_USO_DOCENTE.md`, no medido cuantitativamente.
- **Revistas Q1 sugeridas**: *International Journal for Educational Integrity*.

### 4. Grafo de proveniencia para explicabilidad y rendición de cuentas de decisiones de IA
- **Problema educativo**: poder auditar el ciclo de vida completo de un dato académico
  (asignación → entrega → evaluación → custodia) cuando una decisión de IA se cuestiona.
- **Evidencia ya existente**: `E-grafo-proveniencia/provenance_graph.py` (`networkx`), con
  tests reales.
- **Punto clave metodológico pendiente**: definir métricas de "auditabilidad" (tiempo para
  reconstruir la cadena completa de un caso, cobertura de entidades) y medirlas sobre casos
  reales o sintéticos.
- **Revistas Q1 sugeridas**: *AI and Ethics*; *Journal of Educational Data Mining*.

### 5. Cadena de custodia forense para evidencia de exámenes digitales
- **Problema educativo/institucional**: garantizar que la evidencia de un examen digital
  (archivo entregado, eventos de supervisión) no pueda alterarse retroactivamente sin
  detección, para sostener un reclamo de integridad académica ante una disputa.
- **Evidencia ya existente**: `lib/server/custody.ts` (hash chain + Merkle tree), con test
  real (CORRE 4).
- **Punto clave metodológico pendiente**: análisis de resistencia a manipulación (qué
  porcentaje de alteraciones detecta la cadena de hashes bajo distintos escenarios de ataque).
- **Revistas Q1 sugeridas**: revista de forense digital / seguridad educativa (definir según
  convocatoria vigente).

### 6. Sistema de alerta temprana de riesgo académico
- **Problema educativo**: identificar alumnos en riesgo de reprobar con la menor cantidad de
  datos posible, en un contexto donde no hay suficiente histórico para modelos pesados.
- **Evidencia ya existente**: `thresholdCalibration.ts` (`shrinkR2`, shrinkage/calibración),
  documentado en `docs/03_Nucleo_IA_MLOps_Matematico.md` (marco BKT/IRT dinámica,
  value-added shrinkage).
- **Punto clave metodológico pendiente**: validar el sistema de alerta contra datos reales de
  desempeño histórico (hoy solo validado con datos sintéticos).
- **Revistas Q1 sugeridas**: *Journal of Educational Data Mining*.

### 7. Arquitectura multi-agente para IA educativa a escala en contexto frugal
- **Problema educativo/institucional**: escalar evaluación e interacción con IA a más de
  1000 usuarios sin presupuesto de infraestructura grande.
- **Evidencia ya existente**: flujo Orquestador/Recuperador/Validador sobre Edge Functions
  (CORRE 6), `_shared/retriever.ts`.
- **Punto clave metodológico pendiente**: medir latencia/costo real bajo carga concurrente
  (ya existe un k6 corrido para otro módulo — CORRE 2 — que podría extenderse aquí).
- **Revistas Q1 sugeridas**: revista de sistemas/AI engineering aplicado a educación (definir
  según convocatoria vigente).

### 8. Auditoría estática automatizada de políticas RLS multi-tenant
- **Problema institucional**: prevenir fugas de datos entre alumnos/cursos en una plataforma
  SaaS educativa multi-tenant sin depender de pruebas de integración costosas.
- **Evidencia ya existente**: `lib/server/rlsPolicyAudit.ts` (CORRE 9), con test real que
  reproduce el efecto acumulado de todas las migraciones SQL.
- **Punto clave metodológico pendiente**: comparar cobertura de esta auditoría estática contra
  un conjunto conocido de vulnerabilidades RLS documentadas en la literatura.
- **Revistas Q1 sugeridas**: revista de ingeniería de software / ciberseguridad aplicada
  (definir según convocatoria vigente).

### 9. OCR con GPU bajo demanda y fallback automático como patrón de ingeniería frugal
- **Problema institucional**: instituciones de bajo presupuesto no pueden mantener GPU
  encendida permanentemente, pero sí necesitan OCR ocasional de alta calidad.
- **Evidencia ya existente**: `_shared/ocrClient.ts` (circuit breaker + rate limit diario),
  `deploy/ocr-unlimited/` (Cloud Run con GPU L4, `min-instances=0`).
- **Punto clave metodológico pendiente**: medir costo real por documento procesado y tiempo de
  cold-start del contenedor con GPU (no desplegado todavía, ver `## PENDIENTE`).
- **Revistas Q1 sugeridas**: revista de frugal computing / sistemas distribuidos (definir
  según convocatoria vigente).

## 2. Estrategia Open Source

### Ruta de directorios de componentes liberables
Los dos componentes ya suficientemente aislados como para publicarse como paquete
independiente bajo licencia **Apache 2.0** son:

- [`D-watermark-integridad-academica/`](../../D-watermark-integridad-academica/) —
  watermark de integridad académica.
- [`E-grafo-proveniencia/`](../../E-grafo-proveniencia/) — grafo de proveniencia.

En esta sesión se agregó a cada uno:
- `LICENSE` (texto canónico Apache License 2.0, descargado de `apache.org`).
- `pyproject.toml` con metadata de empaquetado (`license = "Apache-2.0"`,
  dependencias declaradas explícitamente — `networkx>=3.0` para el grafo de proveniencia).

No se movieron ni duplicaron archivos de código: ambos módulos ya vivían aislados del resto
del monorepo (sin imports cruzados hacia `eui-reaserch-plataform-main`), por lo que la "ruta"
de liberación es simplemente extraer cada carpeta a su propio repositorio público cuando se
decida publicar — no requiere refactor previo.

### Checklist técnico de secretos
Script real: [`scripts/scan_secrets.py`](../../scripts/scan_secrets.py) (raíz del repositorio,
escanea todo el monorepo salvo `node_modules`/`.git`/`.next`/`__pycache__`/etc., busca claves
AWS/Google/GitHub/Slack, bloques de llave privada, JWT y asignaciones genéricas de
secreto/token/password).

**Resultado de la corrida real** (ver FASE 3 más abajo con la salida completa pegada):
6 coincidencias totales, las 6 correctamente identificadas como placeholders/fixtures de test
(`.env.local` con valor literal "placeholder", y tokens de prueba tipo `fake-service-token` en
`hmac.test.ts`/`ocrClient.test.ts`). **Cero secretos reales detectados**, código de salida 0.

## 3. Case Study técnico

Índice completo guardado por separado en
[`CASE_STUDY_MEDIUM_INFOQ_INDICE.md`](./CASE_STUDY_MEDIUM_INFOQ_INDICE.md).

## PENDIENTE (requiere acción humana)

- Decidir a cuál de las 9 propuestas de paper dedicar tiempo de desarrollo real
  (metodología completa + power analysis + redacción) — ninguna se desarrolló a fondo por
  decisión explícita del usuario en esta sesión.
- Decidir la organización/cuenta GitHub bajo la cual publicar `D-watermark-integridad-academica`
  y `E-grafo-proveniencia` (los `pyproject.toml` usan una URL `PLACEHOLDER-ORG` que debe
  reemplazarse antes de publicar).
- Aprobar hacer público cualquiera de los dos repositorios extraídos.
- Elegir y crear cuenta/perfil en la plataforma de publicación del case study (Medium/InfoQ).
