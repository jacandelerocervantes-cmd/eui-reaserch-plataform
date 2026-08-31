// deno-lint-ignore-file no-import-prefix
/**
 * provision-course-environment
 * Crea la estructura de carpetas en Google Drive y el Sheet de control.
 * Corrige: URL de Apps Script y MASTER_FOLDER_ID hardcodeados en código fuente,
 *          ausencia de autenticación, ausencia de verificación de ownership.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildCorsHeaders,
  errorResponse,
  verifyCourseOwnership,
  verifyDocente,
} from "../_shared/auth.ts";

serve(async (req: Request) => {
  const cors = buildCorsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── 1. Autenticación ─────────────────────────────────────────────────────
  const auth = await verifyDocente(req);
  if (!auth.ok) return errorResponse(auth.err, cors);
  const { userId, serviceClient } = auth.ctx;

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ error: "Cuerpo de la petición no es JSON válido." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { courseId, title, clave } = body as { courseId?: string; title?: string; clave?: string };

    if (!courseId || !title) {
      return new Response(
        JSON.stringify({ error: "Faltan courseId o title." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Verificar que la materia pertenece al docente autenticado ──────
    const ownsThisCourse = await verifyCourseOwnership(serviceClient, courseId, userId);
    if (!ownsThisCourse) {
      return new Response(
        JSON.stringify({ error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Obtener configuración desde variables de entorno (sin hardcoding) ─
    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL");
    const WEBHOOK_SECRET = Deno.env.get("APPS_SCRIPT_SECRET");
    const MASTER_FOLDER_ID = Deno.env.get("MASTER_FOLDER_ID");

    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurado en Supabase Secrets.");
    if (!MASTER_FOLDER_ID) throw new Error("MASTER_FOLDER_ID no configurado en Supabase Secrets.");

    // ── 4. Obtener nombre y email del docente para subcarpeta en Drive ───────────
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", userId)
      .single();

    const teacherName = [profile?.last_name, profile?.first_name]
      .filter(Boolean).join(" ") || "Docente";

    // Obtener email del docente desde auth.users para compartir la carpeta en Drive
    const { data: authUser } = await serviceClient.auth.admin.getUserById(userId);
    const teacherEmail = authUser?.user?.email ?? null;

    // ── 5. Llamar a Google Apps Script con timeout ────────────────────────
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // Drive puede tardar

    let googleData: { success: boolean; data?: { drive_folder_id: string; google_sheet_id: string; google_sheet_id_calificaciones?: string }; error?: string };
    try {
      const googleResponse = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: WEBHOOK_SECRET,
          action: "setupMateria",
          payload: {
            nombre: title,
            clave: clave ?? "SIN-CLAVE",
            parentFolderId: MASTER_FOLDER_ID,
            teacherName,
            teacherEmail,
          },
        }),
        signal: controller.signal,
      });

      if (!googleResponse.ok) {
        const text = await googleResponse.text();
        throw new Error(`Apps Script respondió ${googleResponse.status}: ${text.slice(0, 200)}`);
      }

      googleData = await googleResponse.json();
    } catch (fetchErr: unknown) {
      if ((fetchErr as Error).name === "AbortError") throw new Error("Timeout: Apps Script no respondió en 30s.");
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    if (!googleData.success || !googleData.data) {
      throw new Error("Apps Script reportó error: " + JSON.stringify(googleData.error));
    }

    const { drive_folder_id, google_sheet_id, google_sheet_id_calificaciones } = googleData.data;

    // ── 5. Persistir los IDs en la tabla courses ──────────────────────────
    const { error: dbError } = await serviceClient
      .from("courses")
      .update({ drive_folder_id, google_sheet_id, google_sheet_id_calificaciones })
      .eq("id", courseId);

    if (dbError) throw dbError;

    return new Response(
      JSON.stringify({ success: true, drive_id: drive_folder_id, sheet_id: google_sheet_id }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("[PROVISION_ERROR]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error interno." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
