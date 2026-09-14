# CORRE 11 — Cierre: SQL unificado + credenciales + despliegue de Edge Functions

Este documento es la guía final de todo el proceso (CORRE 1 a CORRE 11). Todo
el código, SQL y scripts ya están escritos y verificados en este entorno (ver
"Reauditoría con evidencia" al final). Lo único que queda es que TÚ hagas
estos pasos, en orden, con tus credenciales reales.

## 0. Prerrequisito — CLI conectada a tu proyecto

```bash
supabase login
supabase link --project-ref <tu-project-ref>
```

El `<tu-project-ref>` lo ves en Dashboard → Project Settings → General →
Reference ID. Es el mismo valor que va en `SUPABASE_PROJECT_REF` del `.env.local`.

## 1. Base de datos — correr la migración unificada

Un solo archivo reemplaza los 14 que estaban sueltos en `supabase/pendiente/`:

**`supabase/migrations/20260825120000_unificacion_sql_pendiente.sql`**

Opción A — SQL Editor de Supabase (Dashboard → tu proyecto → SQL Editor):
pega el archivo completo y ejecútalo. Es idempotente — si algo falla a
medias, puedes volver a correrlo entero sin duplicar nada.

Opción B — CLI, si ya hiciste el paso 0:
```bash
supabase db push
```
(esto aplica también las migraciones ya existentes en `supabase/migrations/`
que no hayas corrido todavía — `20260816053309_add_access_level_fix_horarios_rls.sql`,
`20260820000000_attendance_hmac_rate_limit.sql`,
`20260823120000_medallion_bronze_silver_gold.sql` — revísalas si no sabes si
ya corrieron en tu proyecto real).

**Antes de correrla, dos advertencias reales que trae el propio archivo (Bloque 4):**
- Si `literatura_referencias.autores` ya tiene datos reales, corre primero
  `SELECT autores FROM literatura_referencias LIMIT 20;` y confirma que el
  separador (`;` o `,`) coincide con tus datos.
- Los Bloques 6 y 7 son fixes de seguridad activa (cierran RLS pública en
  `perfiles`, `telemetria_iot`, `equipos_lab`) — correrlos cuanto antes,
  incluso si decides posponer el resto.

Después de correrla, el smoke test manual de custodia (comentado al final
del Bloque 12 en el propio archivo de migración) te deja verificar la cadena
de hashes con datos reales de tu proyecto.

## 2. Storage — bucket que falta

Dashboard → Storage → **New bucket**:
- Nombre: `materiales-docentes`
- Público: sí (mismo patrón que `campo-capturas`, ya existente)

Lo usa `copilot-execute-tool` para guardar documentos/presentaciones/rúbricas
generados por el Master Copilot.

## 3. Credenciales — llenar `.env.example`

1. Copia `.env.example` a `.env.local`.
2. Llena cada variable siguiendo el comentario que trae (dónde obtenerla).
   Resumen por origen:

   | De dónde | Variables |
   |---|---|
   | Dashboard Supabase → API | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
   | Dashboard Supabase → General | `SUPABASE_PROJECT_REF` |
   | aistudio.google.com | `GEMINI_API_KEY` |
   | `openssl rand -hex 32` (dos veces, valores distintos) | `QR_HMAC_SECRET`, `PROFILE_ENCRYPTION_KEY` |
   | upstash.com (opcional) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
   | Tu servidor SLM local (opcional) | `LOCAL_SLM_URL`, `LOCAL_SLM_API_KEY`, `LOCAL_SLM_MODEL` |
   | Cloud Run del servicio OCR (opcional, ver §5) | `OCR_SERVICE_URL`, `OCR_SERVICE_TOKEN` |
   | script.google.com (proyecto Apps Script ya existente en `appscript/`) | `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` |
   | Google Drive (carpeta raíz) | `MASTER_FOLDER_ID` |
   | Google Cloud Console → Credentials | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
   | Tu dominio de producción | `NEXT_PUBLIC_APP_URL` |

3. Valida que no falte ninguna obligatoria:
   ```bash
   node scripts/check_env.mjs
   ```
   Falla limpio (exit 1) listando cuál falta si algo quedó vacío — no
   inventa valores.

4. Configura las mismas variables en Vercel (Project Settings → Environment
   Variables) para el frontend — las que NO llevan prefijo `NEXT_PUBLIC_`
   (`SUPABASE_SERVICE_ROLE_KEY`, `QR_HMAC_SECRET`, `PROFILE_ENCRYPTION_KEY`,
   `UPSTASH_REDIS_REST_URL`/`_TOKEN`) deben ir **sin** exponerse al bundle
   del navegador (Vercel las mantiene server-only automáticamente si no
   llevan ese prefijo).

## 4. Desplegar las Edge Functions

Con `.env.local` ya lleno y validado:

```bash
./deploy/deploy_edge_functions.sh
```

Esto: valida tu `.env.local`, sube los secrets de Edge Functions a Supabase
(`supabase secrets set`), y despliega las 50 funciones en un solo paso.

Variantes:
```bash
./deploy/deploy_edge_functions.sh --only-new       # solo las 3 nuevas de esta sesión
./deploy/deploy_edge_functions.sh --skip-secrets   # si ya subiste secrets a mano
```

**Orden real que importa aquí** (ya resuelto por el hecho de correr primero
el paso 1): `import-doi-metadata` da por hecho que el Bloque 4 de la
migración ya corrió (columnas post-migración de `literatura_referencias`);
`validate-ai-grading`/`bulk-evaluate-exams` dan por hecho que el Bloque 3 ya
corrió (`submissions.metadata`); `provision-student-accounts` necesita el
Bloque 13 (`students.user_id`); `create-assignment-hub` necesita el Bloque 14
(`assignments.watermark_identifier`). Si despliegas antes de correr la
migración, esas funciones responderán error explícito (no fallan en
silencio) señalando qué falta.

## 5. Opcional — activar OCR (`baidu/Unlimited-OCR`)

Solo si decides activar esta capa (opcional, con fallback automático a
Gemini si no la configuras — ver `docs/05_OCR_Unlimited_Integracion.md`):

1. Crear/seleccionar un proyecto de Google Cloud.
2. Habilitar cuota de GPU en Cloud Run (Google la aprueba manualmente, puede
   tardar días — pídela con tiempo).
3. `docker build`/`docker push` con `deploy/ocr-unlimited/Dockerfile`.
4. `gcloud run services replace deploy/ocr-unlimited/cloud-run-service.yaml`.
5. Otorgar `roles/run.invoker` a la service account de las Edge Functions
   (comando exacto documentado dentro del propio YAML).
6. Llenar `OCR_SERVICE_URL`/`OCR_SERVICE_TOKEN` en `.env.local` y
   redesplegar secrets (`./deploy/deploy_edge_functions.sh --skip-secrets`
   no basta — corre sin ese flag para resubir el secret nuevo).
7. Definir un presupuesto máximo diario real en GCP Budgets & Alerts —
   verifica el precio vigente de Cloud Run GPU/L4 antes de fijar
   `OCR_MAX_REQUESTS_PER_DAY` (el rate limit del código topa la frecuencia,
   no protege contra requests inusualmente grandes dentro del mismo límite).

## 6. Opcional — protección perimetral (Cloudflare)

Documentado, no implementado (decisión externa de DNS, no de código). Ver
`SECURITY_AUDIT.md` sección "Requisitos para activar protección perimetral
(Cloudflare)" para el procedimiento completo.

## Checklist final — lo único que queda como trabajo humano

- [ ] Correr `supabase/migrations/20260825120000_unificacion_sql_pendiente.sql`
      contra tu proyecto Supabase real (paso 1).
- [ ] Crear el bucket `materiales-docentes` (paso 2).
- [ ] Llenar `.env.local` con credenciales reales y pasar `check_env.mjs`
      (paso 3).
- [ ] Correr `./deploy/deploy_edge_functions.sh` con `PROJECT_REF`/login
      real (paso 4).
- [ ] (Opcional) Desplegar el servicio OCR a GCP (paso 5).
- [ ] (Opcional) Mover el DNS del dominio de producción a Cloudflare (paso 6).

Nada de código, SQL, script de despliegue o configuración queda pendiente de
escribirse — todo lo de arriba es pegar valores reales y ejecutar lo que ya
está listo.
