# ─────────────────────────────────────────────────────────────────────────
# Servidor OCR autohospedado: baidu/Unlimited-OCR (DeepSeek-OCR + Reference
# Sliding Window Attention + DeepEncoder, MIT) servido con vLLM detrás de una
# API OpenAI-compatible (/v1/chat/completions). Consumido por
# supabase/functions/_shared/ocrClient.ts — ver
# docs/05_OCR_Unlimited_Integracion.md para arquitectura/decisión de
# plataforma/costo.
#
# CÓDIGO, NO EJECUCIÓN: este Dockerfile se entrega como manifiesto de
# despliegue (CORRE 7, Fase 2, permitido explícitamente sin desplegar a GCP
# real — no hay proyecto/credenciales GCP en este entorno). Requiere GPU
# NVIDIA real (L4/A100/H100, CUDA 12.9+) — NO existe modo CPU para este
# modelo, por eso la imagen base es la oficial de vLLM con soporte CUDA, no
# una imagen genérica de Python.
#
# Build real (pendiente de que el usuario provisione el proyecto GCP, ver
# docs/05_OCR_Unlimited_Integracion.md "## PENDIENTE"):
#   docker build -t gcr.io/<PROJECT_ID>/unlimited-ocr:latest -f deploy/ocr-unlimited/Dockerfile .
#   docker push gcr.io/<PROJECT_ID>/unlimited-ocr:latest
# ─────────────────────────────────────────────────────────────────────────

# Imagen oficial de vLLM con CUDA — evita compilar flash-attention/CUDA
# kernels desde cero, que es la razón por la que este servicio NO puede
# correr en una imagen Python genérica ni en CPU.
FROM vllm/vllm-openai:latest

# baidu/Unlimited-OCR publica sus pesos en Hugging Face bajo el mismo
# nombre de repo. Se fija por variable de build (no hardcodeado) para poder
# apuntar a un mirror privado/versión específica sin tocar este Dockerfile.
ARG MODEL_ID=baidu/Unlimited-OCR
ARG MAX_MODEL_LEN=8192
ARG GPU_MEMORY_UTILIZATION=0.90

ENV MODEL_ID=${MODEL_ID} \
    MAX_MODEL_LEN=${MAX_MODEL_LEN} \
    GPU_MEMORY_UTILIZATION=${GPU_MEMORY_UTILIZATION} \
    # vLLM sirve la API OpenAI-compatible en este puerto por defecto —
    # Cloud Run inyecta $PORT en runtime; el ENTRYPOINT abajo lo respeta.
    PORT=8080

EXPOSE 8080

# --served-model-name fija el nombre que el cliente debe mandar en "model"
# (ocrClient.ts usa OCR_MODEL, default "unlimited-ocr") — desacopla el
# nombre público de la API del repo_id real de Hugging Face.
# --max-num-seqs=1: la GPU sirve UNA request de OCR a la vez (frugal por
# diseño — el rate limit diario en ocrClient.ts ya asume bajo volumen, no
# hace falta paralelismo dentro de la propia instancia).
#
# Forma shell (no exec) A PROPÓSITO: en forma exec (array JSON) Docker NO
# expande variables de entorno ($PORT lo inyecta Cloud Run en runtime, no en
# build time) — con forma shell sí se expanden antes de ejecutar.
ENTRYPOINT python3 -m vllm.entrypoints.openai.api_server \
    --model "${MODEL_ID}" \
    --served-model-name unlimited-ocr \
    --max-model-len "${MAX_MODEL_LEN}" \
    --gpu-memory-utilization "${GPU_MEMORY_UTILIZATION}" \
    --max-num-seqs 1 \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --trust-remote-code
