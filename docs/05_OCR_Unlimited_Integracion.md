# Módulo 05 — Integración OCR (`baidu/Unlimited-OCR`)

CORRE 7 de 11. Depende del hallazgo de CORRE 6
(`docs/04_Multi_Agente_MCP.md` §4.6): en este repo no existía ningún paso de
OCR/extracción de texto de PDF — las 3 funciones que procesan PDFs
(`evaluate-submissions-ia`, `detect-cross-plagiarism`,
`intelligent-file-parser`) mandaban el archivo completo como binario
(`inline_data`/`inlineData`) directo a Gemini multimodal. Este módulo
implementa el paso de OCR que faltaba, con fallback automático al
comportamiento anterior si el servicio OCR no está disponible.

---

## 1. Qué es `baidu/Unlimited-OCR`

- Repositorio: https://github.com/baidu/Unlimited-OCR — licencia MIT.
- Modelo Mixture-of-Experts de **30B de parámetros totales, 5B activados**
  por inferencia (arquitectura MoE: solo una fracción de los expertos se
  activa por token, de ahí que 5B — no 30B — sea el costo de cómputo real
  por request).
- Componentes clave (según el repo):
  - **DeepEncoder**: encoder visual optimizado para documentos de alta
    resolución sin perder detalle de texto pequeño/denso (tablas, notas al
    pie).
  - **Reference Sliding Window Attention**: mecanismo de atención que
    procesa el documento en ventanas deslizantes con referencia cruzada
    entre ventanas — reduce el costo cuadrático de atención completa sobre
    documentos largos/alta resolución sin perder contexto entre secciones
    contiguas.
  - Basado en la línea DeepSeek-OCR (extracción de texto + comprensión de
    layout: tablas, columnas, orden de lectura) en vez de OCR clásico
    carácter-por-carácter.
- **Requiere GPU NVIDIA real. No existe modo CPU.** CUDA 12.9+, contenedores
  vLLM listos para GPUs Hopper (H100/H200); el propio repo documenta que
  también corre en GPUs más chicas como L4/A100, con más latencia — la vía
  usada aquí (ver §3).
- **VRAM**: para un MoE de 30B/5B-activados servido con vLLM, el requisito
  práctico ronda 24GB+ de VRAM con cuantización/`gpu-memory-utilization`
  ajustado (perfil usado en `deploy/ocr-unlimited/Dockerfile`:
  `--gpu-memory-utilization 0.90` sobre una L4 de 24GB) — suficiente para
  cargar los pesos activos + KV-cache de un documento a la vez
  (`--max-num-seqs 1`, ver §4). GPUs con menos VRAM requerirían
  cuantización adicional (no configurada en este manifiesto — fuera de
  alcance de esta integración inicial).

## 2. Vía de despliegue: vLLM, API OpenAI-compatible

Unlimited-OCR se sirve con **vLLM** (imagen Docker oficial
`vllm/vllm-openai`, ver `deploy/ocr-unlimited/Dockerfile`), que expone una
API **compatible con OpenAI Chat Completions**
(`POST /v1/chat/completions`) — el mismo contrato que ya usa
`_shared/localSlmFallback.ts` para su servidor SLM local opcional. Esto es
lo que permite que `_shared/ocrClient.ts` (ver §6) hable con el servicio sin
un SDK propietario: un `fetch` con `messages` en formato de contenido mixto
(`{type: "text", ...}` + `{type: "image_url", image_url: {url: "data:..."}}`
con el PDF codificado en base64 como data URL), igual que la API de OpenAI
Vision.

Fuente: https://github.com/baidu/Unlimited-OCR (README del repo — sección de
despliegue vía vLLM e imagen Docker oficial).

## 3. Decisión de plataforma: Cloud Run con GPU (L4) — no GKE

`docs/01_ARQUITECTURA_DEVOPS_FRUGAL.md` (CORRE 2, §1.2) ya define la
infraestructura de cómputo del proyecto:

> Fase 1 (ahora): **OCI Always Free — OKE** ($0, Kubernetes gestionado en
> Oracle Cloud). Fase 2 (solo si se satura, medido con Prometheus/Grafana):
> **GKE Autopilot**.

Es decir: **el proyecto NO tiene hoy un clúster GKE activo** — usa OKE
(Oracle) como base gratuita, con GKE Autopilot reservado como paso futuro
condicional a una métrica de saturación que aún no se ha medido. La regla
de CORRE 7 ("si el repo ya usa GKE, prioriza GKE para no duplicar
plataforma") no aplica literalmente: no hay GKE que reutilizar, y aunque lo
hubiera, GKE Autopilot no soporta hoy `minReplicas=0` con GPU de la misma
forma inmediata que Cloud Run (Autopilot factura por pod incluso en reposo
salvo configuración de escalado a cero más compleja con node pools GPU
dedicados). Se elige **Cloud Run con GPU (NVIDIA L4)**:

| Criterio | Cloud Run GPU (L4) | GKE GPU node pool |
|---|---|---|
| Escala a cero real | Sí, nativo (`minScale=0`) — cero instancias facturadas sin tráfico | Requiere autoscaler de node pool a `min=0`, más lento en despertar (aprovisiona un nodo GPU completo, no solo un contenedor) |
| Operación adicional | Ninguna — mismo modelo serverless que ya usa el resto del proyecto (Edge Functions, Vercel) | Requiere gestionar un clúster GKE nuevo (el proyecto no tiene uno hoy) solo para esto — exactamente la "nueva plataforma" que CORRE 7 pide evitar si se puede |
| Autenticación/red | `--no-allow-unauthenticated` + invocación con identity token de service account — nativo de Cloud Run | Requiere VPC interna/Ingress privado — más piezas para el mismo resultado |
| Encaja con "Ingeniería Frugal" del repo (docs/01) | Sí — mismo principio de "no re-plataformar por una sola función" que ya usa el repo para no mover Supabase a K8s | Duplicaría plataforma de cómputo por un solo servicio |

**Decisión: Cloud Run con GPU (NVIDIA L4), `min-instances=0`, `max-instances=1`.**
Si en el futuro el proyecto sí migra a GKE Autopilot (Fase 2 de docs/01, por
saturación medida), este servicio se puede re-evaluar entonces — hoy
introducir GKE solo para el OCR sería la "escalera equivocada" que docs/01
ya explícitamente evita para el resto del proyecto.

### Costo estimado

GCP no publica un precio "Cloud Run GPU" separado del precio de la GPU
subyacente: se factura por segundo de uso real de la instancia con GPU
adjunta (más CPU/memoria de esa instancia), igual que el resto de Cloud
Run. La referencia pública más estable para el costo de una GPU **NVIDIA
L4** en GCP es el precio on-demand de Compute Engine (la misma clase de
hardware que Cloud Run GPU factura por segundo):

- **NVIDIA L4: ~US$0.71/hora on-demand** en regiones como `us-central1`
  (dato público, sujeto a cambio — verificar contra la página oficial antes
  de presupuestar).
- Fuente: https://cloud.google.com/compute/gpus-pricing (tabla de precios
  de GPU de Compute Engine, categoría L4) — Cloud Run GPU usa el mismo tipo
  de hardware, facturado por segundo en vez de por instancia reservada; ver
  también https://cloud.google.com/run/pricing (sección GPU) para el
  desglose oficial vigente al momento de aprovisionar.

Con `min-instances=0` y `max-instances=1`, el techo de gasto es: **~US$0.71
× horas reales con al menos una request en vuelo**, nunca facturación por
capacidad reservada 24/7. Combinado con el rate limit diario
(`OCR_MAX_REQUESTS_PER_DAY`, ver §6) y `containerConcurrency=1`, el gasto
máximo teórico por día es acotado y calculable
(`OCR_MAX_REQUESTS_PER_DAY × tiempo_promedio_por_request × $0.71/3600`).

## 4. Manifiestos de despliegue (código, no ejecución)

- **`deploy/ocr-unlimited/Dockerfile`**: imagen `vllm/vllm-openai` sirviendo
  `baidu/Unlimited-OCR` en `/v1/chat/completions`, `--max-num-seqs 1`
  (una request de OCR a la vez por instancia, frugal por diseño).
- **`deploy/ocr-unlimited/cloud-run-service.yaml`**: Cloud Run Service
  (Knative Serving v1) con:
  - `autoscaling.knative.dev/minScale: "0"` — escala a cero real.
  - `autoscaling.knative.dev/maxScale: "1"` — tope duro de instancias GPU
    concurrentes (nunca más de una GPU facturándose a la vez).
  - `run.googleapis.com/gpu-type: nvidia-l4`, `gpu-count: "1"`.
  - **Sin** `roles/run.invoker` para `allUsers` — el servicio NO es público;
    el default de Cloud Run ya es autenticación requerida, documentado
    explícito en el YAML para que sea intención declarada, no un default
    silencioso. Solo la service account de las Edge Functions recibe
    `roles/run.invoker` (comando `gcloud run services
    add-iam-policy-binding`, documentado en el propio YAML).

Ninguno de los dos se ejecutó contra un proyecto GCP real — no hay
proyecto/credenciales GCP en este entorno (ver `## PENDIENTE` al final).
Verificación de sintaxis realizada sin conexión a GCP: ver
`docs/04_Multi_Agente_MCP.md` §4.7 y la sección de verificación de este
mismo módulo más abajo.

## 5. Seguridad: autenticación, rate limiting, hardening

Mismas reglas que CORRE 4 (rate limiting/hardening ya aplicado en
`bulk-evaluate-exams`) y CORRE 5 (`_shared/gemini.ts`, circuit breaker):

1. **Nunca público**: `--no-allow-unauthenticated` (o, en el YAML, ausencia
   deliberada de `roles/run.invoker` para `allUsers`) + invocación
   autenticada con identity token de service account, enviado por
   `ocrClient.ts` como header `Authorization: Bearer <token>` — **nunca**
   en la URL/query string.
2. **Rate limiting diario**: `_shared/ocrClient.ts` reutiliza
   `checkRateLimit()` de `_shared/cache.ts` (el mismo `INCR`+`EXPIRE` sobre
   Upstash Redis que ya usa `bulk-evaluate-exams`), con
   `OCR_MAX_REQUESTS_PER_DAY` (env var, default 200) sobre una ventana de
   24h. **Diferencia deliberada respecto a `bulk-evaluate-exams`**: sin
   backend de Upstash configurado, `checkRateLimit()` degrada a
   `allowed:true` siempre — aceptable para Gemini (cuota grande, de pago
   por token), pero peligroso para una GPU autohospedada de pago por
   segundo. `ocrClient.ts` por eso trata la AUSENCIA de backend de rate
   limit como "servicio no disponible" (fail-closed hacia el fallback), no
   como "sin límite".
3. **Validación de archivo antes de gastar GPU**: reutiliza
   `validateFileBytes()` de `_shared/fileValidation.ts` (magic bytes, mismo
   patrón que `intelligent-file-parser`/`import-ia-students`) + un límite
   explícito de tamaño (`OCR_MAX_FILE_SIZE_BYTES`, default 15MB) — ambos
   ANTES de codificar a base64 y llamar al servicio, para no pagar cómputo
   GPU procesando basura o payloads maliciosos.
4. **Circuit breaker + backoff**: mismo patrón que `_shared/gemini.ts`
   (`consecutiveFailures`/`circuitOpenUntil`, `FAILURE_THRESHOLD=5`,
   `COOLDOWN_MS=30s`) — si el servicio OCR falla repetidamente, no
   responde, o se agotó el rate limit diario, el cliente devuelve
   `{available:false, reason}` de forma controlada (**nunca lanza una
   excepción no controlada**) para que el caller caiga automáticamente al
   comportamiento actual (PDF binario directo a Gemini multimodal).

## 6. `_shared/ocrClient.ts` — contrato

```ts
extractTextWithOcr(bytes: Uint8Array, signal: AbortSignal): Promise<OcrResult>

type OcrResult =
  | { available: true; text: string }
  | { available: false; reason: 'not_configured' | 'invalid_file' | 'file_too_large'
                        | 'rate_limited' | 'circuit_open' | 'timeout' | 'service_error'
      detail?: string }
```

El caller SIEMPRE revisa `result.available` — si es `false` por cualquier
motivo, preserva exactamente el flujo anterior (PDF binario a Gemini). Ver
`supabase/functions/_shared/ocrClient.test.ts` para la cobertura completa
(comparación de extracción mockeada vs. esperado con similitud de
Levenshtein normalizada, rate limit diario, y apertura del circuit
breaker).

## 7. Integración en las 3 funciones que procesan PDF

En `evaluate-submissions-ia`, `detect-cross-plagiarism` e
`intelligent-file-parser`: si `extractTextWithOcr()` devuelve
`available:true`, el texto extraído pasa por `applyInputGuardrail()`
(`_shared/guardrail.ts`) ANTES de continuar — algo antes imposible porque el
contenido viajaba binario. `evaluate-submissions-ia` y
`detect-cross-plagiarism` procesan contenido de ALUMNOS
(`trustedActor=false`, mismo criterio que `bulk-evaluate-exams`): inyección
de alta confianza bloquea esa entrega específica (se marca/loguea, no se
manda a Gemini). `intelligent-file-parser` procesa el Syllabus que sube el
propio DOCENTE (`trustedActor=true`): solo se redacta PII para logging,
nunca se bloquea, mismo criterio que `master-copilot-orchestrator`/
`iot-copilot`. Si el OCR no está disponible por cualquier motivo, el
comportamiento es EXACTAMENTE el de antes de este módulo.

## PENDIENTE (requiere acción humana)

- Crear/configurar el proyecto de GCP donde se aprovisionará este servicio.
- Habilitar cuota de GPU (Google aprueba cuota de GPU manualmente, puede
  tardar días).
- Correr el despliegue real: `docker build`/`docker push` con el
  `Dockerfile` de este módulo, luego
  `gcloud run services replace deploy/ocr-unlimited/cloud-run-service.yaml`.
- Otorgar `roles/run.invoker` a la service account real de las Edge
  Functions (comando documentado en el propio YAML).
- Configurar `OCR_SERVICE_URL`/`OCR_SERVICE_TOKEN` como secrets del
  proyecto Supabase (mismo mecanismo que `GEMINI_API_KEY`/
  `UPSTASH_REDIS_REST_URL`).
- Definir el presupuesto máximo diario real como alerta de facturación de
  GCP (Budgets & Alerts) — el rate limit de `ocrClient.ts` topa la
  FRECUENCIA de llamadas, pero solo una alerta de facturación real protege
  contra un escenario no anticipado (ej. requests inusualmente grandes/
  lentas dentro del mismo límite de conteo).
- Verificar el precio vigente de Cloud Run GPU/L4 contra
  https://cloud.google.com/run/pricing antes de fijar
  `OCR_MAX_REQUESTS_PER_DAY` en producción — el número citado en §3 es
  público pero cambia con el tiempo.
