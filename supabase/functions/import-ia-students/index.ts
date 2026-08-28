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
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const formData = await req.formData();
    const file     = formData.get("archivo") as File;
    const rawId    = formData.get("courseId") as string;
    const courseId = isValidUUID(rawId) ? rawId : null;

    if (!file)     throw new Error("No se recibió ningún archivo.");
    if (!courseId) throw new Error("No se especificó la materia destino.");

    // ── 2. Verificar ownership ────────────────────────────────────────────
    const owns = await verifyCourseOwnership(serviceClient, courseId, userId);
    if (!owns) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Gemini 2.5 Flash — extracción de lista ─────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const fileName    = file.name?.toLowerCase() ?? "";
    const mimeType    = file.type?.toLowerCase() ?? "";

    const PROMPT = `Analiza este documento y extrae la lista de estudiantes.

                REGLAS:
                1. Extrae SOLO lo que veas. No inventes datos.
                2. Si los nombres están juntos, sepáralos en apellido_paterno, apellido_materno, nombres.
                3. Ignora encabezados; céntrate en la lista de alumnos.
                4. Si falta algún dato, usa null.

                JSON puro con este formato exacto:
                {"alumnos":[{"matricula":"...","apellido_paterno":"...","apellido_materno":"...","nombres":"...","correo":"..."}]}
                Sin texto adicional ni markdown.`;

    const isPdf   = mimeType === "application/pdf" || fileName.endsWith(".pdf");
    const isImage = mimeType.startsWith("image/");
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")
                 || fileName.endsWith(".ods")
                 || mimeType.includes("spreadsheet") || mimeType.includes("excel");

    // Verifica los primeros bytes reales contra lo que el archivo dice ser
    // (nombre/MIME) — ambos los controla quien hace el request, así que no
    // son suficientes por sí solos para decidir cómo procesar el archivo.
    const declaredKind: DeclaredKind = isPdf ? "pdf" : isImage ? "image" : isExcel ? "office" : "text";
    const fileCheck = validateFileBytes(new Uint8Array(arrayBuffer), declaredKind);
    if (!fileCheck.ok) throw new Error(fileCheck.reason);

    let parts: unknown[];

    if (isPdf || isImage) {
      // Gemini acepta PDF e imágenes como inlineData
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      parts = [
        { text: PROMPT },
        { inlineData: { data: base64Data, mimeType: isPdf ? "application/pdf" : mimeType } },
      ];
    } else if (isExcel) {
      // Excel → SheetJS → CSV → texto al prompt
      const XLSX = await import("https://esm.sh/xlsx@0.18.5");
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvContent = XLSX.utils.sheet_to_csv(firstSheet);
      parts = [{ text: PROMPT + "\n\nCONTENIDO DEL ARCHIVO (CSV):\n" + csvContent }];
    } else {
      // txt, csv y cualquier otro formato de texto
      const textContent = new TextDecoder().decode(arrayBuffer);
      parts = [{ text: PROMPT + "\n\nCONTENIDO DEL ARCHIVO:\n" + textContent }];
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

    const { alumnos: extraction } = JSON.parse(content) as { alumnos: Record<string, unknown>[] };
    if (!extraction?.length) throw new Error("No se detectaron alumnos en el documento.");

    const guard = await guardOutputOrBlock(JSON.stringify(extraction), {
      serviceClient, teacherId: userId, toolName: "import_ia_students", cors,
      errorBody: { success: false, error: "La extracción no pudo procesarse por una regla de seguridad interna." },
    });
    if (guard.blocked) return guard.response;

    // ── 4. Smart Merge ────────────────────────────────────────────────────
    const { data: currentStudents } = await serviceClient
      .from("students").select("*").eq("course_id", courseId);
    const existing = currentStudents || [];

    // Eliminar duplicados dentro del mismo documento
    const unique = extraction.filter((v, i, a) =>
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
          apellido_materno: est.apellido_materno || match.apellido_materno,
          nombres:          est.nombres          || match.nombres,
          correo:           normalizeEmail(est.correo) ?? normalizeEmail(match.correo),
        });
      } else {
        toInsert.push({
          course_id:        courseId,
          matricula:        matriculaIA || `SM-${Math.floor(Math.random() * 90000) + 10000}`,
          apellido_paterno: String(est.apellido_paterno || "Desconocido"),
          apellido_materno: est.apellido_materno || null,
          nombres:          String(est.nombres    || "Desconocido"),
          correo:           normalizeEmail(est.correo),
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

    // Sync con Sheets en background — si falla no bloquea la respuesta
    syncWithSheet(serviceClient, courseId).catch(
      (e) => console.error("[IMPORT_SYNC_SILENCIOSO]", e)
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Proceso exitoso: ${nuevos} alumnos nuevos, ${actualizados} actualizados.`,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const msg = isTimeout
      ? "Timeout (30s) al procesar el archivo."
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
