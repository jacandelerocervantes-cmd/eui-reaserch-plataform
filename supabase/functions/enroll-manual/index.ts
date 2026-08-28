// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildCorsHeaders,
  errorResponse,
  verifyCourseOwnership,
  verifyDocente,
  verifyStudentOwnership,
  type SupabaseClient,
} from "../_shared/auth.ts";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface StudentData {
  matricula: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno?: string;
  correo?: string;
  team_id?: string | null;
}

interface RequestPayload {
  courseId: string;
  mode: "create" | "edit" | "delete";
  studentId?: string;
  studentData: StudentData;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const cors = buildCorsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── 1. Autenticación y verificación de rol Docente ───────────────────────
  const auth = await verifyDocente(req);
  if (!auth.ok) return errorResponse(auth.err, cors);
  const { userId, serviceClient } = auth.ctx;

  try {
    // ── 2. Parseo y validación del body ─────────────────────────────────────
    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(
        JSON.stringify({ success: false, error: "Cuerpo de la petición vacío." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { courseId, mode, studentId, studentData } = JSON.parse(rawBody) as RequestPayload;

    if (!courseId || !mode) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan campos requeridos: courseId, mode." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Verificar que la materia pertenece al docente autenticado ─────────
    const ownsThisCourse = await verifyCourseOwnership(serviceClient, courseId, userId);
    if (!ownsThisCourse) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // team_id vacío → null para no violar FK; correo → lowercase para que coincida con auth.email()
    const cleanData: StudentData & { team_id: string | null } = {
      ...studentData,
      correo:  studentData?.correo?.toLowerCase().trim() || undefined,
      team_id: studentData?.team_id?.trim() || null,
    };

    // ── 4. Operaciones en base de datos ──────────────────────────────────────
    let result: Record<string, unknown>;

    if (mode === "create") {
      const { data, error } = await serviceClient
        .from("students")
        .insert([{ ...cleanData, course_id: courseId }])
        .select()
        .single();

      if (error) throw error;
      result = data;

    } else if (mode === "edit" && studentId) {
      // Verificar que el alumno pertenece a ESTA materia antes de editarlo
      const ownsStudent = await verifyStudentOwnership(serviceClient, studentId, courseId);
      if (!ownsStudent) {
        return new Response(
          JSON.stringify({ success: false, error: "Alumno no encontrado en esta materia." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await serviceClient
        .from("students")
        .update(cleanData)
        .eq("id", studentId)
        .select()
        .single();

      if (error) throw error;
      result = data;

    } else if (mode === "delete" && studentId) {
      // Verificar ownership antes de eliminar — previene IDOR
      const ownsStudent = await verifyStudentOwnership(serviceClient, studentId, courseId);
      if (!ownsStudent) {
        return new Response(
          JSON.stringify({ success: false, error: "Alumno no encontrado en esta materia." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const { error } = await serviceClient.from("students").delete().eq("id", studentId);
      if (error) throw error;
      result = { deleted: true };

    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Parámetros inválidos para el modo indicado." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Sincronización con Google Sheets (no bloquea la respuesta) ────────
    // Ejecutamos en background: si falla el webhook, el alumno ya fue guardado en BD
    syncWithSheet(serviceClient, courseId, mode, cleanData).catch(
      (e) => console.error("[WEBHOOK_SILENCIOSO] Fallo en sync con Sheet:", e)
    );

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };

    // Constraint de unicidad en (matricula, course_id)
    if (e?.code === "23505") {
      return new Response(
        JSON.stringify({ success: false, error: "Ya existe un alumno con esta matrícula en la materia." }),
        { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    console.error("[ENROLL_MANUAL_ERROR]", e);
    return new Response(
      JSON.stringify({ success: false, error: "Error interno del servidor." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

// ─── Sincronización con Google Sheets (aislada del flujo principal) ──────────

async function syncWithSheet(
  serviceClient: SupabaseClient,
  courseId: string,
  mode: string,
  studentData: StudentData & { team_id: string | null },
) {
  const { data: course } = await serviceClient
    .from("courses")
    .select("title, google_sheet_id")
    .eq("id", courseId)
    .single();

  if (!course?.google_sheet_id) return;

  let teamName = "Sin equipo";
  if (studentData.team_id) {
    const { data: team } = await serviceClient
      .from("teams")
      .select("name")
      .eq("id", studentData.team_id)
      .single();
    if (team) teamName = team.name;
  }

  const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL");
  const WEBHOOK_SECRET = Deno.env.get("APPS_SCRIPT_SECRET");
  if (!APPS_SCRIPT_URL) return;

  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: WEBHOOK_SECRET,
      action: "sincronizarAlumno",
      payload: {
        googleSheetId: course.google_sheet_id,
        mode,
        studentData: { ...studentData, team_name: teamName },
        materiaNombre: course.title,
      },
    }),
  });
}
