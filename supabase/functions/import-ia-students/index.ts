// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildCorsHeaders,
  errorResponse,
  verifyCourseOwnership,
  verifyDocente,
  type SupabaseClient,
} from "../_shared/auth.ts";
import { fetchGeminiWithRetry } from "../_shared/gemini.ts";
import { validateFileBytes, type DeclaredKind } from "../_shared/fileValidation.ts";
import { guardOutputOrBlock } from "../_shared/guardrail.ts";

const isValidUUID = (u: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);

interface StudentInput {
  matricula: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  nombres: string;
  correo?: string | null;
  repite_curso?: boolean;
  no?: number;
  ya_registrado?: boolean;
  existing_id?: string | null;
}

interface GrupoExtraction {
  pagina?: number | null;
  institucion?: string | null;
  tipo_documento?: string | null;
  materia?: string | null;
  clave_materia?: string | null;
  periodo?: string | null;
  paquete_grupo?: string | null;
  total_declarado?: number | null;
  docente?: string | null;
  alumnos: StudentInput[];
  resumen?: {
    totalDeclarado?: number | null;
    totalExtraidos: number;
    coincideTotal: boolean;
    repitientes: number;
    nuevos: number;
    existentes: number;
  };
}

interface ExtractionResponse {
  grupos?: GrupoExtraction[];
  metadata?: {
    institucion?: string | null;
    tipo_documento?: string | null;
    materia?: string | null;
    clave_materia?: string | null;
    periodo?: string | null;
    paquete_grupo?: string | null;
    total_declarado?: number | null;
    docente?: string | null;
  };
  alumnos?: StudentInput[];
}

const PROMPT_PRELISTA = `Eres un asistente experto en digitalización de documentos académicos oficiales de México (TecNM - Tecnológico Nacional de México / Instituto Tecnológico de Tizimín).
Analiza este documento oficial (Prelista / Lista de Asistencia / Acta de Calificaciones / Excel) y extrae de manera estructurada los grupos y listas de estudiantes que contenga.

IMPORTANTE: El documento puede contener UNA o VARIAS materias, grupos o páginas distintas (por ejemplo: Página 1 Microbiología 03A, Página 2 Microbiología 03B, Página 3 Fisiología Vegetal 05A, Página 4 Fisiología Vegetal 05B).
Debes separar CADA lista/grupo como un elemento independiente dentro del arreglo "grupos".

REGLAS DE EXTRACCIÓN POR CADA GRUPO:
1. METADATOS DEL ENCABEZADO:
   - "pagina": Número de página (1, 2, 3, etc.).
   - "institucion": Nombre de la institución (ej. "INSTITUTO TECNOLÓGICO DE TIZIMÍN").
   - "tipo_documento": "PRELISTA", "LISTA DE ASISTENCIA", "ACTA", etc.
   - "materia": Nombre de la asignatura (ej. "MICROBIOLOGÍA", "FISIOLOGÍA VEGETAL").
   - "clave_materia": Código de materia (ej. "AEF1049A", "AEF1049B", "LBG1021A", "LBG1021B").
   - "periodo": Periodo escolar (ej. "AGODIC2026", "ENEJUN2026").
   - "paquete_grupo": Identificador del paquete/grupo (ej. "03A", "03B", "05A", "05B").
   - "total_declarado": Número entero indicado en el campo "ESTUDIANTES: XX" (ej. 31, 28, 30, 21). Si no se indica, usa null.
   - "docente": Nombre del profesor/a (ej. "MAE. JUAN CANDELERO DE LA CRUZ").

2. TABLA DE ALUMNOS:
   - "no": Número secuencial de lista (1, 2, 3, etc.).
   - "matricula": Número de control / matrícula institucional (habitualmente 8 dígitos numéricos, ej. "25890008", "24890069", "21890299"). Extrae únicamente los dígitos limpios sin espacios.
   - "ESTUDIANTES": Nombre completo del alumno en formato mexicano oficial:
     [APELLIDO PATERNO] [APELLIDO MATERNO] [NOMBRES]
     * REGLAS ESTRICTAS DE SEPARACIÓN DE NOMBRES Y APELLIDOS:
       - El primer término es el "apellido_paterno" (o apellidos con partículas compuestas como "DE LA CRUZ", "DEL CARMEN", "SAN MARTIN", "MONTES DE OCA").
       - El segundo término es el "apellido_materno" (muy comunes apellidos mayas como CANCHE, AKE, HUCHIN, POOT, DZUL, KUMUL, UITZIL, PECH, TAH, CIAU, KAUIL, TUZ, YAM, COB, CHULIN, CUPUL, KINIL, etc., u otros apellidos hispanos).
       - Los términos restantes son "nombres" (nombres de pila como "JUAN JOSE", "DANIEL ALEJANDRO", "AMADA SAC-NICTE", "VALERIA GUADALUPE", "ADAMIRY AMAYRANI", etc.).
       - Si solo hay 2 palabras en total (ej. "PEREZ JUAN"), apellido_paterno="PEREZ", apellido_materno=null, nombres="JUAN".
       - Convierte todos los nombres y apellidos a MAYÚSCULAS limpias con acentos correctos si aplican.
   - "ANOTACIONES": Cuadrícula de casillas para firmas/asistencias. IGNÓRALAS por completo.
   - "REP": Columna de repetición. Si tiene la marca "R" o texto indicando repetición de curso, asigna "repite_curso": true; si está vacío, asigna "repite_curso": false.
   - "correo": Si el documento incluye correo explícito extráelo; de lo contrario asigna null.

3. COMPLETITUD:
   - Si el documento contiene varias páginas o grupos, extrae TODOS los estudiantes de cada hoja sin omitir a ninguno.

FORMATO DE SALIDA (JSON PURO SIN MARKDOWN NI TEXTO EXTRA):
{
  "grupos": [
    {
      "pagina": 1,
      "institucion": "INSTITUTO TECNOLÓGICO DE TIZIMÍN",
      "tipo_documento": "PRELISTA",
      "materia": "MICROBIOLOGÍA",
      "clave_materia": "AEF1049A",
      "periodo": "AGODIC2026",
      "paquete_grupo": "03A",
      "total_declarado": 31,
      "docente": "MAE. JUAN CANDELERO DE LA CRUZ",
      "alumnos": [
        {
          "no": 1,
          "matricula": "25890008",
          "apellido_paterno": "AGUIRRE",
          "apellido_materno": "CANCHE",
          "nombres": "JUAN JOSE",
          "repite_curso": false,
          "correo": null
        }
      ]
    }
  ]
}`;

serve(async (req: Request) => {
  const cors = buildCorsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── 1. Autenticación ─────────────────────────────────────────────────────
  const auth = await verifyDocente(req);
  if (!auth.ok) return errorResponse(auth.err, cors);
  const { userId, serviceClient } = auth.ctx;

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // 60s para PDFs multipágina

  try {
    const contentType = req.headers.get("content-type") || "";

    // ── MODO COMMIT DIRECTO VÍA JSON (Confirmación del docente desde modal de preview) ──
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const rawCourseId = body?.courseId as string;
      const courseId = isValidUUID(rawCourseId) ? rawCourseId : null;
      const confirmedStudents = body?.alumnos as StudentInput[];

      if (!courseId) throw new Error("No se especificó la materia destino.");
      if (!Array.isArray(confirmedStudents) || confirmedStudents.length === 0) {
        throw new Error("No se recibieron alumnos para inscribir.");
      }

      const owns = await verifyCourseOwnership(serviceClient, courseId, userId);
      if (!owns) {
        return new Response(
          JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const result = await executeSmartMerge(serviceClient, courseId, confirmedStudents);

      // Sync background con Sheets
      syncWithSheet(serviceClient, courseId).catch(
        (e) => console.error("[IMPORT_SYNC_SILENCIOSO]", e)
      );

      return new Response(
        JSON.stringify({
          success: true,
          mode: "commit",
          message: `Inscripción completada: ${result.nuevos} nuevos, ${result.actualizados} actualizados.`,
          ...result,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── MODO ARCHIVO / MULTIPART (Preview o Direct) ──
    const formData = await req.formData();
    const file     = formData.get("archivo") as File;
    const rawId    = formData.get("courseId") as string;
    const mode     = (formData.get("mode") as string) || "preview"; // default: 'preview'
    const courseId = isValidUUID(rawId) ? rawId : null;

    if (!file)     throw new Error("No se recibió ningún archivo.");
    if (!courseId) throw new Error("No se especificó la materia destino.");

    // ── 2. Verificar ownership y obtener datos de la materia actual ──────────
    const owns = await verifyCourseOwnership(serviceClient, courseId, userId);
    if (!owns) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { data: courseData } = await serviceClient
      .from("courses")
      .select("id, title")
      .eq("id", courseId)
      .single();

    const courseTitle = (courseData?.title || "").trim();

    // ── 3. Gemini 2.5 Flash — Extracción Inteligente ──────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const fileName    = file.name?.toLowerCase() ?? "";
    const mimeType    = file.type?.toLowerCase() ?? "";

    const isPdf   = mimeType === "application/pdf" || fileName.endsWith(".pdf");
    const isImage = mimeType.startsWith("image/");
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")
                 || fileName.endsWith(".ods")
                 || mimeType.includes("spreadsheet") || mimeType.includes("excel");

    const declaredKind: DeclaredKind = isPdf ? "pdf" : isImage ? "image" : isExcel ? "office" : "text";
    const fileCheck = validateFileBytes(new Uint8Array(arrayBuffer), declaredKind);
    if (!fileCheck.ok) throw new Error(fileCheck.reason);

    let parts: unknown[];

    if (isPdf || isImage) {
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      parts = [
        { text: PROMPT_PRELISTA },
        { inlineData: { data: base64Data, mimeType: isPdf ? "application/pdf" : mimeType } },
      ];
    } else if (isExcel) {
      const XLSX = await import("https://esm.sh/xlsx@0.18.5");
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvContent = XLSX.utils.sheet_to_csv(firstSheet);
      parts = [{ text: PROMPT_PRELISTA + "\n\nCONTENIDO DEL ARCHIVO (CSV):\n" + csvContent }];
    } else {
      const textContent = new TextDecoder().decode(arrayBuffer);
      parts = [{ text: PROMPT_PRELISTA + "\n\nCONTENIDO DEL ARCHIVO:\n" + textContent }];
    }

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
      },
      controller.signal,
    );

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`);
    const aiJson  = await aiRes.json();
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content)  throw new Error("Gemini devolvió respuesta vacía.");

    let parsedResult: ExtractionResponse;
    try {
      parsedResult = JSON.parse(content) as ExtractionResponse;
    } catch {
      throw new Error("Error al interpretar la respuesta estructurada de la IA.");
    }

    // Normalizar a estructura de grupos
    let rawGrupos: GrupoExtraction[] = [];
    if (Array.isArray(parsedResult.grupos) && parsedResult.grupos.length > 0) {
      rawGrupos = parsedResult.grupos;
    } else if (Array.isArray(parsedResult.alumnos) && parsedResult.alumnos.length > 0) {
      rawGrupos = [{
        pagina: 1,
        institucion: parsedResult.metadata?.institucion,
        tipo_documento: parsedResult.metadata?.tipo_documento,
        materia: parsedResult.metadata?.materia,
        clave_materia: parsedResult.metadata?.clave_materia,
        periodo: parsedResult.metadata?.periodo,
        paquete_grupo: parsedResult.metadata?.paquete_grupo,
        total_declarado: parsedResult.metadata?.total_declarado,
        docente: parsedResult.metadata?.docente,
        alumnos: parsedResult.alumnos,
      }];
    }

    if (!rawGrupos.length) throw new Error("No se detectaron alumnos o grupos en el documento.");

    const guard = await guardOutputOrBlock(JSON.stringify(rawGrupos), {
      serviceClient, teacherId: userId, toolName: "import_ia_students", cors,
      errorBody: { success: false, error: "La extracción no pudo procesarse por una regla de seguridad interna." },
    });
    if (guard.blocked) return guard.response;

    // Obtener alumnos existentes en la materia actual para comprobación
    const { data: currentStudents } = await serviceClient
      .from("students")
      .select("id, matricula, nombres, apellido_paterno, apellido_materno, correo")
      .eq("course_id", courseId);
    const existingInDb = currentStudents || [];

    // Normalizar cada grupo y sus alumnos
    const processedGrupos: GrupoExtraction[] = rawGrupos.map((grp, grpIdx) => {
      const sanitizedStudents: StudentInput[] = (grp.alumnos || []).map((est, idx) => {
        const matriculaLimpia = String(est.matricula || "")
          .replace(/[^0-9A-Za-z]/g, "")
          .trim();

        const mat = matriculaLimpia || `TEMP-${idx + 1}-${Math.floor(Math.random() * 9000) + 1000}`;
        const suggestedEmail = est.correo && typeof est.correo === "string" && est.correo.includes("@")
          ? est.correo.toLowerCase().trim()
          : `l${mat}@tizimin.tecnm.mx`;

        const match = existingInDb.find((ex) =>
          ex.matricula?.toLowerCase().trim() === mat.toLowerCase().trim() ||
          (ex.nombres?.toLowerCase().trim() === String(est.nombres || "").toLowerCase().trim() &&
           ex.apellido_paterno?.toLowerCase().trim() === String(est.apellido_paterno || "").toLowerCase().trim())
        );

        return {
          no: est.no || (idx + 1),
          matricula: mat,
          apellido_paterno: String(est.apellido_paterno || "SIN APELLIDO").toUpperCase().trim(),
          apellido_materno: est.apellido_materno ? String(est.apellido_materno).toUpperCase().trim() : null,
          nombres: String(est.nombres || "SIN NOMBRE").toUpperCase().trim(),
          correo: suggestedEmail,
          repite_curso: Boolean(est.repite_curso),
          ya_registrado: Boolean(match),
          existing_id: match ? match.id : null,
        };
      });

      const totalDeclarado = Number(grp.total_declarado) || null;
      const totalExtraidos = sanitizedStudents.length;
      const coincideTotal = totalDeclarado ? totalDeclarado === totalExtraidos : true;
      const repitientesCount = sanitizedStudents.filter((s) => s.repite_curso).length;
      const existentesCount  = sanitizedStudents.filter((s) => s.ya_registrado).length;
      const nuevosCount      = totalExtraidos - existentesCount;

      return {
        ...grp,
        pagina: grp.pagina || (grpIdx + 1),
        materia: grp.materia || "Sin Asignatura",
        paquete_grupo: grp.paquete_grupo || `Grupo ${grpIdx + 1}`,
        total_declarado: totalDeclarado,
        alumnos: sanitizedStudents,
        resumen: {
          totalDeclarado,
          totalExtraidos,
          coincideTotal,
          repitientes: repitientesCount,
          nuevos: nuevosCount,
          existentes: existentesCount,
        },
      };
    });

    // ── Calcular el grupo que mejor coincide con la materia actual ──────────
    let bestMatchIndex = 0;
    let highestScore = -1;

    const normalizeStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cleanCourseTitle = normalizeStr(courseTitle);

    processedGrupos.forEach((grp, idx) => {
      let score = 0;
      const grpMateria = normalizeStr(grp.materia || "");
      const grpClave = normalizeStr(grp.clave_materia || "");
      const grpPaquete = normalizeStr(grp.paquete_grupo || "");

      if (cleanCourseTitle.includes(grpMateria) && grpMateria.length > 3) score += 10;
      if (grpMateria.includes(cleanCourseTitle) && cleanCourseTitle.length > 3) score += 10;
      if (grpClave && cleanCourseTitle.includes(grpClave)) score += 15;
      if (grpPaquete && cleanCourseTitle.includes(grpPaquete)) score += 5;

      if (score > highestScore) {
        highestScore = score;
        bestMatchIndex = idx;
      }
    });

    // ── Si el modo es PREVIEW: devolvemos todos los grupos para selección ──
    if (mode === "preview") {
      return new Response(
        JSON.stringify({
          success: true,
          mode: "preview",
          courseTitle,
          selectedGroupIndex: bestMatchIndex,
          grupos: processedGrupos,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Si el modo es DIRECT: guarda el grupo que mejor coincidió ──
    const targetGroup = processedGrupos[bestMatchIndex] || processedGrupos[0];
    const mergeResult = await executeSmartMerge(serviceClient, courseId, targetGroup.alumnos);

    syncWithSheet(serviceClient, courseId).catch(
      (e) => console.error("[IMPORT_SYNC_SILENCIOSO]", e)
    );

    return new Response(
      JSON.stringify({
        success: true,
        mode: "direct",
        selectedGroup: targetGroup.paquete_grupo,
        materia: targetGroup.materia,
        message: `Proceso exitoso: ${mergeResult.nuevos} alumnos nuevos, ${mergeResult.actualizados} actualizados.`,
        ...mergeResult,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

    syncWithSheet(serviceClient, courseId).catch(
      (e) => console.error("[IMPORT_SYNC_SILENCIOSO]", e)
    );

    return new Response(
      JSON.stringify({
        success: true,
        mode: "direct",
        message: `Proceso exitoso: ${mergeResult.nuevos} alumnos nuevos, ${mergeResult.actualizados} actualizados.`,
        ...mergeResult,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const msg = isTimeout
      ? "Tiempo de espera agotado (60s) al procesar el archivo."
      : err instanceof Error ? err.message : "Error interno.";
    console.error("[IMPORT_IA_STUDENTS]", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: isTimeout ? 504 : 502, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } finally {
    clearTimeout(timeout);
  }
});

// ── Smart Merge Helper ───────────────────────────────────────────────────────

async function executeSmartMerge(
  serviceClient: SupabaseClient,
  courseId: string,
  studentsList: StudentInput[]
) {
  const { data: currentStudents } = await serviceClient
    .from("students").select("*").eq("course_id", courseId);
  const existing = currentStudents || [];

  // Eliminar duplicados dentro del mismo payload
  const unique = studentsList.filter((v, i, a) =>
    a.findIndex(t =>
      String(t.matricula || "").trim() === String(v.matricula || "").trim() && v.matricula
    ) === i || !v.matricula
  );

  const toUpdate: Record<string, unknown>[] = [];
  const toInsert: Record<string, unknown>[] = [];

  for (const est of unique) {
    const matriculaIA = est.matricula ? String(est.matricula).trim() : null;
    let match: Record<string, unknown> | undefined;

    if (matriculaIA) {
      match = existing.find((s: Record<string, unknown>) =>
        String(s.matricula).trim() === matriculaIA
      );
    }
    if (!match && est.nombres && est.apellido_paterno) {
      match = existing.find((s: Record<string, unknown>) =>
        String(s.nombres).toLowerCase().trim()          === String(est.nombres).toLowerCase().trim() &&
        String(s.apellido_paterno).toLowerCase().trim() === String(est.apellido_paterno).toLowerCase().trim()
      );
    }

    const normalizeEmail = (raw: unknown): string | null => {
      const s = typeof raw === 'string' ? raw.toLowerCase().trim() : null;
      return s || null;
    };

    if (match) {
      toUpdate.push({
        id:               match.id,
        course_id:        courseId,
        matricula:        matriculaIA || match.matricula,
        apellido_paterno: est.apellido_paterno || match.apellido_paterno,
        apellido_materno: est.apellido_materno ?? match.apellido_materno,
        nombres:          est.nombres          || match.nombres,
        correo:           normalizeEmail(est.correo) ?? normalizeEmail(match.correo),
      });
    } else {
      toInsert.push({
        course_id:        courseId,
        matricula:        matriculaIA || `SM-${Math.floor(Math.random() * 90000) + 10000}`,
        apellido_paterno: String(est.apellido_paterno || "DESCONOCIDO"),
        apellido_materno: est.apellido_materno || null,
        nombres:          String(est.nombres    || "DESCONOCIDO"),
        correo:           normalizeEmail(est.correo) || (matriculaIA ? `l${matriculaIA}@tizimin.tecnm.mx` : null),
      });
    }
  }

  let actualizados = 0, nuevos = 0;

  if (toUpdate.length > 0) {
    const { data, error } = await serviceClient
      .from("students").upsert(toUpdate, { onConflict: "id" }).select();
    if (error) throw new Error("Error al actualizar alumnos: " + error.message);
    actualizados = data?.length ?? 0;
  }
  if (toInsert.length > 0) {
    const { data, error } = await serviceClient
      .from("students")
      .upsert(toInsert, { onConflict: "matricula, course_id", ignoreDuplicates: true })
      .select();
    if (error) throw new Error("Error al insertar alumnos: " + error.message);
    nuevos = data?.length ?? 0;
  }

  return { nuevos, actualizados, total: nuevos + actualizados };
}

// ── Sync con Google Sheets (aislado del flujo principal) ──────────────────────

async function syncWithSheet(
  serviceClient: SupabaseClient,
  courseId: string,
) {
  const { data: course } = await serviceClient
    .from("courses")
    .select("title, google_sheet_id")
    .eq("id", courseId)
    .single();

  if (!course?.google_sheet_id) return;

  const { data: students } = await serviceClient
    .from("students").select("*").eq("course_id", courseId);

  const APPS_SCRIPT_URL  = Deno.env.get("APPS_SCRIPT_URL");
  const WEBHOOK_SECRET   = Deno.env.get("APPS_SCRIPT_SECRET");
  if (!APPS_SCRIPT_URL || !students?.length) return;

  await fetch(APPS_SCRIPT_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret:  WEBHOOK_SECRET,
      action:  "sincronizarAlumno",
      payload: {
        googleSheetId: course.google_sheet_id,
        mode:          "bulk",
        studentData:   students,
        materiaNombre: course.title,
      },
    }),
  });
}

