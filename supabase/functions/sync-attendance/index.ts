// deno-lint-ignore-file no-import-prefix
/**
 * sync-attendance
 * Recibe el pase de lista del docente, persiste en la tabla `attendance`
 * y sincroniza con Google Sheets en background.
 *
 * Corrige: tabla 'perfiles'→'profiles'→'students', columna 'matricula_rfc'→'matricula',
 *          tabla 'materias'→'courses', ausencia de autenticación.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildCorsHeaders,
  errorResponse,
  verifyCourseOwnership,
  verifyDocente,
  type SupabaseClient,
} from "../_shared/auth.ts";

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** status: 0 = ausente, 0.5 = justificado/tardanza, 1 = presente */
type AttendanceStatus = 0 | 0.5 | 1;

interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
}

interface RequestPayload {
  courseId: string;
  records: AttendanceRecord[];    // [{studentId, status}]
  sessionDate: string;            // "YYYY-MM-DD"
  sessionNumber: 1 | 2 | 3;      // Restricción del esquema SQL
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const cors = buildCorsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── 1. Autenticación ─────────────────────────────────────────────────────
  const auth = await verifyDocente(req);
  if (!auth.ok) return errorResponse(auth.err, cors);
  const { userId, serviceClient } = auth.ctx;

  try {
    const body = await req.json() as RequestPayload;
    const { courseId, records, sessionDate, sessionNumber } = body;

    // ── 2. Validación de payload ──────────────────────────────────────────
    if (!courseId || !records || !sessionDate || !sessionNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan campos: courseId, records, sessionDate, sessionNumber." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    if (![1, 2, 3].includes(sessionNumber)) {
      return new Response(
        JSON.stringify({ success: false, error: "sessionNumber debe ser 1, 2 o 3." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const validStatuses: AttendanceStatus[] = [0, 0.5, 1];
    const hasInvalidStatus = records.some((r) => !validStatuses.includes(r.status));
    if (hasInvalidStatus) {
      return new Response(
        JSON.stringify({ success: false, error: "status debe ser 0, 0.5 o 1." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Verificar ownership de la materia ─────────────────────────────
    const ownsThisCourse = await verifyCourseOwnership(serviceClient, courseId, userId);
    if (!ownsThisCourse) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Reemplazar asistencia de la sesión completa ────────────────────
    // Estrategia DELETE+INSERT garantiza idempotencia: llamar dos veces produce el mismo resultado.
    await serviceClient
      .from("validated_attendances")
      .delete()
      .eq("course_id", courseId)
      .eq("session_date", sessionDate)
      .eq("session_number", sessionNumber);

    const attendanceRows = records.map((r) => ({
      course_id: courseId,
      student_id: r.studentId,
      session_date: sessionDate,
      session_number: sessionNumber,
      status: r.status,
    }));

    const { error: insertError } = await serviceClient.from("validated_attendances").insert(attendanceRows);
    if (insertError) throw insertError;

    // ── 5. Sincronizar con Google Sheets en background ────────────────────
    syncWithSheet(serviceClient, courseId, sessionDate, records).catch(
      (e) => console.error("[SYNC_SHEET_SILENCIOSO]", e)
    );

    return new Response(
      JSON.stringify({ success: true, registros: records.length }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("[SYNC_ATTENDANCE_ERROR]", err);
    return new Response(
      JSON.stringify({ success: false, error: "Error interno del servidor." }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

// ─── Sincronización con Google Sheets ────────────────────────────────────────

async function syncWithSheet(
  serviceClient: SupabaseClient,
  courseId: string,
  sessionDate: string,
  records: AttendanceRecord[],
) {
  // Obtenemos el Sheet ID desde `courses` (nombre correcto de tabla)
  const { data: course } = await serviceClient
    .from("courses")
    .select("google_sheet_id")
    .eq("id", courseId)
    .single();

  if (!course?.google_sheet_id) return;

  // Construimos el mapa por matrícula para Apps Script (usa matricula, no UUID)
  const studentIds = records.map((r) => r.studentId);
  const { data: students } = await serviceClient
    .from("students")
    .select("id, matricula")
    .in("id", studentIds)
    .eq("course_id", courseId);

  if (!students?.length) return;

  const matriculaMap: Record<string, AttendanceStatus> = {};
  for (const s of students) {
    const record = records.find((r) => r.studentId === s.id);
    if (record) matriculaMap[s.matricula] = record.status;
  }

  const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL");
  const WEBHOOK_SECRET = Deno.env.get("APPS_SCRIPT_SECRET");
  if (!APPS_SCRIPT_URL) return;

  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: WEBHOOK_SECRET,
      action: "registrarAsistencia",
      payload: {
        googleSheetId: course.google_sheet_id,
        asistenciaMap: matriculaMap,
        fecha: sessionDate,
      },
    }),
  });
}
