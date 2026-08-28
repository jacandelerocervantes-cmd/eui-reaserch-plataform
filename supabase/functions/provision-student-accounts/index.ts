// deno-lint-ignore-file no-import-prefix
/**
 * provision-student-accounts
 * Crea una cuenta real en Supabase Auth (auth.users + profiles) para cada
 * alumno del roster de una materia que todavía no tenga una, e invita por
 * correo — mismo patrón que admin-create-account
 * (auth.admin.inviteUserByEmail). Invocada desde
 * app/(docente)/panel/materias/[id]/alumnos/page.tsx (handleProvisionAccounts).
 *
 * Idempotencia: se apoya en `students.user_id` (columna NUEVA, agregada por
 * supabase/pendiente/013_students_user_id.sql — TODAVÍA NO APLICADA a
 * ninguna base real, ver ese archivo). `students` en el esquema base
 * (supabase/migrations/20260225000320_remote_schema.sql) no tiene forma de
 * vincularse con auth.users, así que sin esa migración corrida esta función
 * fallará al leer/escribir `user_id` — es una dependencia real y documentada,
 * no un olvido.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"

type StudentRow = {
  id: string
  correo: string | null
  user_id: string | null
  matricula: string
  nombres: string
  apellido_paterno: string
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────
  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    const { course_id } = await req.json()
    if (!course_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Falta course_id." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 2. Ownership ────────────────────────────────────────────────────
    const owns = await verifyCourseOwnership(serviceClient, course_id, userId)
    if (!owns) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 3. Roster ─────────────────────────────────────────────────────────
    const { data: students, error: studentsErr } = await serviceClient
      .from("students")
      .select("id, correo, user_id, matricula, nombres, apellido_paterno")
      .eq("course_id", course_id)

    if (studentsErr) {
      // Caso esperado si 013_students_user_id.sql no se ha corrido todavía:
      // PostgREST devuelve error de columna inexistente ("user_id").
      const msg = studentsErr.message?.includes("user_id")
        ? "La columna students.user_id no existe todavía — corre supabase/pendiente/013_students_user_id.sql antes de usar esta función."
        : studentsErr.message
      throw new Error(msg)
    }

    const created: string[] = []
    const skippedExisting: string[] = []
    const skippedNoEmail: string[] = []
    const failed: { email: string; error: string }[] = []

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // ── 4. Un alumno a la vez — inviteUserByEmail ya hace su propio
    // round-trip a Auth; secuencial evita ráfagas contra ese servicio y
    // mantiene el reporte final consistente con el orden del roster.
    for (const s of (students as StudentRow[]) ?? []) {
      if (!s.correo) { skippedNoEmail.push(s.matricula); continue }
      if (s.user_id) { skippedExisting.push(s.correo); continue }

      try {
        const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(s.correo, {
          data: { first_name: s.nombres, last_name: s.apellido_paterno, student_id: s.id },
        })

        if (inviteErr) {
          // Caso típico: ya existe un usuario de Auth con ese correo (de
          // otra materia, o creado por otra vía) pero students.user_id
          // todavía no quedó vinculado. No hay una forma estable/soportada
          // de recuperar el id de un usuario existente solo por email en
          // esta versión de supabase-js sin una llamada adicional no
          // documentada — se reporta como fallo explícito para que el
          // docente lo resuelva a mano (o el alumno acepte la invitación
          // si en realidad nunca la había aceptado).
          throw new Error(inviteErr.message)
        }

        const newUserId = invited.user?.id
        if (!newUserId) throw new Error("La invitación no devolvió un ID de usuario válido.")

        const { error: upsertErr } = await serviceClient.from("profiles").upsert({
          id: newUserId,
          role: "alumno",
          first_name: s.nombres,
          last_name: s.apellido_paterno,
        })
        if (upsertErr) throw new Error(`Cuenta creada pero no se pudo guardar el perfil: ${upsertErr.message}`)

        const { error: linkErr } = await serviceClient.from("students").update({ user_id: newUserId }).eq("id", s.id)
        if (linkErr) throw new Error(`Cuenta creada pero no se pudo vincular con el alumno: ${linkErr.message}`)

        created.push(s.correo)
      } catch (e) {
        failed.push({ email: s.correo, error: e instanceof Error ? e.message : String(e) })
      }
    }

    return new Response(
      JSON.stringify({ success: true, created, skippedExisting, skippedNoEmail, failed }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[PROVISION_STUDENT_ACCOUNTS]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
