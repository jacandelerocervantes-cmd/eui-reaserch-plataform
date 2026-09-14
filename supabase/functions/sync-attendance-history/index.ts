// deno-lint-ignore-file no-import-prefix
/**
 * sync-attendance-history
 * Reconstruye el historial completo de asistencia en Google Sheets.
 * Corrige: tabla 'materias'→'courses', ausencia de autenticación.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildCorsHeaders,
  errorResponse,
  verifyCourseOwnership,
  verifyDocente,
} from "../_shared/auth.ts";

interface AlumnoHistorial {
  matricula: string;
  nombre_completo: string;
  asistencias: { fecha: string; sesion: number; estatus: 0 | 0.5 | 1 }[];
  resumen: { porcentaje: number; derecho_examen: boolean };
}

interface RequestPayload {
  courseId: string;
  unitNumber?: number;
  unitTitle?: string;
  payload: { alumnos: AlumnoHistorial[] };
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── 1. Autenticación ─────────────────────────────────────────────────────
  const auth = await verifyDocente(req);
  if (!auth.ok) return errorResponse(auth.err, cors);
  const { userId, serviceClient } = auth.ctx;

  try {
    const { courseId, payload, unitNumber, unitTitle } = await req.json() as RequestPayload;

    if (!courseId || !payload?.alumnos) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan courseId o payload.alumnos." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Verificar ownership ────────────────────────────────────────────
    const ownsThisCourse = await verifyCourseOwnership(serviceClient, courseId, userId);
    if (!ownsThisCourse) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Obtener google_sheet_id desde 'courses' (nombre correcto) ──────
    const { data: course } = await serviceClient
      .from("courses")
      .select("google_sheet_id")
      .eq("id", courseId)
      .single();

    if (!course?.google_sheet_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Esta materia no tiene Google Sheet vinculado." }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Llamar a Apps Script con timeout ───────────────────────────────
    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL");
    const WEBHOOK_SECRET = Deno.env.get("APPS_SCRIPT_SECRET");
    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurado.");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    let result: unknown;
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: WEBHOOK_SECRET,
          action: "actualizarHistorialCompleto",
          payload: {
            googleSheetId: course.google_sheet_id,
            alumnos: payload.alumnos,
            unitNumber: unitNumber ?? null,
            unitTitle: unitTitle ?? null,
          },
        }),
        signal: controller.signal,
      });
      result = await res.json();
    } catch (fetchErr: unknown) {
      if ((fetchErr as Error).name === "AbortError") throw new Error("Timeout al contactar Apps Script.");
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("[SYNC_ATTENDANCE_HISTORY_ERROR]", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Error interno." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
