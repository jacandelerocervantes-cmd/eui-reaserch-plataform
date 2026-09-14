// deno-lint-ignore-file no-import-prefix
/**
 * sync-grading-matrix
 * Exporta la sábana de calificaciones completa a Google Sheets.
 * Corrige: tabla 'materias'→'courses', ausencia de autenticación.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildCorsHeaders,
  errorResponse,
  verifyCourseOwnership,
  verifyDocente,
} from "../_shared/auth.ts";

interface GradingMatrixPayload {
  courseId: string;
  matrixData: {
    unidades: { numero: number; nombre: string; criterios: { nombre: string; valor: number }[] }[];
    alumnos: { matricula: string; nombre: string; unidades: { notas: number[]; promedioUnidad: number }[]; promedioFinal: number }[];
  };
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── 1. Autenticación ─────────────────────────────────────────────────────
  const auth = await verifyDocente(req);
  if (!auth.ok) return errorResponse(auth.err, cors);
  const { userId, serviceClient } = auth.ctx;

  try {
    const { courseId, matrixData } = await req.json() as GradingMatrixPayload;

    if (!courseId || !matrixData) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan courseId o matrixData." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Verificar que la materia pertenece al docente ──────────────────
    const ownsThisCourse = await verifyCourseOwnership(serviceClient, courseId, userId);
    if (!ownsThisCourse) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Obtener google_sheet_id desde 'courses' (nombre correcto) ──────
    const { data: course, error: courseError } = await serviceClient
      .from("courses")
      .select("google_sheet_id_calificaciones")
      .eq("id", courseId)
      .single();

    if (courseError || !course?.google_sheet_id_calificaciones) {
      return new Response(
        JSON.stringify({ success: false, error: "Esta materia no tiene Google Sheet de calificaciones vinculado." }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Llamar a Apps Script con timeout explícito ─────────────────────
    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL");
    const WEBHOOK_SECRET = Deno.env.get("APPS_SCRIPT_SECRET");
    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurado.");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000); // 25s máximo

    let scriptResult: unknown;
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: WEBHOOK_SECRET,
          action: "actualizarSabanaNotas",
          payload: { googleSheetId: course.google_sheet_id_calificaciones, dataMatrix: matrixData },
        }),
        signal: controller.signal,
      });
      scriptResult = await response.json();
    } catch (fetchErr: unknown) {
      if ((fetchErr as Error).name === "AbortError") {
        throw new Error("Apps Script tardó demasiado (timeout 25s).");
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    return new Response(
      JSON.stringify({ success: true, data: scriptResult }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("[SYNC_GRADING_ERROR]", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Error interno." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
