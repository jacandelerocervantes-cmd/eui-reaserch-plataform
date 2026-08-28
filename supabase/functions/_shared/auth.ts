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

/** Verifica que el request trae un JWT válido de Supabase Auth. No exige rol. */
export async function verifyUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return { ok: false, err: { status: 401, message: "Falta encabezado de autorización." } }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error } = await callerClient.auth.getUser()
  if (error || !user) return { ok: false, err: { status: 401, message: "No se pudo verificar tu sesión." } }

  const admin = serviceClient()
  const { data: profile, error: profileErr } = await admin
    .from("profiles").select("role").eq("id", user.id).single()
  if (profileErr || !profile) return { ok: false, err: { status: 403, message: "No se pudo verificar tu perfil." } }

  return { ok: true, ctx: { userId: user.id, user: { id: user.id }, role: profile.role, serviceClient: admin } }
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
  const { data: profile } = await client.from("profiles").select("role").eq("id", userId).single()
  if (profile?.role === "admin") return true

  const { data: course } = await client.from("courses").select("teacher_id").eq("id", courseId).single()
  return course?.teacher_id === userId
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
