/**
 * admin-create-account
 * Crea la cuenta de un docente nuevo: usuario real en Supabase Auth (con
 * correo de invitación automático) + su fila en `profiles` con el rol y
 * nivel de acceso correspondientes.
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

    // ── 2. Validar entrada ───────────────────────────────────────────────────
    let body: { email?: string; first_name?: string; last_name?: string; access_level?: string | number; role?: string };
    try { body = await req.json(); } catch { throw new Error("Body inválido: se esperaba JSON."); }

    const email = (body?.email ?? "").trim().toLowerCase();
    const first_name = (body?.first_name ?? "").trim();
    const last_name = (body?.last_name ?? "").trim();
    const access_level = Number(body?.access_level);
    const role = body?.role === "admin" ? "admin" : "docente"; // nunca se crea otro admin por accidente vía este flujo

    if (!email || !email.includes("@")) throw new Error("Correo inválido.");
    if (!first_name || !last_name) throw new Error("Nombre y apellidos son obligatorios.");
    if (![1, 2, 3].includes(access_level)) throw new Error("Nivel de acceso inválido (debe ser 1, 2 o 3).");

    // ── 3. Crear usuario + enviar invitación ───────────────────────────────
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { first_name, last_name },
    });
    if (inviteErr) throw new Error(`No se pudo crear la cuenta: ${inviteErr.message}`);

    const newUserId = invited.user?.id;
    if (!newUserId) throw new Error("La invitación no devolvió un ID de usuario válido.");

    // ── 4. Escribir el perfil ────────────────────────────────────────────────
    const { error: upsertErr } = await admin.from("profiles").upsert({
      id: newUserId,
      role,
      access_level,
      first_name,
      last_name,
    });
    if (upsertErr) {
      // El usuario de Auth ya se creó — no lo borramos automáticamente para no
      // perder la invitación ya enviada; se lo indicamos al admin para que
      // decida (reintentar el perfil manualmente o borrar la cuenta a mano).
      throw new Error(`Cuenta creada pero no se pudo guardar el perfil: ${upsertErr.message}. El correo de invitación ya fue enviado a ${email}.`);
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno.";
    console.error("[ADMIN_CREATE_ACCOUNT]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
