#!/usr/bin/env node
// Valida que las variables de entorno requeridas por el proyecto (ver
// .env.example) estén presentes y no vacías. No inventa ni rellena valores
// por defecto para secretos reales — si falta una obligatoria, falla con
// exit code 1 y un mensaje señalando exactamente cuál.
//
// Uso:
//   node scripts/check_env.mjs                 # lee .env.local
//   node scripts/check_env.mjs .env.production  # lee otro archivo

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envFile = resolve(projectRoot, process.argv[2] || ".env.local");

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const vars = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

// OBLIGATORIAS: sin esto, features del código actual fallan en producción.
const REQUIRED = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Dashboard Supabase -> Project Settings -> API"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Dashboard Supabase -> Project Settings -> API"],
  ["SUPABASE_URL", "mismo valor que NEXT_PUBLIC_SUPABASE_URL, sin el prefijo"],
  ["SUPABASE_ANON_KEY", "mismo valor que NEXT_PUBLIC_SUPABASE_ANON_KEY, sin el prefijo"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Dashboard Supabase -> Project Settings -> API -> service_role"],
  ["SUPABASE_PROJECT_REF", "Dashboard Supabase -> Project Settings -> General -> Reference ID"],
  ["GEMINI_API_KEY", "aistudio.google.com -> Get API key"],
  ["QR_HMAC_SECRET", "generar con: openssl rand -hex 32"],
  ["PROFILE_ENCRYPTION_KEY", "generar con: openssl rand -hex 32"],
  ["APPS_SCRIPT_URL", "script.google.com -> tu proyecto -> Deploy -> Web app -> URL /exec"],
  ["APPS_SCRIPT_SECRET", "mismo valor que WEBHOOK_SECRET/APPS_SCRIPT_SECRET en Router.gs"],
  ["MASTER_FOLDER_ID", "Google Drive -> carpeta raíz -> Compartir -> Copiar enlace"],
  ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "Google Cloud Console -> Credentials -> API key (Maps JavaScript API)"],
  ["NEXT_PUBLIC_APP_URL", "URL pública de producción del frontend"],
];

// OPCIONALES: el código ya tiene fallback testeado si faltan. Solo se avisa,
// no se falla por ellas.
const OPTIONAL = [
  ["UPSTASH_REDIS_REST_URL", "upstash.com -> Redis -> Create database -> REST API"],
  ["UPSTASH_REDIS_REST_TOKEN", "upstash.com -> Redis -> Create database -> REST API"],
  ["LOCAL_SLM_URL", "URL de tu servidor Ollama/LM Studio/vLLM"],
  ["LOCAL_SLM_API_KEY", "solo si tu servidor SLM local requiere auth"],
  ["LOCAL_SLM_MODEL", "nombre del modelo servido localmente"],
  ["OCR_SERVICE_URL", "URL de Cloud Run tras desplegar deploy/ocr-unlimited/"],
  ["OCR_SERVICE_TOKEN", "gcloud auth print-identity-token, o service account key"],
  ["GEMINI_MAX_CONCURRENCY", "límite de concurrencia hacia Gemini (default en código)"],
  ["GEMINI_MAX_QUEUE", "límite de cola hacia Gemini (default en código)"],
];

const fileVars = parseEnvFile(envFile);
const get = (key) => (fileVars[key] ?? process.env[key] ?? "").trim();

const missingRequired = REQUIRED.filter(([key]) => !get(key));
const missingOptional = OPTIONAL.filter(([key]) => !get(key));

console.log(`check_env: leyendo ${envFile}`);
console.log(`check_env: ${existsSync(envFile) ? "archivo encontrado" : "archivo NO encontrado (solo se usará process.env real, si lo hay)"}`);
console.log("");

if (missingOptional.length > 0) {
  console.log("Opcionales sin configurar (features con fallback ya testeado, no bloquean):");
  for (const [key, where] of missingOptional) {
    console.log(`  - ${key}  (${where})`);
  }
  console.log("");
}

if (missingRequired.length > 0) {
  console.error("FALTAN variables obligatorias:");
  for (const [key, where] of missingRequired) {
    console.error(`  - ${key}  ->  ${where}`);
  }
  console.error("");
  console.error(`check_env: FALLÓ — ${missingRequired.length} obligatoria(s) sin definir en ${envFile}.`);
  process.exit(1);
}

console.log(`check_env: OK — las ${REQUIRED.length} variables obligatorias están presentes y no vacías.`);
process.exit(0);
