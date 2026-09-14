// deno-lint-ignore-file no-import-prefix no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildCorsHeaders,
  errorResponse,
  verifyCourseOwnership,
  verifyDocente,
} from "../_shared/auth.ts";
import { fetchGeminiWithRetry } from "../_shared/gemini.ts";

const isValidUUID = (u: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);

const norm = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");

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

    // ── 3. Gemini 2.5 Flash — extracción de equipos ───────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const fileName    = file.name?.toLowerCase() ?? "";
    const mimeType     = file.type?.toLowerCase() ?? "";

    const PROMPT = `Analiza este documento y extrae la lista de equipos/grupos de trabajo y sus integrantes.

                REGLAS:
                1. Extrae SOLO lo que veas. No inventes datos.
                2. Cada equipo tiene un nombre (puede ser "Equipo 1", un nombre propio, etc.) y una lista de alumnos.
                3. Para cada alumno incluye su nombre completo tal como aparece, y la matrícula si está visible.
                4. Ignora encabezados; céntrate en la agrupación equipo → alumnos.

                JSON puro con este formato exacto:
                {"equipos":[{"nombre":"Equipo 1","alumnos":[{"nombre_completo":"...","matricula":"..."}]}]}
                Sin texto adicional ni markdown.`;

    const isPdf   = mimeType === "application/pdf" || fileName.endsWith(".pdf");
    const isImage = mimeType.startsWith("image/");
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")
                 || fileName.endsWith(".ods")
                 || mimeType.includes("spreadsheet") || mimeType.includes("excel");

    let parts: unknown[];

    if (isPdf || isImage) {
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      parts = [
        { text: PROMPT },
        { inlineData: { data: base64Data, mimeType: isPdf ? "application/pdf" : mimeType } },
      ];
    } else if (isExcel) {
      const XLSX = await import("https://esm.sh/xlsx@0.18.5");
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvContent = XLSX.utils.sheet_to_csv(firstSheet);
      parts = [{ text: PROMPT + "\n\nCONTENIDO DEL ARCHIVO (CSV):\n" + csvContent }];
    } else {
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

    const { equipos } = JSON.parse(content) as {
      equipos: { nombre: string; alumnos: { nombre_completo?: string; matricula?: string }[] }[];
    };
    if (!equipos?.length) throw new Error("No se detectaron equipos en el documento.");

    // ── 4. Matchear alumnos contra la lista real del curso ───────────────
    const { data: courseStudents } = await serviceClient
      .from("students")
      .select("id, matricula, nombres, apellido_paterno, apellido_materno")
      .eq("course_id", courseId);
    const students = courseStudents || [];

    const matchStudent = (item: { nombre_completo?: string; matricula?: string }) => {
      if (item.matricula) {
        const m = students.find((s: any) => norm(s.matricula) === norm(item.matricula!));
        if (m) return m;
      }
      if (item.nombre_completo) {
        const target = norm(item.nombre_completo);
        const m = students.find((s: any) => {
          const full = norm(`${s.nombres} ${s.apellido_paterno} ${s.apellido_materno || ""}`);
          const fullRev = norm(`${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`);
          return full.includes(target) || fullRev.includes(target) || target.includes(norm(s.nombres));
        });
        if (m) return m;
      }
      return null;
    };

    let equiposCreados = 0;
    let miembrosAsignados = 0;
    let noEncontrados = 0;

    for (const eq of equipos) {
      if (!eq.nombre) continue;

      // Upsert del equipo (mismo nombre dentro del curso = mismo equipo)
      const { data: existingTeam } = await serviceClient
        .from("teams")
        .select("id")
        .eq("course_id", courseId)
        .eq("name", eq.nombre)
        .maybeSingle();

      let teamId = existingTeam?.id;
      if (!teamId) {
        const { data: newTeam, error: teamErr } = await serviceClient
          .from("teams")
          .insert({ course_id: courseId, name: eq.nombre })
          .select("id")
          .single();
        if (teamErr) throw teamErr;
        teamId = newTeam.id;
        equiposCreados++;
      }

      const memberRows = [];
      for (const alumno of eq.alumnos || []) {
        const match = matchStudent(alumno);
        if (match) {
          memberRows.push({ team_id: teamId, student_id: match.id });
        } else {
          noEncontrados++;
        }
      }

      if (memberRows.length > 0) {
        const { error: memErr } = await serviceClient
          .from("team_members")
          .upsert(memberRows, { onConflict: "team_id, student_id", ignoreDuplicates: true });
        if (memErr) throw memErr;
        miembrosAsignados += memberRows.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${equiposCreados} equipos creados, ${miembrosAsignados} integrantes asignados.` +
                  (noEncontrados > 0 ? ` ${noEncontrados} alumnos no se pudieron identificar.` : ""),
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const msg = isTimeout
      ? "Timeout (30s) al procesar el archivo."
      : err instanceof Error ? err.message : "Error interno.";
    console.error("[IMPORT_IA_TEAMS]", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: isTimeout ? 504 : 502, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } finally {
    clearTimeout(timeout);
  }
});
