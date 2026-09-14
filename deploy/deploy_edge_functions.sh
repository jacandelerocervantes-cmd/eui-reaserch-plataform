#!/usr/bin/env bash
# ============================================================================
# deploy_edge_functions.sh — CORRE 11
# ============================================================================
# Despliega TODAS las Edge Functions del proyecto (50) en el orden correcto.
# Requiere que ya hayas hecho, en este orden:
#   1. Correr supabase/migrations/20260825120000_unificacion_sql_pendiente.sql
#      (y las demás migraciones de supabase/migrations/) contra tu proyecto
#      real — varias funciones fallan si su SQL correspondiente no corrió
#      antes (ver README de secrets abajo, punto A).
#   2. `supabase login`
#   3. `supabase link --project-ref <tu-project-ref>`
#   4. Configurar los secrets (paso A de este script, o a mano).
#
# Uso:
#   ./deploy/deploy_edge_functions.sh                # secrets + deploy de las 50
#   ./deploy/deploy_edge_functions.sh --skip-secrets  # solo deploy, secrets ya configurados
#   ./deploy/deploy_edge_functions.sh --only-new      # solo las 3 funciones nuevas de esta sesión
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env.local}"
SKIP_SECRETS=false
ONLY_NEW=false

for arg in "$@"; do
  case "$arg" in
    --skip-secrets) SKIP_SECRETS=true ;;
    --only-new) ONLY_NEW=true ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 1 ;;
  esac
done

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI no está en PATH. Instálala: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

# ── A. Secrets — se leen del .env.local ya validado por check_env.mjs ──────
if [ "$SKIP_SECRETS" = false ]; then
  if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: no existe $ENV_FILE. Copia .env.example a .env.local y llénalo primero." >&2
    exit 1
  fi

  echo "== Validando $ENV_FILE con check_env.mjs antes de subir secrets =="
  node scripts/check_env.mjs "$ENV_FILE"

  echo "== Subiendo secrets a Supabase desde $ENV_FILE =="
  # Solo las variables que las Edge Functions leen con Deno.env.get() — las
  # NEXT_PUBLIC_*/PROFILE_ENCRYPTION_KEY son de Next.js/Vercel, no de aquí.
  EDGE_FUNCTION_VARS=(
    GEMINI_API_KEY GEMINI_MAX_CONCURRENCY GEMINI_MAX_QUEUE
    QR_HMAC_SECRET
    UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN
    LOCAL_SLM_URL LOCAL_SLM_API_KEY LOCAL_SLM_MODEL
    OCR_SERVICE_URL OCR_SERVICE_TOKEN OCR_MODEL OCR_MAX_REQUESTS_PER_DAY OCR_MAX_FILE_SIZE_BYTES OCR_TIMEOUT_MS
    APPS_SCRIPT_URL APPS_SCRIPT_SECRET MASTER_FOLDER_ID
  )
  SECRETS_ARGS=()
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    for wanted in "${EDGE_FUNCTION_VARS[@]}"; do
      if [ "$key" = "$wanted" ] && [ -n "$value" ]; then
        SECRETS_ARGS+=("$key=$value")
      fi
    done
  done < "$ENV_FILE"

  if [ "${#SECRETS_ARGS[@]}" -gt 0 ]; then
    supabase secrets set "${SECRETS_ARGS[@]}"
  else
    echo "AVISO: ninguna variable de Edge Function con valor no vacío encontrada en $ENV_FILE."
  fi
else
  echo "== --skip-secrets: no se tocan los secrets =="
fi

# ── B. Despliegue de funciones ──────────────────────────────────────────────
# _shared/ NO se despliega — Supabase la empaqueta automáticamente dentro de
# cada función que la importa.

NEW_FUNCTIONS=(
  upload-course-material
  submit-assignment-file
  provision-student-accounts
)

ALL_FUNCTIONS=(
  admin-create-account
  admin-overview
  admin-revert-action
  analyze-capture
  analyze-exam-group-results
  analyze-literature-gaps
  analyze-submission-metadata
  build-knowledge-graph
  bulk-evaluate-exams
  calibrate-ai-thresholds
  compute-activity-work-patterns
  compute-research-trends
  compute-student-risk-signals
  confirm-capture
  copilot-execute-tool
  create-assignment-hub
  detect-cross-plagiarism
  enroll-manual
  evaluate-simulation
  evaluate-submissions-ia
  generate-docente-briefing
  generate-exam-ia
  generate-financial-report
  generate-rubric-ia
  generate-tesis-feedback
  graphrag-query
  import-doi-metadata
  import-ia-students
  inicio-bridge
  intelligent-file-parser
  iot-copilot
  master-copilot-orchestrator
  mcp-server
  process-hybrid-material
  provision-course-environment
  provision-student-accounts
  register-attendance
  search-literature
  submit-assignment-file
  summarize-risk-signals
  sync-appointments
  sync-attendance-history
  sync-attendance
  sync-calendar
  sync-correo
  sync-grading-matrix
  sync-schedule
  sync-tablon
  sync-tasks
  upload-course-material
  validate-ai-grading
)

TARGET_LIST=("${ALL_FUNCTIONS[@]}")
if [ "$ONLY_NEW" = true ]; then
  TARGET_LIST=("${NEW_FUNCTIONS[@]}")
fi

echo "== Desplegando ${#TARGET_LIST[@]} función(es) =="
FAILED=()
for fn in "${TARGET_LIST[@]}"; do
  echo "--- supabase functions deploy $fn ---"
  if ! supabase functions deploy "$fn"; then
    FAILED+=("$fn")
  fi
done

echo ""
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "TERMINÓ CON ERRORES en: ${FAILED[*]}" >&2
  exit 1
fi
echo "== Despliegue completo: ${#TARGET_LIST[@]}/${#TARGET_LIST[@]} funciones OK =="
