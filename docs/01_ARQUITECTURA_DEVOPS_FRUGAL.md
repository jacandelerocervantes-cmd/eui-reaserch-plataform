# Módulo 01 — Arquitectura Base, Datos y DevOps Frugal

Auditoría y diseño para EUI (plataforma docente TecNM Tizimín, +1000 usuarios
reales). Alcance fijado por decisión explícita: **exclusivamente Módulo 01**.
Infraestructura de cómputo = **Kubernetes real, 100% en la nube** (nunca
Docker/K3s en una máquina personal, ni siquiera como paso intermedio "frugal").
La idea de que cada docente use su propia API key/IA queda fuera de este
módulo (candidata natural para `04_Multi_Agente_MCP.md`).

---

## 1. Diagnóstico real y topología de red

### 1.1 Estado actual (verificado en código, no en documentación previa)

- **Frontend**: Next.js 16 (Turbopack, App Router), desplegado hoy sobre
  Vercel (`.vercelignore` presente, sin Dockerfile ni manifiestos propios).
- **Backend/datos**: Supabase gestionado — Postgres + Auth + ~28 Edge
  Functions en Deno (`supabase/functions/`), varias de cómputo pesado
  orientado a IA: `generate-exam-ia`, `evaluate-submissions-ia`,
  `bulk-evaluate-exams`, `analyze-exam-group-results`,
  `master-copilot-orchestrator`, `iot-copilot`.
- **Integración Google**: un único webapp de Apps Script (`appscript/Router.gs`)
  al que las Edge Functions llaman por HTTPS (ver
  [docs/MIGRACION_APPSCRIPT_A_API.md](../docs/MIGRACION_APPSCRIPT_A_API.md) —
  ya documentado como punto de fricción futuro, no se repite aquí).
- **Auth/autorización**: middleware (`proxy.ts`) que en **cada request** a una
  ruta protegida llama `supabase.auth.getUser()` — una ida y vuelta de red
  por navegación, sin ninguna capa de caché.
- **Offline-first**: módulo Campo usa IndexedDB local (Dexie) con cola de
  sincronización (`lib/campoDb.ts`) — sin backend propio, se sincroniza contra
  Supabase cuando hay señal.
- **Veredicto de madurez**: es **producción real con arquitectura de MVP**.
  Funciona y sirve a 1000+ usuarios, pero no tiene: caché, balanceo propio
  (depende 100% de lo que Vercel/Supabase dan por defecto), CI/CD explícito,
  pruebas automatizadas, ni un plan de qué pasa cuando una Edge Function de
  IA se satura en época de exámenes. Antes de esta auditoría, cero de eso
  existía — quedó confirmado por búsqueda directa en el repo (sin
  `.github/workflows`, sin `redis`/`memcache` en dependencias, sin
  `*.test.*`).

### 1.2 Topología objetivo (100% nube, Kubernetes real desde el día uno)

```
                     ┌─────────────────────────────┐
  Internet ────────▶ │ Cloud L4 Load Balancer       │  (gratis: 1 LB flexible
                     │ (Oracle Always Free / GKE)   │   incluido en capa free)
                     └──────────────┬───────────────┘
                                    │
                     ┌──────────────▼───────────────┐
                     │ Ingress (ingress-nginx, OSS)  │  TLS vía cert-manager
                     │ + cert-manager (Let's Encrypt)│  (gratis, automático)
                     └──────────────┬───────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                    Namespace: eui-prod                 │
        │  ┌────────────────┐   ┌────────────────┐  ┌─────────┐  │
        │  │ Next.js pods    │   │ Redis (OSS)    │  │ HPA     │  │
        │  │ (Deployment,    │──▶│ - caché sesión │  │ (2-8    │  │
        │  │  2-8 réplicas)  │   │ - caché resp.  │  │  pods)  │  │
        │  │                 │   │   IA repetidas │  └─────────┘  │
        │  └────────┬────────┘   │ - rate limit   │               │
        │           │            └────────────────┘               │
        └───────────┼─────────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ Supabase (gestionado,       │  ← NO se re-platforma. Ya es
        │ fuera del clúster)          │    managed, HA y con backups.
        │ Postgres + Auth + Edge Fns  │    Re-hacerlo en K8s violaría el
        └────────────────────────────┘    principio frugal (duplicar ops).
```

**Por qué Kubernetes real desde el inicio, no K3s/Docker Swarm en local:**
la escalera clásica "Docker Swarm → K3s → GKE" tiene sentido cuando se parte
de cero en una laptop, pero aquí ya hay producción con usuarios reales — un
salto en falso a un entorno personal es el peor escenario (punto único de
fallo físico, sin HA, sin nadie de guardia). Se usa Kubernetes gestionado en
la nube desde el primer día:

| Fase | Proveedor | Costo | Cuándo |
|---|---|---|---|
| **1 (ahora)** | **OCI Always Free — OKE** (control plane gratis de por vida + hasta 4 vCPU / 24 GB ARM Ampere gratis, sin límite de tiempo) | **$0** | Mientras la carga real (medida, no estimada) quepa en esos 4 vCPU/24GB — de sobra para 1000 usuarios con tráfico típico de institución educativa (picos, no sostenido). |
| **2 (si se satura)** | GKE Autopilot (pago por pod, sin gestionar nodos) | Bajo, pago por uso real | Cuando Grafana/Prometheus (ver 1.3) muestre CPU/RAM del clúster OKE sostenido >70% en horario pico durante ≥2 semanas. |

Esto **no reemplaza Vercel de inmediato** — Vercel sigue siendo válido para
el frontend mientras su capa gratuita/hobby alcance. El clúster K8s se
introduce para lo que Vercel *no* resuelve bien de forma gratuita: Redis
persistente, límites de ejecución de las Edge Functions de IA más pesadas
(`bulk-evaluate-exams`, `analyze-exam-group-results`) si llegan a necesitar
más tiempo/CPU del que da el free tier de Supabase Edge Functions, y control
fino de autoscaling. Migrar el frontend al clúster es opcional y solo
recomendable si Vercel deja de ser gratuito a la escala real de la
institución.

### 1.3 Dónde va cada caché y por qué

**Implementado en código** (no solo diseñado) — con una corrección respecto
a la versión anterior de este documento: en vez de un pod Redis dentro del
clúster K8s, se usa **Upstash Redis** (API REST sobre `fetch`, free tier
zero-cost) porque `proxy.ts` corre en **Edge Runtime** (confirmado por el
build: `ƒ Proxy (Middleware)`), que no soporta sockets TCP — un cliente
Redis tradicional (`ioredis`) no funciona ahí. Upstash es el estándar real
para este caso (Vercel Edge + caché distribuida) y sigue siendo Zero-Cost
mientras el uso quepa en 10k comandos/día.

| Caché | Qué evita | Implementación |
|---|---|---|
| **Sesión** (TTL 90s) | La llamada a `supabase.auth.getUser()` en cada request. | [proxy.ts:118-129](../proxy.ts) usando [lib/server/cache.ts](../lib/server/cache.ts), clave = hash SHA-256 del cookie de sesión. |
| **Perfil/rol** (TTL 90s) | El `select role, access_level from profiles` en cada request a ruta protegida. | [proxy.ts:162-173](../proxy.ts), clave = `profile:<user.id>`. |
| **Respuestas de IA repetidas** (TTL 6h) | Volver a pagar/esperar la generación si dos docentes piden el mismo prompt+conteo en `generate-exam-ia`. | [supabase/functions/generate-exam-ia/index.ts](../supabase/functions/generate-exam-ia/index.ts) usando [supabase/functions/_shared/cache.ts](../supabase/functions/_shared/cache.ts), clave = hash de `{prompt, currentCount}`. |
| **Rate limiting** (20 llamadas/min por docente) | Que una ráfaga de `bulk-evaluate-exams` en cierre de semestre agote la cuota de la API de IA. | [supabase/functions/bulk-evaluate-exams/index.ts](../supabase/functions/bulk-evaluate-exams/index.ts), `INCR`+`EXPIRE` vía `checkRateLimit()`. |

Sin `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` configurados (no
existen en este entorno de desarrollo), toda la capa degrada a no-cache/
sin-límite sin romper ningún flujo — verificado en
[lib/server/cache.test.ts](../lib/server/cache.test.ts).

Observabilidad mínima y gratuita para decidir cuándo pasar a la Fase 2:
Prometheus + Grafana OSS como pods en el mismo clúster (o el free tier de
Grafana Cloud, 10k métricas gratis) — sin esto, "cuándo escalar" es
adivinar, no medir.

---

## 2. Arquitectura de datos: por qué NO Databricks/Spark, y qué se propone en su lugar

El módulo pide explícitamente Databricks/Spark con arquitectura Medallón. Se
diseña igual (como se pidió), pero con una advertencia técnica honesta antes
de proponerlo tal cual:

**Databricks/Spark no encaja con el volumen real de esta plataforma.** Es
una institución (TecNM Tizimín), no un proveedor de datos masivos — las
tablas de calificaciones, asistencia y evaluaciones de 1000 usuarios están
en el orden de cientos de miles de filas, no de miles de millones. Montar un
clúster Spark para eso es lo opuesto a "Ingeniería Frugal": añade licencias/
cómputo, un lenguaje de pipeline distinto (PySpark) y superficie operativa
nueva, para resolver un problema que Postgres (donde ya viven los datos)
resuelve directamente. Se documenta esto explícitamente en vez de proponer
Spark solo por seguir la letra del prompt y luego no usarlo nunca.

### 2.1 Medallón adaptado a Postgres — implementado en
[supabase/migrations/20260823120000_medallion_bronze_silver_gold.sql](../supabase/migrations/20260823120000_medallion_bronze_silver_gold.sql)

Todo vive en el mismo Postgres de Supabase, como **schemas separados**, cero
costo adicional, gestionado con `pg_cron` para la orquestación. La versión
anterior de este documento usaba nombres de tabla/columna inventados
(`calificaciones`, `puntaje_maximo`, `semestre`) que **no existen en el
schema real** — se corrigió contra el schema verdadero
(`20260225000320_remote_schema.sql`):

```
schema bronze  → vistas 1:1 sobre las tablas reales (public.grades,
                 public.courses) — cero storage adicional, solo el
                 contrato Medallón.

schema silver  → silver.grades_clean: vista materializada que limpia
                 public.grades.score (numeric, usado como % 0-100):
                   - null → 'pendiente_evaluacion' (no se imputa 0, sesgaría
                     el promedio)
                   - <0 o >100 → 'valor_invalido_revisar' (outlier imposible)
                   - refrescada cada 6h vía pg_cron.

schema gold    → gold.course_split (partición train/val/test, ver 2.2) +
                 gold.desempeno_estudiante_curso (agregado por alumno/curso
                 con el split heredado del curso).
```

### 2.2 Partición train/validation/test en la capa Gold (sin data leakage) — implementado

`public.courses` **no tiene columna "semestre"** (verificado contra el
schema real) — la partición del módulo se rediseñó sobre lo que sí existe:
split **por `course_id`**, ordenado cronológicamente por
`courses.created_at`, 70/15/15, determinista (sin aleatoriedad). Todas las
calificaciones de un mismo curso caen en el mismo split — evita fuga
temporal (train nunca ve un curso posterior a uno de test) y fuga por
identidad de curso (ningún `course_id` puede terminar en dos splits, por
construcción del índice único).

- **SQL** (capa Gold real): `gold.course_split` en la migración de arriba,
  vía `row_number() over (order by created_at, id)` + corte por percentil —
  incluye un `do $$ ... raise exception ... $$` que falla la migración si
  algún `course_id` termina con más de un split.
- **Algoritmo de referencia, probado con Vitest** (mismo cálculo, en
  TypeScript, reutilizable por el Módulo 03/MLOps):
  [lib/dataSplit.ts](../lib/dataSplit.ts) —
  `computeChronologicalSplit()` + `findLeakage()`.
- **Test de Data Leakage real** (el que pide explícitamente este módulo —
  "verificar computacionalmente que la intersección de índices/IDs entre
  splits es vacía"):
  [lib/dataSplit.test.ts](../lib/dataSplit.test.ts) — incluye un caso que
  **inyecta una fuga real** (mismo `course_id` en dos splits, el bug
  concreto que produciría un `LEFT JOIN` mal escrito) y confirma que el
  detector la atrapa, no solo que el camino feliz pasa. Corrida real:
  ver sección 4.1.

---

## 3. Infraestructura Zero-Cost y CI/CD

### 3.1 Resumen de la escalera (ya detallada en 1.2)

OCI Always Free (OKE) como base permanente en $0 → GKE Autopilot solo si la
métrica real de uso lo justifica. Sin Docker Swarm/K3s local en ningún punto
de la ruta, por decisión explícita.

### 3.2 Pipeline CI/CD — implementado en este mismo cambio

Trunk-based (una sola rama larga, `main`; ramas de feature de vida corta vía
PR). Se agregó [.github/workflows/ci.yml](.github/workflows/ci.yml):
tipos → lint → tests unitarios → build, como gate obligatorio antes de
mergear a `main`. Usa GitHub Actions free tier (2000 min/mes en repos
privados, ilimitado en públicos) — cero costo mientras el equipo sea pequeño.

**No se agregó un job de *deploy*** al clúster K8s en este workflow: no
existe todavía el clúster OKE real ni sus credenciales. Cuando se aprovisione
(Fase 1 de 1.2), el siguiente paso es añadir un job `deploy` autenticado por
OIDC (sin secretos de larga duración) que haga `kubectl apply`/`helm upgrade`
contra el namespace `eui-prod` tras pasar el quality gate.

---

## 4. QA — Test Cases (implementados y corridos, con salida real)

### 4.1 Pruebas unitarias

`npm test` (Vitest) — **13/13 tests pasando** (3 originales de
`lib/campoDb.test.ts` + 10 nuevos):

```
 Test Files  3 passed (3)
      Tests  13 passed (13)
   Duration  2.43s
```

- [lib/campoDb.test.ts](../lib/campoDb.test.ts) (3 tests, sin cambios en
  esta pasada) — cola de sincronización offline-first del módulo Campo.
- [lib/server/cache.test.ts](../lib/server/cache.test.ts) (2 tests) — hash
  determinista y degradación segura sin credenciales de Upstash.
- [lib/dataSplit.test.ts](../lib/dataSplit.test.ts) (8 tests) — split
  70/15/15 correcto, determinista, orden cronológico estricto, **y el test
  de Data Leakage** que exige el módulo: detecta una fuga real inyectada
  (mismo `course_id` en dos splits) sin falsos positivos.

`npx tsc --noEmit` limpio. `npm run lint` → 0 errores, 10 warnings
preexistentes ajenos a este cambio (ninguno en archivos nuevos/tocados).
`npm run build` exitoso — confirma que `proxy.ts` sigue compilando como
Middleware de Edge Runtime con la caché integrada.

`deno check` sobre las 3 Edge Functions tocadas
(`_shared/cache.ts`, `generate-exam-ia/index.ts`,
`bulk-evaluate-exams/index.ts`) → limpio, sin errores de tipos.

### 4.2 Prueba de estrés/rendimiento — corrida real, con hallazgo

[k6/stress-cierre-semestre.js](../k6/stress-cierre-semestre.js) (k6, OSS,
gratis) define el escenario completo (300 VUs / 8min) para correr contra
staging — no se ejecutó a esa escala contra producción real, como ya
indicaba este documento. En esta pasada se instaló k6 (`winget install
GrafanaLabs.k6`) y se corrió una versión reducida del mismo escenario
(15-30 VUs, ~35s) contra un servidor local, dos veces:

| Servidor | p95 `http_req_duration` | Umbral `<2s` | Errores |
|---|---|---|---|
| `next dev` (Turbopack, compilación en frío) | **12.67s** | ✗ falla | 0% |
| `next start` (build de producción) | **79.95ms** | ✓ pasa | 0% |

**Hallazgo real (no hipotético):** contra el dev server la prueba de
umbrales falla — pero es un artefacto esperado de `next dev` (compila cada
ruta la primera vez que se pide, sin las optimizaciones de build), no un
problema de la app. Contra el build de producción (`next start`, el modo
real de despliegue) los umbrales pasan con margen amplio (p95 <80ms vs el
límite de 2s). Conclusión: la app en su forma de despliegue real no muestra
el problema de latencia que sí muestra en desarrollo — dato relevante para
no alarmarse si alguien corre esta prueba contra `next dev` por error.

---

## 5. Pendiente explícito (requiere acción humana — fuera de lo que se puede ejecutar en este entorno)

- **Crear cuenta Upstash y configurar `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN`** como secret en Vercel (para `proxy.ts`) y en
  los secrets del proyecto Supabase (para las Edge Functions) — la caché
  está implementada y probada en modo degradado (sin credenciales = sin
  cache, no rompe nada), pero activar el ahorro real de latencia/tráfico
  requiere esa cuenta.
- **Aplicar la migración `20260823120000_medallion_bronze_silver_gold.sql`**
  al proyecto Supabase real (`supabase db push`, o vía el flujo ya usado
  para `supabase/pendiente/`) — no se pudo ejecutar en este entorno: no hay
  Docker/`supabase start` local disponible para levantar Postgres, y no se
  tocó el proyecto de producción (+1000 usuarios reales) sin autorización
  explícita. El SQL fue verificado por lectura contra el schema real
  (`20260225000320_remote_schema.sql`), pero su primera ejecución real
  contra una base de datos queda pendiente.
- Aprovisionar el clúster OKE real y conectar el job de deploy al CI —
  requiere credenciales de nube que no existen en este entorno.
- La idea de que cada docente use su propia API key de IA — confirmado con
  el usuario que se diseña en `04_Multi_Agente_MCP.md`, no aquí.
- 10 warnings de ESLint preexistentes, ajenos a este módulo (ver 4.1) — no
  se tocaron por no ser parte del alcance de Módulo 01/01_B.
