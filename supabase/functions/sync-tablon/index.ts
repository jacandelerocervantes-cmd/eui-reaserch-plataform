// deno-lint-ignore-file no-import-prefix
/**
 * sync-tablon
 * CRUD de avisos en course_announcements.
 * Corrige: autor_id venía del cliente (suplantación de identidad) → ahora se
 *          extrae del JWT verificado. Agrega autenticación completa.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildCorsHeaders,
  errorResponse,
  verifyCourseOwnership,
  verifyDocente,
  type SupabaseClient,
} from "../_shared/auth.ts";

interface FetchPayload  { course_id: string }
interface PublishPayload { course_id: string; titulo: string; contenido: string }

serve(async (req: Request) => {
  const cors = buildCorsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── 1. Autenticación ─────────────────────────────────────────────────────
  const auth = await verifyDocente(req);
  if (!auth.ok) return errorResponse(auth.err, cors);
  const { userId, serviceClient } = auth.ctx;

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(
        JSON.stringify({ error: "Cuerpo vacío." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { action, payload } = JSON.parse(rawBody) as {
      action: "fetchPosts" | "publishPost";
      payload: FetchPayload | PublishPayload;
    };

    // ── 2. Obtener avisos ─────────────────────────────────────────────────
    if (action === "fetchPosts") {
      const { course_id } = payload as FetchPayload;
      if (!course_id) {
        return new Response(
          JSON.stringify({ error: "Falta course_id." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      // Verificar ownership — un docente no puede leer avisos de materias ajenas
      const ownsThisCourse = await verifyCourseOwnership(serviceClient, course_id, userId);
      if (!ownsThisCourse) {
        return new Response(
          JSON.stringify({ error: "No tienes permiso sobre esta materia." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await serviceClient
        .from("course_announcements")
        .select("id, title, content, created_at, author_id")
        .eq("course_id", course_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[TABLON_FETCH_ERROR]", error);
        return new Response(
          JSON.stringify({ error: "Error al obtener avisos." }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Publicar aviso ─────────────────────────────────────────────────
    if (action === "publishPost") {
      const { course_id, titulo, contenido } = payload as PublishPayload;

      if (!course_id || !titulo?.trim() || !contenido?.trim()) {
        return new Response(
          JSON.stringify({ error: "Faltan course_id, titulo o contenido." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      // Verificar que la materia es del docente autenticado
      const ownsThisCourse = await verifyCourseOwnership(serviceClient, course_id, userId);
      if (!ownsThisCourse) {
        return new Response(
          JSON.stringify({ error: "No tienes permiso sobre esta materia." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      // El author_id siempre es el userId del JWT — nunca del payload del cliente
      const { data: aviso, error: dbError } = await serviceClient
        .from("course_announcements")
        .insert([{ course_id, title: titulo, content: contenido, author_id: userId }])
        .select()
        .single();

      if (dbError) {
        console.error("[TABLON_INSERT_ERROR]", dbError);
        return new Response(
          JSON.stringify({ error: "Error al guardar el aviso." }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      // Notificación por correo en background — no bloquea la respuesta
      sendEmailNotification(serviceClient, course_id, titulo, contenido, userId).catch(
        (e) => console.warn("[NOTIFICACION_SILENCIOSA]", e)
      );

      return new Response(
        JSON.stringify({ success: true, data: aviso }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Acción desconocida: ${action}` }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("[TABLON_CRITICAL]", err);
    return new Response(
      JSON.stringify({ error: "Error crítico del servidor." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

// ─── Notificación por correo (aislada del flujo principal) ───────────────────

async function sendEmailNotification(
  serviceClient: SupabaseClient,
  courseId: string,
  titulo: string,
  contenido: string,
  authorId: string,
) {
  const { data: course } = await serviceClient
    .from("courses")
    .select("title, google_sheet_id")
    .eq("id", courseId)
    .single();

  if (!course?.google_sheet_id) return;

  // Obtenemos el nombre del docente desde profiles (first_name + last_name)
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", authorId)
    .single();

  const autorNombre = profile
    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
    : "El docente";

  const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL");
  const WEBHOOK_SECRET = Deno.env.get("APPS_SCRIPT_SECRET");
  if (!APPS_SCRIPT_URL) return;

  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: WEBHOOK_SECRET,
      action: "notificarAviso",
      payload: {
        titulo,
        contenido,
        materiaNombre: course.title,
        googleSheetId: course.google_sheet_id,
        autorNombre,
      },
    }),
  });
}
