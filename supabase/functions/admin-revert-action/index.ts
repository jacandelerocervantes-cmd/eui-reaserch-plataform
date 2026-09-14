/**
 * admin-revert-action
 * Ejecuta las 4 reversiones que un docente no puede deshacer por sí mismo.
 *
 * ⚠️ MISMA ADVERTENCIA que admin-overview: 'unlock_submission' y
 * 'unlock_team' asumen columnas `submissions.locked` / `teams.locked` que no
 * pude confirmar contra el esquema real. 'reopen_exam' (exams.status) y
 * 'reopen_unit' (course_units.is_closed) sí están confirmados.
 * Si una columna no existe, esta función devuelve el error de Postgres tal
 * cual — visible para el admin, no silencioso — y basta con ajustar el
 * nombre de columna aquí abajo.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_ACTIONS = ["reopen_exam", "reopen_unit", "unlock_submission", "unlock_team"] as const;
type Action = typeof VALID_ACTIONS[number];

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

    // ── 2. Validar entrada ───────────────────────────────────────────────────
    let body: { action?: string; id?: string };
    try { body = await req.json(); } catch { throw new Error("Body inválido: se esperaba JSON."); }

    const action = body?.action as Action;
    const id = body?.id as string;
    if (!VALID_ACTIONS.includes(action)) throw new Error(`Acción inválida: "${action}".`);
    if (!id || typeof id !== "string") throw new Error("Falta 'id' del registro a revertir.");

    // ── 3. Ejecutar la reversión correspondiente ───────────────────────────
    let table: string;
    let update: Record<string, boolean | string>;

    switch (action) {
      case "reopen_exam":
        table = "exams";
        update = { status: "published" };
        break;
      case "reopen_unit":
        table = "course_units";
        update = { is_closed: false };
        break;
      case "unlock_submission":
        table = "submissions";
        update = { locked: false };
        break;
      case "unlock_team":
        table = "teams";
        update = { locked: false };
        break;
    }

    const { error: updateErr } = await admin.from(table).update(update).eq("id", id);
    if (updateErr) throw new Error(`No se pudo revertir: ${updateErr.message}`);

    // ── 4. Bitácora de auditoría — mismo patrón que master-copilot-orchestrator ──
    // La reversión ya se aplicó arriba — si el log de auditoría falla, no
    // debe revertir la operación ni ocultarle el éxito al admin, solo se
    // registra en consola.
    try {
      await admin.from("ai_action_log").insert({
        teacher_id: user.id,
        tool_name: `admin_revert_${action}`,
        success: true,
        metadata: { reverted_id: id, action },
      });
    } catch (logErr) {
      console.error("[ADMIN_REVERT_ACTION] no se pudo registrar en bitácora:", logErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno.";
    console.error("[ADMIN_REVERT_ACTION]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
