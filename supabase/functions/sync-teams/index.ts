import {
  buildCorsHeaders,
  errorResponse,
  verifyCourseOwnership,
  verifyDocente,
} from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const auth = await verifyDocente(req);
  if (!auth.ok) return errorResponse(auth.err, cors);
  const { userId, serviceClient } = auth.ctx;

  try {
    const body = await req.json().catch(() => null);
    const courseId = body?.courseId;

    if (!courseId) {
      return new Response(
        JSON.stringify({ success: false, error: "courseId es requerido." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const ownsThisCourse = await verifyCourseOwnership(serviceClient, courseId, userId);
    if (!ownsThisCourse) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { data: course } = await serviceClient
      .from("courses")
      .select("google_sheet_id")
      .eq("id", courseId)
      .single();

    if (!course?.google_sheet_id) {
      return new Response(
        JSON.stringify({ success: false, error: "La materia no tiene Google Sheet vinculado." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { data: students } = await serviceClient
      .from("students")
      .select("id, matricula, apellido_paterno, apellido_materno, nombres, correo")
      .eq("course_id", courseId)
      .order("apellido_paterno");

    const { data: teams } = await serviceClient
      .from("teams")
      .select("id, name, team_members(student_id)")
      .eq("course_id", courseId);

    const studentTeamsMap: Record<string, string[]> = {};
    if (teams) {
      for (const t of teams) {
        const members = t.team_members as { student_id: string }[] | null;
        if (members) {
          for (const m of members) {
            if (!studentTeamsMap[m.student_id]) studentTeamsMap[m.student_id] = [];
            studentTeamsMap[m.student_id].push(t.name);
          }
        }
      }
    }

    const alumnosPayload = (students || []).map((s: { id: string; matricula: string; apellido_paterno: string; apellido_materno: string | null; nombres: string; correo: string | null }) => {
      const studentTeams = studentTeamsMap[s.id];
      return {
        matricula: s.matricula,
        apellido_paterno: s.apellido_paterno,
        apellido_materno: s.apellido_materno || "",
        nombres: s.nombres,
        correo: s.correo || "",
        equipos: studentTeams && studentTeams.length > 0 ? studentTeams.join(", ") : "Sin equipo",
      };
    });

    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL");
    const WEBHOOK_SECRET = Deno.env.get("APPS_SCRIPT_SECRET");
    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurado.");

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: WEBHOOK_SECRET,
        action: "sincronizarEquipos",
        payload: {
          googleSheetId: course.google_sheet_id,
          alumnos: alumnosPayload,
        },
      }),
    });

    const result = await res.json().catch(() => ({ success: true }));

    return new Response(
      JSON.stringify({ success: true, count: alumnosPayload.length, appsScript: result }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("[SYNC_TEAMS_ERROR]", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Error interno." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
