// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * sync-tablon
 * CRUD de avisos y comentarios en course_announcements y course_announcement_comments.
 * Autentica vía JWT verificado (verifyUser) y delega autorización según acción:
 * - fetchPosts / publishPost: docente dueño (o alumno inscrito para lectura).
 * - listComments / postComment: docente dueño o alumno inscrito (si allow_comments=true).
 * - hideComment / unhideComment: exclusivo docente dueño del curso (moderación individual reversible).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildCorsHeaders,
  errorResponse,
  verifyCourseOwnership,
  verifyUser,
  type SupabaseClient,
} from "../_shared/auth.ts";

interface FetchPayload { course_id: string }
interface PublishPayload { course_id: string; titulo: string; contenido: string; allow_comments?: boolean }
interface ListCommentsPayload { announcement_id: string }
interface PostCommentPayload { announcement_id: string; content: string }
interface ModerateCommentPayload { comment_id: string }

serve(async (req: Request) => {
  const cors = buildCorsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── 1. Autenticación unificada ───────────────────────────────────────────
  const auth = await verifyUser(req);
  if (!auth.ok) return errorResponse(auth.err, cors);
  const { userId, role, serviceClient } = auth.ctx;

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(
        JSON.stringify({ error: "Cuerpo vacío." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { action, payload } = JSON.parse(rawBody) as {
      action: "fetchPosts" | "publishPost" | "listComments" | "postComment" | "hideComment" | "unhideComment";
      payload: any;
    };

    // ── 2. Obtener avisos ─────────────────────────────────────────────────
    if (action === "fetchPosts") {
      const { course_id } = (payload ?? {}) as FetchPayload;
      if (!course_id) {
        return new Response(
          JSON.stringify({ error: "Falta course_id." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      if (role === "docente" || role === "admin") {
        const ownsThisCourse = await verifyCourseOwnership(serviceClient, course_id, userId);
        if (!ownsThisCourse) {
          return new Response(
            JSON.stringify({ error: "No tienes permiso sobre esta materia." }),
            { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
      } else {
        const { data: enrollment } = await serviceClient
          .from("enrollments")
          .select("student_id")
          .eq("student_id", userId)
          .eq("course_id", course_id)
          .maybeSingle();

        if (!enrollment) {
          return new Response(
            JSON.stringify({ error: "No estás inscrito en esta materia." }),
            { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
      }

      const { data, error } = await serviceClient
        .from("course_announcements")
        .select("id, title, content, created_at, author_id, allow_comments")
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

    // ── 3. Publicar aviso (Solo docente) ──────────────────────────────────
    if (action === "publishPost") {
      if (role !== "docente" && role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Solo los docentes pueden publicar avisos." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const { course_id, titulo, contenido, allow_comments } = (payload ?? {}) as PublishPayload;

      if (!course_id || !titulo?.trim() || !contenido?.trim()) {
        return new Response(
          JSON.stringify({ error: "Faltan course_id, titulo o contenido." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const ownsThisCourse = await verifyCourseOwnership(serviceClient, course_id, userId);
      if (!ownsThisCourse) {
        return new Response(
          JSON.stringify({ error: "No tienes permiso sobre esta materia." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const allowCommentsVal = typeof allow_comments === "boolean" ? allow_comments : true;

      const { data: aviso, error: dbError } = await serviceClient
        .from("course_announcements")
        .insert([{
          course_id,
          title: titulo.trim(),
          content: contenido.trim(),
          author_id: userId,
          allow_comments: allowCommentsVal,
        }])
        .select()
        .single();

      if (dbError) {
        console.error("[TABLON_INSERT_ERROR]", dbError);
        return new Response(
          JSON.stringify({ error: "Error al guardar el aviso." }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      sendEmailNotification(serviceClient, course_id, titulo, contenido, userId).catch(
        (e) => console.warn("[NOTIFICACION_SILENCIOSA]", e)
      );

      return new Response(
        JSON.stringify({ success: true, data: aviso }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Listar comentarios de un aviso ─────────────────────────────────
    if (action === "listComments") {
      const { announcement_id } = (payload ?? {}) as ListCommentsPayload;
      if (!announcement_id) {
        return new Response(
          JSON.stringify({ error: "Falta announcement_id." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const { data: announcement, error: annError } = await serviceClient
        .from("course_announcements")
        .select("id, course_id, allow_comments")
        .eq("id", announcement_id)
        .maybeSingle();

      if (annError || !announcement) {
        return new Response(
          JSON.stringify({ error: "Aviso no encontrado." }),
          { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const isTeacher = (role === "docente" || role === "admin") &&
        await verifyCourseOwnership(serviceClient, announcement.course_id, userId);

      if (!isTeacher) {
        const { data: enrollment } = await serviceClient
          .from("enrollments")
          .select("student_id")
          .eq("student_id", userId)
          .eq("course_id", announcement.course_id)
          .maybeSingle();

        if (!enrollment) {
          return new Response(
            JSON.stringify({ error: "No tienes permiso para ver comentarios de este aviso." }),
            { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
      }

      // Si el alumno consulta un anuncio con comentarios deshabilitados: no devuelve comentarios
      if (!isTeacher && !announcement.allow_comments) {
        return new Response(
          JSON.stringify({ success: true, data: [], allow_comments: false, is_teacher: false }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      let query = serviceClient
        .from("course_announcement_comments")
        .select("id, announcement_id, author_id, content, created_at, hidden_at, hidden_by")
        .eq("announcement_id", announcement_id)
        .order("created_at", { ascending: true });

      // Los alumnos nunca reciben comentarios ocultados por el docente
      if (!isTeacher) {
        query = query.is("hidden_at", null);
      }

      const { data: rawComments, error: comError } = await query;
      if (comError) {
        console.error("[LIST_COMMENTS_ERROR]", comError);
        return new Response(
          JSON.stringify({ error: "Error al obtener comentarios." }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const comments = rawComments ?? [];
      const authorIds = [...new Set(comments.map((c) => c.author_id))];

      const profileMap: Record<string, { name: string; role: string }> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await serviceClient
          .from("profiles")
          .select("id, first_name, last_name, role")
          .in("id", authorIds);

        for (const p of profiles ?? []) {
          const fullName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || (p.role === "docente" ? "Docente" : "Alumno");
          profileMap[p.id] = { name: fullName, role: p.role };
        }
      }

      const enriched = comments.map((c) => ({
        ...c,
        author_name: profileMap[c.author_id]?.name ?? "Usuario",
        author_role: profileMap[c.author_id]?.role ?? "alumno",
      }));

      return new Response(
        JSON.stringify({
          success: true,
          data: enriched,
          allow_comments: announcement.allow_comments,
          is_teacher: isTeacher,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 5. Publicar comentario (Docente o Alumno inscrito) ─────────────────
    if (action === "postComment") {
      const { announcement_id, content } = (payload ?? {}) as PostCommentPayload;
      if (!announcement_id || !content?.trim()) {
        return new Response(
          JSON.stringify({ error: "Faltan announcement_id o contenido." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const { data: announcement, error: annError } = await serviceClient
        .from("course_announcements")
        .select("id, course_id, allow_comments")
        .eq("id", announcement_id)
        .maybeSingle();

      if (annError || !announcement) {
        return new Response(
          JSON.stringify({ error: "Aviso no encontrado." }),
          { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      if (!announcement.allow_comments) {
        return new Response(
          JSON.stringify({ error: "Este anuncio no acepta comentarios." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const isTeacher = (role === "docente" || role === "admin") &&
        await verifyCourseOwnership(serviceClient, announcement.course_id, userId);

      if (!isTeacher) {
        const { data: enrollment } = await serviceClient
          .from("enrollments")
          .select("student_id")
          .eq("student_id", userId)
          .eq("course_id", announcement.course_id)
          .maybeSingle();

        if (!enrollment) {
          return new Response(
            JSON.stringify({ error: "No estás inscrito en esta materia." }),
            { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
      }

      const { data: newComment, error: insertErr } = await serviceClient
        .from("course_announcement_comments")
        .insert([{
          announcement_id,
          author_id: userId,
          content: content.trim(),
        }])
        .select("id, announcement_id, author_id, content, created_at, hidden_at, hidden_by")
        .single();

      if (insertErr || !newComment) {
        console.error("[POST_COMMENT_ERROR]", insertErr);
        return new Response(
          JSON.stringify({ error: "Error al guardar el comentario." }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const { data: authorProfile } = await serviceClient
        .from("profiles")
        .select("first_name, last_name, role")
        .eq("id", userId)
        .maybeSingle();

      const authorName = authorProfile
        ? `${authorProfile.first_name ?? ""} ${authorProfile.last_name ?? ""}`.trim() || (isTeacher ? "Docente" : "Alumno")
        : (isTeacher ? "Docente" : "Alumno");

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...newComment,
            author_name: authorName,
            author_role: authorProfile?.role ?? (isTeacher ? "docente" : "alumno"),
          },
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 6. Moderar comentario: Ocultar / Mostrar (Exclusivo Docente) ───────
    if (action === "hideComment" || action === "unhideComment") {
      if (role !== "docente" && role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Solo los docentes pueden moderar comentarios." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const { comment_id } = (payload ?? {}) as ModerateCommentPayload;
      if (!comment_id) {
        return new Response(
          JSON.stringify({ error: "Falta comment_id." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const { data: comment, error: cErr } = await serviceClient
        .from("course_announcement_comments")
        .select("id, announcement_id, course_announcements(course_id)")
        .eq("id", comment_id)
        .maybeSingle();

      if (cErr || !comment) {
        return new Response(
          JSON.stringify({ error: "Comentario no encontrado." }),
          { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const courseId = (comment as any)?.course_announcements?.course_id;
      if (!courseId) {
        return new Response(
          JSON.stringify({ error: "No se pudo determinar el curso del comentario." }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const ownsThisCourse = await verifyCourseOwnership(serviceClient, courseId, userId);
      if (!ownsThisCourse) {
        return new Response(
          JSON.stringify({ error: "No tienes permiso sobre esta materia." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const isHiding = action === "hideComment";
      const { data: updated, error: updErr } = await serviceClient
        .from("course_announcement_comments")
        .update({
          hidden_at: isHiding ? new Date().toISOString() : null,
          hidden_by: isHiding ? userId : null,
        })
        .eq("id", comment_id)
        .select("id, hidden_at, hidden_by")
        .single();

      if (updErr) {
        console.error("[MODERATE_COMMENT_ERROR]", updErr);
        return new Response(
          JSON.stringify({ error: "Error al actualizar estado del comentario." }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: updated }),
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
