// deno-lint-ignore-file no-import-prefix
/**
 * Autenticación y control de acceso compartidos por las Edge Functions.
 * Verifica el JWT del request contra Supabase Auth y resuelve el rol/ownership
 * consultando `profiles`/`courses`/`students` con el service role (para no
 * depender de policies RLS distintas en cada función).
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

// Re-exportado para que otras funciones tipen sus helpers (ej. syncWithSheet)
// contra ESTA misma instancia del módulo en vez de re-importar createClient
// por su cuenta — dos imports "iguales" de esm.sh pueden resolver a versiones
// transitorias distintas y romper el chequeo de tipos entre archivos.
export type { SupabaseClient }

export interface AuthErr {
  status: number
  message: string
}

export interface AuthCtx {
  userId: string
  user: { id: string }
  role: string
  serviceClient: SupabaseClient
}

export type AuthResult =
  | { ok: true; ctx: AuthCtx }
  | { ok: false; err: AuthErr }

export function buildCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }
}

export function errorResponse(err: AuthErr, cors: HeadersInit): Response {
  return new Response(
    JSON.stringify({ error: err.message }),
    { status: err.status, headers: { ...cors, "Content-Type": "application/json" } },
  )
}

function serviceClient(): SupabaseClient {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

/**
 * Reintenta una vez (con una pequeña espera) una consulta de Supabase que
 * puede fallar por un 504/hiccup transitorio de PostgREST. Solo para lecturas
 * idempotentes (no usar con inserts/updates). Ver incidente 2026-09-14:
 * /auth/v1/user y /rest/v1/profiles devolviendo 504 intermitentes en producción.
 */
async function selectWithRetry<T>(
  fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  retries = 1,
  delayMs = 400,
): Promise<{ data: T | null; error: { message: string } | null }> {
  let result = await fn()
  let attempt = 0
  while (result.error && attempt < retries) {
    await new Promise((r) => setTimeout(r, delayMs))
    result = await fn()
    attempt++
  }
  return result
}

/** Verifica que el request trae un JWT válido de Supabase Auth. No exige rol. */
export async function verifyUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return { ok: false, err: { status: 401, message: "Falta encabezado de autorización." } }

  const jwt = authHeader.replace(/^Bearer\s+/i, "")

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  // Verificación local de la firma del JWT (asimétrica, ES256) vía JWKS
  // cacheado por el SDK — a diferencia de auth.getUser(), NO dispara un
  // round-trip de red a /auth/v1/user en cada request, así que no depende
  // de la disponibilidad de ese endpoint (ver incidente 2026-09-14: 504
  // intermitentes ahí tumbaban silenciosamente cualquier acción autenticada).
  const { data: claimsData, error: claimsErr } = await selectWithRetry(() => callerClient.auth.getClaims(jwt))
  const userId = claimsData?.claims?.sub as string | undefined
  if (claimsErr || !userId) return { ok: false, err: { status: 401, message: "No se pudo verificar tu sesión." } }

  const admin = serviceClient()
  const { data: profile, error: profileErr } = await selectWithRetry(() =>
    admin.from("profiles").select("role").eq("id", userId).single()
  )
  if (profileErr || !profile) return { ok: false, err: { status: 403, message: "No se pudo verificar tu perfil." } }

  return { ok: true, ctx: { userId, user: { id: userId }, role: (profile as { role: string }).role, serviceClient: admin } }
}

/** Como verifyUser, pero exige rol "docente" o "admin" (los admins operan como super-docentes). */
export async function verifyDocente(req: Request): Promise<AuthResult> {
  const result = await verifyUser(req)
  if (!result.ok) return result
  if (result.ctx.role !== "docente" && result.ctx.role !== "admin") {
    return { ok: false, err: { status: 403, message: "Se requiere rol de docente." } }
  }
  return result
}

/** true si `userId` es dueño de `courseId` (teacher_id) o es admin. */
export async function verifyCourseOwnership(
  client: SupabaseClient,
  courseId: string,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await selectWithRetry(() =>
    client.from("profiles").select("role").eq("id", userId).single()
  )
  if ((profile as { role?: string } | null)?.role === "admin") return true

  const { data: course } = await selectWithRetry(() =>
    client.from("courses").select("teacher_id").eq("id", courseId).single()
  )
  return (course as { teacher_id?: string } | null)?.teacher_id === userId
}

/** true si `studentId` pertenece a `courseId` (previene IDOR entre materias). */
export async function verifyStudentOwnership(
  client: SupabaseClient,
  studentId: string,
  courseId: string,
): Promise<boolean> {
  const { data } = await client
    .from("students").select("id").eq("id", studentId).eq("course_id", courseId).single()
  return !!data
}

// ── Piloto ai-tutor-sandbox ──────────────────────────────────────────────
// Único punto que decide si UN alumno concreto puede usar el tutor de IA
// para UNA materia/contexto concreto. No basta con `verifyUser` + rol
// "alumno": el acceso es un piloto acotado, apagado por defecto en cada
// materia (ver migración 20260909000000_ai_tutor_sandbox_pilot.sql) y con una
// regla de seguridad no-negociable para "exam_prep" (nunca debe coexistir con
// la ventana real del examen — ver más abajo).
export type SandboxContextType = "assignment" | "exam_prep" | "general"

export interface VerifySandboxParams {
  courseId: string
  contextType: SandboxContextType
  assignmentId?: string
  examId?: string
}

const SANDBOX_FLAG_BY_CONTEXT: Record<SandboxContextType, string> = {
  assignment: "ai_sandbox_assignments_enabled",
  exam_prep: "ai_sandbox_exam_prep_enabled",
  general: "ai_sandbox_general_enabled",
}

/**
 * Exige rol "alumno", inscripción real en `courseId` (tabla `enrollments`),
 * y que el interruptor específico del modo (`ai_sandbox_*_enabled`) esté
 * encendido para esa materia. Para "assignment"/"exam_prep" además valida que
 * el recurso referenciado pertenezca a esa misma materia (previene IDOR:
 * un alumno de la materia A no puede colar el `assignmentId` de la materia B).
 *
 * Regla dura para "exam_prep": se bloquea en cuanto `exams.start_at` ya
 * pasó (examen en curso o cerrado) — este modo es SOLO repaso de temario
 * antes de que abra la ventana real del examen, nunca durante ni después.
 * Un `start_at` nulo (examen aún sin programar) se permite.
 */
export async function verifyAlumnoSandbox(req: Request, params: VerifySandboxParams): Promise<AuthResult> {
  const result = await verifyUser(req)
  if (!result.ok) return result
  if (result.ctx.role !== "alumno") {
    return { ok: false, err: { status: 403, message: "Se requiere rol de alumno." } }
  }

  const { serviceClient, userId } = result.ctx
  const { courseId, contextType, assignmentId, examId } = params

  const { data: enrollment } = await serviceClient
    .from("enrollments").select("student_id").eq("student_id", userId).eq("course_id", courseId).single()
  if (!enrollment) {
    return { ok: false, err: { status: 403, message: "No estás inscrito en esta materia." } }
  }

  const flagColumn = SANDBOX_FLAG_BY_CONTEXT[contextType]
  const { data: course } = await serviceClient
    .from("courses").select(flagColumn).eq("id", courseId).single()
  if (!course || !(course as Record<string, unknown>)[flagColumn]) {
    return { ok: false, err: { status: 403, message: "El tutor de IA no está habilitado para esta materia/modo." } }
  }

  if (contextType === "assignment") {
    if (!assignmentId) return { ok: false, err: { status: 400, message: "Falta assignmentId." } }
    const { data: assignment } = await serviceClient
      .from("assignments").select("id").eq("id", assignmentId).eq("course_id", courseId).single()
    if (!assignment) return { ok: false, err: { status: 404, message: "Actividad no encontrada en esta materia." } }
  }

  if (contextType === "exam_prep") {
    if (!examId) return { ok: false, err: { status: 400, message: "Falta examId." } }
    const { data: exam } = await serviceClient
      .from("exams").select("id, start_at, course_id").eq("id", examId).eq("course_id", courseId).single()
    if (!exam) return { ok: false, err: { status: 404, message: "Examen no encontrado en esta materia." } }
    if (exam.start_at && new Date(exam.start_at).getTime() <= Date.now()) {
      return {
        ok: false,
        err: { status: 403, message: "El repaso ya no está disponible: la ventana del examen ya abrió o cerró." },
      }
    }
  }

  return result
}
