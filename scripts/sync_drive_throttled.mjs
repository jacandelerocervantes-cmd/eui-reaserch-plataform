#!/usr/bin/env node
/**
 * scripts/sync_drive_throttled.mjs
 *
 * Sincronizador controlado Supabase -> Google Apps Script (Drive).
 * Diseñado específicamente para EVITAR RATE LIMITING y LOCK TIMEOUTS en Google Drive/Apps Script.
 *
 * Características de seguridad:
 * 1. Concurrencia = 1 (Secuencial estricto, una petición a la vez).
 * 2. Throttle / Delay entre llamadas (1,200 ms por defecto).
 * 3. Enfriamiento por lotes (cada 15 peticiones pausa 5 segundos).
 * 4. Reintentos automáticos con Backoff exponencial en caso de 429 o Lock Timeout.
 * 5. 100% Idempotente: actualiza Supabase tras cada éxito; si se detiene, continúa donde quedó.
 *
 * Uso:
 *   node scripts/sync_drive_throttled.mjs --teacher=b3245d14-a71b-4f43-bf31-ad234cb12938
 *   node scripts/sync_drive_throttled.mjs --course=6febf6a9-5d58-4dbc-b60b-1c9b2fbf00ec --batch=20
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Carga de variables de entorno desde .env.local si existe
function loadEnv() {
  const envPath = resolve(projectRoot, ".env.local");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const APPS_SCRIPT_SECRET = process.env.APPS_SCRIPT_SECRET;

// Configuración de Throttling
const DELAY_MS = 1300;           // Pausa entre cada llamada
const BATCH_COOLDOWN_MS = 5000;  // Pausa de enfriamiento cada lote
const BATCH_SIZE = 15;           // Tamaño de lote para enfriamiento

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const [key, val] = arg.slice(2).split("=");
      args[key] = val || true;
    }
  }
  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function supabaseRequest(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "PATCH" ? "return=representation" : undefined,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error en Supabase [${res.status}]: ${errText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function callAppsScriptWithRetry(action, payload, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 35000);

      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: APPS_SCRIPT_SECRET,
          action,
          payload,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const data = await res.json();
      if (!data.success) {
        const errorMsg = data.error || JSON.stringify(data);
        // Si es error de Lock o Rate Limit, reintentar con backoff
        if (errorMsg.includes("Lock") || errorMsg.includes("limit") || errorMsg.includes("timed out")) {
          const waitTime = attempt * 4000;
          console.warn(`    ⚠️ [Apps Script Saturation] Intento ${attempt}/${maxRetries}. Pausando ${waitTime}ms por lock/timeout: ${errorMsg}`);
          await sleep(waitTime);
          continue;
        }
        return { success: false, error: errorMsg };
      }
      return { success: true, data: data.data || data };
    } catch (err) {
      console.warn(`    ⚠️ [Excepción Red/Timeout] Intento ${attempt}/${maxRetries}: ${err.message}`);
      if (attempt < maxRetries) {
        await sleep(attempt * 4000);
      } else {
        return { success: false, error: err.message };
      }
    }
  }
  return { success: false, error: "Máximo de reintentos alcanzado" };
}

async function main() {
  const args = parseArgs();
  const targetTeacher = args.teacher || "b3245d14-a71b-4f43-bf31-ad234cb12938";
  const targetCourse = args.course || null;
  const maxItems = args.batch ? parseInt(args.batch, 10) : null;

  console.log("===================================================================");
  console.log(" 🚀 SINCRONIZADOR DRIVE CON RATE LIMITING (EUI RESEARCH PLATFORM)");
  console.log("===================================================================");
  console.log(`Docente Objetivo : ${targetTeacher}`);
  if (targetCourse) console.log(`Materia Filtro   : ${targetCourse}`);
  console.log(`Delay entre ops  : ${DELAY_MS} ms`);
  console.log(`Enfriamiento cada: ${BATCH_SIZE} llamadas (${BATCH_COOLDOWN_MS} ms)`);
  if (maxItems) console.log(`Límite de lote   : ${maxItems} elementos`);
  console.log("-------------------------------------------------------------------\n");

  if (!SUPABASE_URL || !SERVICE_KEY || !APPS_SCRIPT_URL || !APPS_SCRIPT_SECRET) {
    console.error("❌ Faltan credenciales requeridas en el entorno o .env.local:");
    console.error("   - SUPABASE_URL");
    console.error("   - SUPABASE_SERVICE_ROLE_KEY");
    console.error("   - APPS_SCRIPT_URL");
    console.error("   - APPS_SCRIPT_SECRET");
    process.exit(1);
  }

  // 1. Obtener materias
  let courseFilter = `teacher_id=eq.${targetTeacher}`;
  if (targetCourse) courseFilter += `&id=eq.${targetCourse}`;
  const courses = await supabaseRequest(`courses?${courseFilter}&select=id,title,drive_folder_id`);

  console.log(`Materias encontradas: ${courses.length}`);
  let totalProcessed = 0;

  for (const course of courses) {
    if (!course.drive_folder_id) {
      console.log(`⚠️  Materia "${course.title}" (${course.id}) no tiene drive_folder_id. Saltando...`);
      continue;
    }

    console.log(`\n📚 [Materia] ${course.title} (Drive: ${course.drive_folder_id})`);

    // 2. Obtener actividades de esta materia
    const assignments = await supabaseRequest(
      `assignments?course_id=eq.${course.id}&select=id,title,description,rubric_data,submission_type,drive_folder_id,info_doc_synced,unit_id`
    );

    // Obtener unidades
    const units = await supabaseRequest(`course_units?course_id=eq.${course.id}&select=id,unit_number,title`);
    const unitMap = new Map(units.map((u) => [u.id, u]));

    for (const a of assignments) {
      const unit = unitMap.get(a.unit_id) || { unit_number: 1, title: "" };

      // A) Verificar carpeta contenedora de la actividad
      let activityFolderId = a.drive_folder_id;
      if (!activityFolderId) {
        console.log(`\n  📁 [Creando Carpeta Actividad] "${a.title}" (Unidad ${unit.unit_number})...`);
        const res = await callAppsScriptWithRetry("crearCarpetaActividad", {
          courseFolderId: course.drive_folder_id,
          unitNumber: unit.unit_number,
          unitTitle: unit.title,
          activityTitle: a.title,
        });

        if (res.success && (res.data.activity_folder_id || res.data.drive_folder_id)) {
          activityFolderId = res.data.activity_folder_id || res.data.drive_folder_id;
          await supabaseRequest(`assignments?id=eq.${a.id}`, "PATCH", { drive_folder_id: activityFolderId });
          console.log(`     ✅ Carpeta creada: ${activityFolderId}`);
        } else {
          console.error(`     ❌ Falló crear carpeta de actividad: ${res.error}`);
          continue;
        }
        totalProcessed++;
        await sleep(DELAY_MS);
      }

      // B) Verificar Documento Informativo
      if (!a.info_doc_synced && activityFolderId) {
        console.log(`  📄 [Creando Doc Informativo] para "${a.title}"...`);
        const docRes = await callAppsScriptWithRetry("crearDocInformativoActividad", {
          folderId: activityFolderId,
          title: a.title,
          description: a.description,
          rubric: a.rubric_data,
        });

        if (docRes.success) {
          await supabaseRequest(`assignments?id=eq.${a.id}`, "PATCH", { info_doc_synced: true });
          console.log(`     ✅ Doc Informativo sincronizado.`);
        } else {
          console.warn(`     ⚠️ No se pudo sincronizar Doc Informativo: ${docRes.error}`);
        }
        totalProcessed++;
        await sleep(DELAY_MS);
      }

      // C) Verificar Entregas de Alumnos sin carpeta
      const pendingSubmissions = await supabaseRequest(
        `submissions?assignment_id=eq.${a.id}&drive_folder_id=is.null&select=id,student_id`
      );

      if (pendingSubmissions.length > 0) {
        console.log(`  👥 [Submissions Pendientes] ${pendingSubmissions.length} alumnos faltan por carpeta en "${a.title}"`);

        // Cargar datos de alumnos
        const studentIds = pendingSubmissions.map((s) => s.student_id).filter(Boolean);
        const students = await supabaseRequest(
          `students?id=in.(${studentIds.join(",")})&select=id,matricula,nombres,apellido_paterno,correo`
        );
        const studentMap = new Map(students.map((s) => [s.id, s]));

        for (const sub of pendingSubmissions) {
          if (maxItems && totalProcessed >= maxItems) {
            console.log(`\n🛑 Límite de lote alcanzado (${maxItems} elementos procesados). Deteniendo ejecución de forma segura.`);
            return;
          }

          const st = studentMap.get(sub.student_id);
          if (!st) continue;

          const studentLabel = `${st.matricula} - ${st.apellido_paterno} ${st.nombres}`;
          console.log(`     -> Creando carpeta alumno: ${studentLabel}`);

          const folderRes = await callAppsScriptWithRetry("crearCarpetaActividad", {
            courseFolderId: course.drive_folder_id,
            unitNumber: unit.unit_number,
            unitTitle: unit.title,
            activityTitle: a.title,
            teamName: studentLabel,
          });

          if (folderRes.success && folderRes.data.drive_folder_id) {
            const studentFolderId = folderRes.data.drive_folder_id;
            let workspaceUrl = null;

            // Si es documento interactivo (workspace)
            if (["doc", "sheet", "slide"].includes(a.submission_type)) {
              await sleep(800);
              const wsRes = await callAppsScriptWithRetry("crearEntornoWorkspace", {
                title: `${a.title} - ${st.apellido_paterno} ${st.nombres}`,
                documentType: a.submission_type,
                emails: st.correo ? [st.correo] : [],
                folderId: studentFolderId,
              });
              if (wsRes.success) workspaceUrl = wsRes.data.fileUrl || null;
            }

            // Actualizar Supabase de inmediato
            await supabaseRequest(`submissions?id=eq.${sub.id}`, "PATCH", {
              drive_folder_id: studentFolderId,
              content_url: workspaceUrl,
            });

            console.log(`        ✅ OK (Folder: ${studentFolderId.slice(0, 12)}...)`);
          } else {
            console.error(`        ❌ Error: ${folderRes.error}`);
          }

          totalProcessed++;

          // Enfriamiento cada N peticiones
          if (totalProcessed % BATCH_SIZE === 0) {
            console.log(`\n  ⏳ [Enfriamiento de seguridad] Pausa de ${BATCH_COOLDOWN_MS / 1000}s para liberar Apps Script...\n`);
            await sleep(BATCH_COOLDOWN_MS);
          } else {
            await sleep(DELAY_MS);
          }
        }
      }
    }
  }

  console.log("\n===================================================================");
  console.log(` ✅ SINCRONIZACIÓN FINALIZADA. Elementos procesados con éxito: ${totalProcessed}`);
  console.log("===================================================================");
}

main().catch((err) => {
  console.error("❌ Error no controlado en ejecutor:", err);
  process.exit(1);
});

