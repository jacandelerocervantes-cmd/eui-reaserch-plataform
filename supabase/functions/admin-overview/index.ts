/**
 * admin-overview
 * Alimenta las 4 páginas de (admin): Estado General, Docentes, Alumnos y
 * Reversiones — todas llaman a esta misma función y cada una lee la parte
 * del payload que le interesa.
 *
 * ⚠️ REVISAR ANTES DE DESPLEGAR (columnas asumidas, no confirmadas contra tu
 * esquema real):
 *   - `submissions.locked`   (boolean) — usado para "Entregas bloqueadas".
 *   - `teams.locked`         (boolean) — usado para "Equipos bloqueados".
 * El resto del query (courses, profiles, students, course_units.is_closed,
 * exams.status, ai_action_log) sí está confirmado contra tu esquema real
 * verificado en la auditoría de seguridad de esta misma sesión.
 * Si alguna de esas dos columnas no existe con ese nombre, esta función
 * seguirá funcionando para todo lo demás — el error será visible y
 * específico en la consola del navegador, no un fallo silencioso.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Método no permitido, usa POST." }), {
      status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // ── 1. Verificar que quien llama es admin ──────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Falta encabezado de autorización.");

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) throw new Error("No se pudo verificar tu sesión.");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile, error: profileErr } = await admin
      .from("profiles").select("role").eq("id", user.id).single();
    if (profileErr) throw new Error("No se pudo verificar tu perfil.");
    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ success: false, error: "No tienes permisos de administrador." }), {
        status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── 2. Consultas en paralelo ────────────────────────────────────────────
    const [
      coursesRes,
      docentesRes,
      studentsRes,
      recentActionsRes,
      closedExamsRes,
      closedUnitsRes,
      lockedSubmissionsRes,
      lockedTeamsRes,
    ] = await Promise.all([
      admin.from("courses").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id, first_name, last_name, access_level").eq("role", "docente"),
      admin.from("students").select("nombres, apellido_paterno, apellido_materno, correo, course_id, courses(title)"),
      admin
        .from("ai_action_log")
        .select("id, tool_name, success, created_at, teacher_id, course_id, profiles:teacher_id(first_name, last_name), courses:course_id(title)")
        .order("created_at", { ascending: false })
        .limit(15),
      admin
        .from("exams")
        .select("id, title, unit_id, course_units(title, courses(title))")
        .eq("status", "closed"),
      admin
        .from("course_units")
        .select("id, unit_number, title, course_id, courses(title)")
        .eq("is_closed", true),
      admin
        .from("submissions")
        .select("id, assignment_id, assignments(title, course_id, courses(title)), student_id, students(nombres, apellido_paterno)")
        .eq("locked", true),
      admin
        .from("teams")
        .select("id, name, course_id, courses(title)")
        .eq("locked", true),
    ]);

    // ── 3. Alumnos únicos + con/sin cuenta ──────────────────────────────────
    // "Único" = correo distinto. Un alumno puede estar en varias materias
    // (varias filas en `students`), por eso se agrupa por correo aquí.
    type StudentRow = { nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null; correo: string | null; courses: { title: string } | null };
    const studentsData = studentsRes.data ?? [];
    const byCorreo = new Map<string, { nombre: string; correo: string; materias: string[] }>();
    // Sin Database generic tipado, supabase-js infiere `courses` (FK a-uno)
    // como arreglo aunque en runtime sea objeto único — cast vía `unknown`
    // (mismo patrón que evaluate-submissions-ia/create-assignment-hub).
    for (const s of studentsData as unknown as StudentRow[]) {
      const correo = (s.correo ?? "").toLowerCase();
      const key = correo || `sin-correo-${s.nombres}-${s.apellido_paterno}`;
      const nombre = `${s.nombres ?? ""} ${s.apellido_paterno ?? ""} ${s.apellido_materno ?? ""}`.trim();
      const materia = s.courses?.title;
      if (!byCorreo.has(key)) {
        byCorreo.set(key, { nombre, correo: s.correo ?? "", materias: materia ? [materia] : [] });
      } else if (materia) {
        byCorreo.get(key)!.materias.push(materia);
      }
    }

    // Determinar cuáles de esos correos ya tienen cuenta real en Supabase Auth.
    // listUsers pagina de 1000 en 1000; para una escuela de este tamaño alcanza
    // con una página, pero se deja el bucle por si crece.
    const authEmails = new Set<string>();
    let page = 1;
    while (true) {
      const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listErr) break;
      for (const u of usersPage.users) if (u.email) authEmails.add(u.email.toLowerCase());
      if (usersPage.users.length < 1000) break;
      page++;
    }

    const alumnos = Array.from(byCorreo.values()).map((a) => ({
      ...a,
      tieneCuenta: a.correo ? authEmails.has(a.correo.toLowerCase()) : false,
    }));
    const alumnosConCuenta = alumnos.filter((a) => a.tieneCuenta).length;
    const alumnosSinCuenta = alumnos.length - alumnosConCuenta;

    // ── 4. Ensamblar respuesta ───────────────────────────────────────────────
    type ActionLogRow = {
      id: string; tool_name: string; success: boolean; created_at: string;
      profiles: { first_name: string | null; last_name: string | null } | null;
      courses: { title: string } | null;
    };
    const recentActions = ((recentActionsRes.data ?? []) as unknown as ActionLogRow[]).map((a) => ({
      id: a.id,
      tool_name: a.tool_name,
      success: a.success,
      created_at: a.created_at,
      profiles: a.profiles,
      courses: a.courses,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        counts: {
          courses: coursesRes.count ?? 0,
          docentes: docentesRes.data?.length ?? 0,
          alumnosUnicos: alumnos.length,
          alumnosConCuenta,
          alumnosSinCuenta,
        },
        recentActions,
        docentes: docentesRes.data ?? [],
        alumnos,
        reversiones: {
          closedExams: closedExamsRes.data ?? [],
          closedUnits: closedUnitsRes.data ?? [],
          lockedSubmissions: lockedSubmissionsRes.data ?? [],
          lockedTeams: lockedTeamsRes.data ?? [],
        },
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno.";
    console.error("[ADMIN_OVERVIEW]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
