// deno-lint-ignore-file no-import-prefix
/**
 * submit-assignment-file
 * Sube el archivo que un ALUMNO entrega para una actividad. El archivo va a
 * Drive (carpeta de la actividad → subcarpeta del alumno/equipo dentro de
 * 02_Entregas_Actividades), no a Supabase Storage — mismo motivo que
 * create-assignment-hub: el bloqueo de acceso post-cierre que ya aplica a
 * los Docs de Workspace también debe cubrir estas entregas.
 *
 * Quien llama es el ALUMNO (no un docente) — la sesión se valida con
 * verifyUser (cualquier rol autenticado), y el alumno se resuelve por
 * correo+course_id contra `students`, exactamente como ya hace
 * app/alumno/materia/[id]/entregar/[assignmentId]/_services/fetchAssignment.tsx
 * (students no tiene columna user_id todavía — ver
 * supabase/pendiente/013_students_user_id.sql).
 *
 * Caso a cubrir: create-assignment-hub crea las filas de `submissions` con
 * drive_folder_id=null y las rellena en background (o vía retry si algo
 * falla). Si el alumno sube su archivo ANTES de que ese background termine
 * (o si nunca terminó), esta función resuelve/crea la carpeta ella misma con
 * el mismo patrón (crearCarpetaActividad) y persiste el resultado en
 * `submissions` para que quede disponible después.
 */
import { buildCorsHeaders, errorResponse, verifyUser } from "../_shared/auth.ts"
import { validateFileBytesByExtension } from "../_shared/fileValidation.ts"

const MAX_FILE_BYTES = 20 * 1024 * 1024

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth: cualquier usuario con sesión válida (es un alumno) ────────
  const auth = await verifyUser(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { user, serviceClient } = auth.ctx

  try {
    const formData = await req.formData()
    const assignment_id = String(formData.get("assignment_id") ?? "")
    const course_id     = String(formData.get("course_id") ?? "")
    const file           = formData.get("file")

    if (!assignment_id || !course_id || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan campos requeridos: assignment_id, course_id, file." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 2. Resolver al alumno dueño de la sesión dentro de ESTA materia ──
    // (previene IDOR: un alumno de otra materia no puede entregar aquí aunque
    // adivine un assignment_id/course_id válidos de otro curso).
    const { data: { user: authedUser } } = await serviceClient.auth.admin.getUserById(user.id)
    const email = authedUser?.email ?? ""
    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "No se pudo determinar tu correo de sesión." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const { data: student } = await serviceClient
      .from("students")
      .select("id, matricula, apellido_paterno, apellido_materno, nombres, team_id, correo")
      .ilike("correo", email)
      .eq("course_id", course_id)
      .single()

    if (!student) {
      return new Response(
        JSON.stringify({ success: false, error: "No estás inscrito en esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 3. Actividad — debe pertenecer a esta materia ──────────────────
    const { data: assignment } = await serviceClient
      .from("assignments")
      .select("id, course_id, unit_id, title, format, hard_deadline, soft_deadline")
      .eq("id", assignment_id)
      .eq("course_id", course_id)
      .single()

    if (!assignment) {
      return new Response(
        JSON.stringify({ success: false, error: "Actividad no encontrada en esta materia." }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const effectiveDeadline = assignment.hard_deadline ?? assignment.soft_deadline ?? null
    if (effectiveDeadline && new Date() > new Date(effectiveDeadline)) {
      return new Response(
        JSON.stringify({ success: false, error: "La fecha límite de esta actividad ya pasó. Ya no se aceptan entregas." }),
        { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 4. Validar archivo ───────────────────────────────────────────────
    if (file.size === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "El archivo está vacío." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }
    if (file.size > MAX_FILE_BYTES) {
      return new Response(
        JSON.stringify({ success: false, error: `Archivo demasiado grande (máx ${MAX_FILE_BYTES / (1024 * 1024)}MB).` }),
        { status: 413, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const fileCheck = validateFileBytesByExtension(bytes, file.name)
    if (!fileCheck.ok) {
      return new Response(
        JSON.stringify({ success: false, error: fileCheck.reason }),
        { status: 415, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 5. Ubicar (o crear) la fila de submissions de este alumno ──────
    // Formato equipo: la fila real vive bajo student_id igual (create-assignment-hub
    // inserta una fila de submissions POR INTEGRANTE, con team_id compartido) —
    // buscar por assignment_id+student_id ya cubre ambos casos.
    let { data: submission } = await serviceClient
      .from("submissions")
      .select("id, drive_folder_id, content_url, team_id, version_number")
      .eq("assignment_id", assignment_id)
      .eq("student_id", student.id)
      .maybeSingle()

    if (!submission) {
      const { data: inserted, error: insertSubErr } = await serviceClient
        .from("submissions")
        .insert([{
          assignment_id, student_id: student.id, team_id: student.team_id ?? null,
          status: "draft", drive_folder_id: null, content_url: null, email_sent: false,
        }])
        .select("id, drive_folder_id, content_url, team_id, version_number")
        .single()
      if (insertSubErr) throw insertSubErr
      submission = inserted
    }

    // ── 6. Resolver carpeta destino en Drive (on-demand si aún no existe) ─
    let driveFolderId = submission!.drive_folder_id as string | null

    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
    const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")
    if (!APPS_SCRIPT_URL) {
      return new Response(
        JSON.stringify({ success: false, error: "Integración con Drive no configurada (APPS_SCRIPT_URL)." }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const callAppsScript = async (action: string, scriptPayload: Record<string, unknown>, timeoutMs: number) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: WEBHOOK_SECRET, action, payload: scriptPayload }),
          signal: controller.signal,
        })
        const json = await res.json()
        if (!json.success) return { success: false, error: json.error }
        return { success: true, ...(json.data ?? {}) }
      } finally {
        clearTimeout(timeout)
      }
    }

    if (!driveFolderId) {
      const { data: course } = await serviceClient
        .from("courses").select("drive_folder_id").eq("id", course_id).single()
      const { data: unit } = await serviceClient
        .from("course_units").select("unit_number, title").eq("id", assignment.unit_id).single()

      if (!course?.drive_folder_id) {
        return new Response(
          JSON.stringify({ success: false, error: "La materia no tiene una carpeta de Drive configurada todavía." }),
          { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
        )
      }

      // Mismo patrón que create-assignment-hub: por equipo se usa el nombre
      // del equipo; individual usa "matrícula - apellido nombres" como
      // subcarpeta propia dentro de la carpeta de la actividad.
      let teamName: string | null = null
      if (submission!.team_id) {
        const { data: team } = await serviceClient
          .from("assignment_teams").select("name").eq("id", submission!.team_id).single()
        teamName = team?.name ?? null
      } else {
        teamName = `${student.matricula} - ${student.apellido_paterno} ${student.nombres}`.trim()
      }

      const folderRes = await callAppsScript("crearCarpetaActividad", {
        courseFolderId: course.drive_folder_id, unitNumber: unit?.unit_number ?? 1,
        unitTitle: unit?.title ?? "", activityTitle: assignment.title, teamName,
      }, 20_000)

      if (!folderRes.success || !folderRes.drive_folder_id) {
        return new Response(
          JSON.stringify({ success: false, error: folderRes.error || "No se pudo crear la carpeta de entrega en Drive." }),
          { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
        )
      }
      driveFolderId = folderRes.drive_folder_id as string

      // Persistir para todos los integrantes del equipo (si aplica) — así el
      // próximo integrante que suba no vuelve a crear la carpeta.
      if (submission!.team_id) {
        await serviceClient.from("submissions")
          .update({ drive_folder_id: driveFolderId })
          .eq("assignment_id", assignment_id).eq("team_id", submission!.team_id)
        await serviceClient.from("assignment_teams")
          .update({ drive_folder_id: driveFolderId })
          .eq("assignment_id", assignment_id).eq("id", submission!.team_id)
      } else {
        await serviceClient.from("submissions")
          .update({ drive_folder_id: driveFolderId })
          .eq("id", submission!.id)
      }
    }

    // ── 7. Subir el archivo ──────────────────────────────────────────────
    const base64Data = btoa(String.fromCharCode(...bytes))
    const uploadRes = await callAppsScript("subirArchivoMaterial", {
      folderId: driveFolderId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      base64Data,
    }, 28_000)

    if (!uploadRes.success || !uploadRes.fileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: uploadRes.error || "No se pudo subir el archivo a Drive." }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, fileUrl: uploadRes.fileUrl }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout
      ? "Timeout al subir tu entrega."
      : err instanceof Error ? err.message : "Error interno."
    console.error("[SUBMIT_ASSIGNMENT_FILE]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: isTimeout ? 504 : 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
