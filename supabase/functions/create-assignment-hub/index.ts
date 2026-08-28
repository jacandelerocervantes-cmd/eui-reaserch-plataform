// deno-lint-ignore-file no-import-prefix
import {
  buildCorsHeaders, errorResponse,
  verifyCourseOwnership, verifyDocente,
} from "../_shared/auth.ts"
import { TextoDemasiadoCortoError, encode as encodeWatermark } from "../_shared/watermark.ts"

// Redundancia baja (1 copia, no las 6 por defecto) — con 6 copias el mínimo
// de palabras exigido por la matemática de capacidad del algoritmo (ver
// _shared/watermark.ts) ronda las 500+, muy por encima de lo que mide una
// instrucción de actividad típica (unas pocas decenas de palabras). Con
// redundancy=1 y un identificador corto (8 hex del uuid, ver abajo) el
// mínimo baja a ~80 palabras — sigue siendo exigente pero alcanzable para
// una descripción detallada, sin sacrificar tanto la resistencia a edición
// parcial que da la redundancia (que de cualquier forma es secundaria acá:
// el objetivo es detectar copy-paste crudo, no sobrevivir reescrituras).
const WATERMARK_REDUNDANCY = 1

type TeamRow = { id: string; name: string; team_members: { student_id: string; students: { correo: string | null } | null }[] | null }
type StudentRow = { id: string; matricula: string; nombres: string; apellido_paterno: string; correo: string | null }
type SubmissionInsert = { assignment_id: string; student_id: string; team_id?: string; status: string; drive_folder_id: null; content_url: null; email_sent: boolean }

// Procesamiento SECUENCIAL (1 a la vez): carpeta → archivo Workspace → correo
// → recién entonces el siguiente alumno/equipo. Con varias ejecuciones de
// Apps Script tocando Drive al mismo tiempo, moveTo() podía no aplicar bien
// (el archivo se comparte pero queda fuera de su carpeta). Como esto ya corre
// en segundo plano (no bloquea la respuesta al docente), tardar más no afecta
// la experiencia — la confiabilidad importa más que la velocidad aquí.
const APPS_SCRIPT_CONCURRENCY = 1
async function runThrottled<T>(items: T[], fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += APPS_SCRIPT_CONCURRENCY) {
    const chunk = items.slice(i, i + APPS_SCRIPT_CONCURRENCY)
    await Promise.all(chunk.map(fn))
    if (i + APPS_SCRIPT_CONCURRENCY < items.length) await new Promise((r) => setTimeout(r, 300))
  }
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    const payload = await req.json()
    const {
      course_id, unit_id, criteria_id, title, description,
      format, submission_type, soft_deadline, hard_deadline,
      late_penalty_percent, rubric_json, requiere_sesion_id, team_ids,
    } = payload

    if (!course_id || !unit_id || !title || !soft_deadline) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan campos requeridos: course_id, unit_id, title, soft_deadline." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const isTeamFormat = format === "equipo" && Array.isArray(team_ids) && team_ids.length > 0
    const isWorkspace = ['doc', 'sheet', 'slide'].includes(submission_type)

    // ── 2. Verificar ownership ────────────────────────────────────────────
    const owns = await verifyCourseOwnership(serviceClient, course_id, userId)
    if (!owns) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 3. GUARDAR YA — sin esperar a Drive. La actividad queda "guardada"
    // de inmediato; las carpetas/archivos/correos se resuelven después en
    // segundo plano y, si algo falla por cuota, lo recoge el cron de retry.
    const { data: assignment, error: dbError } = await serviceClient
      .from("assignments")
      .insert([{
        course_id,
        unit_id,
        criteria_id:          criteria_id || null,
        title,
        description,
        format:               format ?? "individual",
        submission_type:      submission_type ?? "file",
        soft_deadline,
        hard_deadline:        hard_deadline ?? null,
        late_penalty_percent: late_penalty_percent ?? 0,
        rubric_data:          rubric_json ?? [],
        workspace_url:        null,
        drive_folder_id:      null,
        requiere_sesion_id:   requiere_sesion_id ?? null,
      }])
      .select()
      .single()

    if (dbError) throw dbError

    // ── 3b. Watermark invisible de integridad académica (CORRE 9) ─────────
    // Se genera DESPUÉS del insert porque el identificador corto se deriva
    // del uuid que la base de datos ya asignó a la actividad (assignment.id)
    // — así cada actividad tiene su propio identificador sin necesitar
    // generarlo ni persistirlo aparte antes de tiempo.
    //
    // Decisión de diseño: el texto watermarked se RE-GUARDA en
    // `assignments.description` (no solo se usa al armar el correo/Doc) para
    // que el watermark viaje con el texto en cualquier lugar que lo lea
    // después — incluyendo si en el futuro se agrega una vista que muestre
    // la descripción directo desde la tabla, no solo lo que arma el trabajo
    // de background de abajo. El costo es que `description` en la tabla deja
    // de ser byte-a-byte idéntico a lo que el docente escribió (lleva
    // caracteres invisibles intercalados) — aceptable porque son símbolos
    // Unicode de ancho cero, no imprimen glifo ni cambian el layout en
    // ningún visor de texto normal.
    let watermarkedDescription: string | null = null
    let watermarkIdentifier: string | null = null
    if (typeof description === "string" && description.trim().length > 0) {
      // 8 hex del uuid (sin guiones) — identificador corto y determinista
      // por actividad, sin necesitar una columna para generarlo.
      watermarkIdentifier = String(assignment.id).replace(/-/g, "").slice(0, 8)
      try {
        watermarkedDescription = encodeWatermark(description, watermarkIdentifier, WATERMARK_REDUNDANCY)
      } catch (wmErr) {
        if (wmErr instanceof TextoDemasiadoCortoError) {
          // Esperado y NO bloqueante: la instrucción es demasiado corta
          // (menos de ~80 palabras con esta redundancia/identificador) para
          // embeber el watermark completo. Se sigue con el texto original,
          // sin watermark — el docente nunca debe verse bloqueado por esto.
          console.warn(
            "[CREATE_ASSIGNMENT_HUB] Actividad sin watermark (texto demasiado corto):",
            assignment.id, wmErr.message
          )
        } else {
          console.error("[CREATE_ASSIGNMENT_HUB] Error inesperado al generar watermark:", wmErr)
        }
      }
    }

    if (watermarkedDescription) {
      const { error: descUpdateError } = await serviceClient
        .from("assignments")
        .update({ description: watermarkedDescription })
        .eq("id", assignment.id)
      if (descUpdateError) {
        console.error("[CREATE_ASSIGNMENT_HUB] No se pudo guardar la descripción con watermark:", descUpdateError)
        watermarkedDescription = null // no se persistió: no lo uses tampoco para el envío
      } else {
        assignment.description = watermarkedDescription
      }
    }

    if (watermarkedDescription && watermarkIdentifier) {
      // Columna nueva pendiente de migración (ver
      // supabase/pendiente/013_assignments_watermark_identifier.sql) — en un
      // try/catch aparte para que, si esa migración todavía no corrió en
      // esta base, no tumbe el guardado de la descripción watermarked de
      // arriba (que no depende de esta columna).
      try {
        const { error: idUpdateError } = await serviceClient
          .from("assignments")
          .update({ watermark_identifier: watermarkIdentifier })
          .eq("id", assignment.id)
        if (idUpdateError) {
          console.warn(
            "[CREATE_ASSIGNMENT_HUB] No se pudo guardar watermark_identifier (¿migración 013 pendiente?):",
            idUpdateError.message
          )
        }
      } catch (_) { /* columna no existe todavía en esta base */ }
    }

    // Texto que efectivamente viaja a Drive/correo: watermarked si se pudo
    // generar y persistir, si no el original tal cual lo escribió el docente.
    const descriptionForDelivery = watermarkedDescription ?? description

    // ── 4. Pre-crear las filas de submissions/equipos YA, todas "pendientes"
    // (drive_folder_id null, email_sent false) — exactamente el estado que
    // retry-pending-deliveries ya sabe detectar y resolver más tarde.
    let teamsData: TeamRow[] | null = null
    let studentsData: StudentRow[] | null = null

    if (isTeamFormat) {
      const { data } = await serviceClient
        .from("teams")
        .select("id, name, team_members(student_id, students(correo))")
        .in("id", team_ids)
      // Mismo motivo que en evaluate-submissions-ia: sin un Database generic
      // tipado, supabase-js infiere las relaciones embebidas (students) como
      // arreglo aunque en runtime sea objeto único para una FK a-uno — cast
      // vía `unknown` porque el compilador señala que los tipos no solapan
      // lo suficiente para un cast directo (TS2352).
      teamsData = (data ?? []) as unknown as TeamRow[]

      const { data: insertedTeams, error: teamsErr } = await serviceClient
        .from("assignment_teams")
        .insert(teamsData.map(t => ({ assignment_id: assignment.id, name: t.name, drive_folder_id: null, workspace_url: null, email_sent: false })))
        .select("id, name")
      if (teamsErr) throw teamsErr

      const memberRows: { team_id: string; student_id: string }[] = []
      const submissionRows: SubmissionInsert[] = []
      for (const inserted of insertedTeams || []) {
        const original = teamsData.find(t => t.name === inserted.name)
        if (!original) continue
        for (const tm of (original.team_members || [])) {
          memberRows.push({ team_id: inserted.id, student_id: tm.student_id })
          submissionRows.push({
            assignment_id: assignment.id, student_id: tm.student_id, team_id: inserted.id,
            status: "draft", drive_folder_id: null, content_url: null, email_sent: false,
          })
        }
      }
      if (memberRows.length > 0) {
        const { error } = await serviceClient.from("assignment_team_members").insert(memberRows)
        if (error) throw error
      }
      if (submissionRows.length > 0) {
        const { error } = await serviceClient.from("submissions").insert(submissionRows)
        if (error) throw error
      }
    } else {
      const { data } = await serviceClient
        .from("students")
        .select("id, matricula, nombres, apellido_paterno, correo")
        .eq("course_id", course_id)
      studentsData = data ?? []

      if (studentsData.length > 0) {
        const { error } = await serviceClient
          .from("submissions")
          .insert(studentsData.map(s => ({
            assignment_id: assignment.id, student_id: s.id,
            status: "draft", drive_folder_id: null, content_url: null, email_sent: false,
          })))
        if (error) throw error
      }
    }

    // ── 5. Drive: Crear Carpeta de la Actividad y Documento Informativo ────
    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
    const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")

    const callAppsScript = async (action: string, scriptPayload: Record<string, unknown>, timeoutMs = 20_000) => {
      if (!APPS_SCRIPT_URL) return { success: false, error: "APPS_SCRIPT_URL no configurado." }
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
        return json.data ?? {}
      } catch (err) {
        console.error(`[CREATE_ASSIGNMENT_HUB] Error en ${action}:`, err)
        return { success: false, error: String(err) }
      } finally {
        clearTimeout(timeout)
      }
    }

    const { data: course } = await serviceClient.from("courses").select("drive_folder_id").eq("id", course_id).single()
    const { data: unit } = await serviceClient.from("course_units").select("unit_number, title").eq("id", unit_id).single()

    let activityFolderId: string | null = null
    if (course?.drive_folder_id) {
      try {
        const r = await callAppsScript("crearCarpetaActividad", {
          courseFolderId: course.drive_folder_id,
          unitNumber: unit?.unit_number ?? 1,
          unitTitle: unit?.title ?? "",
          activityTitle: title,
        }, 20_000)

        if (r.success) {
          activityFolderId = r.activity_folder_id ?? r.drive_folder_id
          await serviceClient.from("assignments").update({ drive_folder_id: activityFolderId }).eq("id", assignment.id)

          try {
            const docResult = await callAppsScript("crearDocInformativoActividad", {
              folderId: activityFolderId,
              title,
              description: descriptionForDelivery,
              rubric: rubric_json,
            }, 20_000)
            await serviceClient.from("assignments").update({ info_doc_synced: !!docResult.success }).eq("id", assignment.id)
          } catch (docErr) {
            console.error("[CREATE_ASSIGNMENT_HUB] Doc informativo lanzó excepción:", docErr)
          }
        }
      } catch (e) {
        console.error("[CREATE_ASSIGNMENT_HUB] Error creando carpeta actividad:", e)
      }
    }

    // ── 6. Responder YA al docente — la actividad y su carpeta Drive están listas
    const response = new Response(
      JSON.stringify({ success: true, data: { ...assignment, drive_folder_id: activityFolderId } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

    const backgroundWork = (async () => {
      try {
        if (!APPS_SCRIPT_URL) return

        if (isTeamFormat && teamsData) {
          await runThrottled(teamsData, async (team) => {
            const memberEmails = (team.team_members || []).map((tm) => tm.students?.correo).filter(Boolean)

            let teamFolderId: string | null = null
            if (course?.drive_folder_id) {
              try {
                const r = await callAppsScript("crearCarpetaActividad", {
                  courseFolderId: course.drive_folder_id, unitNumber: unit?.unit_number ?? 1,
                  unitTitle: unit?.title ?? "", activityTitle: title, teamName: team.name,
                }, 20_000)
                if (r.success) teamFolderId = r.drive_folder_id
              } catch (_) { /* lo recoge el retry */ }
            }

            let teamWorkspaceUrl: string | null = null
            if (isWorkspace && teamFolderId) {
              // Solo se crea el archivo si ya hay carpeta destino — si no,
              // queda huérfano en la raíz y nada lo mueve después.
              try {
                const r = await callAppsScript("crearEntornoWorkspace", {
                  title: `${title} - ${team.name}`, documentType: submission_type,
                  emails: memberEmails, folderId: teamFolderId,
                }, 28_000)
                if (r.success) teamWorkspaceUrl = r.fileUrl ?? null
              } catch (_) { /* lo recoge el retry */ }
            }

            // Notificar solo cuando el equipo ya tiene lo que le corresponde:
            // carpeta siempre, y si es workspace también su archivo. Si falta
            // algo, el retry manda el correo completo en el próximo ciclo.
            const resourcesReady = !!teamFolderId && (!isWorkspace || !!teamWorkspaceUrl)

            let emailSent = memberEmails.length === 0
            if (memberEmails.length > 0 && resourcesReady) {
              try {
                const r = await callAppsScript("enviarCorreoActividad", {
                  emails: memberEmails, title: `${title} (${team.name})`, description: descriptionForDelivery, rubric: rubric_json,
                  fileUrl: teamWorkspaceUrl, folderUrl: teamFolderId ? `https://drive.google.com/drive/folders/${teamFolderId}` : null,
                  deadline: soft_deadline,
                }, 20_000)
                emailSent = !!r.success
              } catch (_) { /* lo recoge el retry */ }
            }

            await serviceClient.from("assignment_teams")
              .update({ drive_folder_id: teamFolderId, workspace_url: teamWorkspaceUrl, email_sent: emailSent })
              .eq("assignment_id", assignment.id).eq("name", team.name)
            if (teamFolderId || teamWorkspaceUrl) {
              await serviceClient.from("submissions")
                .update({ drive_folder_id: teamFolderId, content_url: teamWorkspaceUrl })
                .eq("assignment_id", assignment.id)
                .in("student_id", (team.team_members || []).map((tm) => tm.student_id))
            }
          })
        } else if (studentsData) {
          await runThrottled(studentsData, async (student) => {
            const studentLabel = `${student.matricula} - ${student.apellido_paterno} ${student.nombres}`

            let studentFolderId: string | null = null
            if (course?.drive_folder_id) {
              try {
                const r = await callAppsScript("crearCarpetaActividad", {
                  courseFolderId: course.drive_folder_id, unitNumber: unit?.unit_number ?? 1,
                  unitTitle: unit?.title ?? "", activityTitle: title, teamName: studentLabel,
                }, 20_000)
                if (r.success) studentFolderId = r.drive_folder_id
              } catch (_) { /* lo recoge el retry */ }
            }

            let studentWorkspaceUrl: string | null = null
            if (isWorkspace && studentFolderId) {
              // El archivo se crea siempre que sea Workspace Y ya exista su
              // carpeta — el correo (no la creación) decide si además se
              // comparte. Si la carpeta no existe todavía, NO se crea el
              // archivo: quedaría huérfano en la raíz y nada lo movería
              // después; mejor esperar al retry y crear ambos juntos.
              try {
                const r = await callAppsScript("crearEntornoWorkspace", {
                  title: `${title} - ${student.apellido_paterno} ${student.nombres}`, documentType: submission_type,
                  emails: student.correo ? [student.correo] : [], folderId: studentFolderId,
                }, 28_000)
                if (r.success) studentWorkspaceUrl = r.fileUrl ?? null
              } catch (_) { /* lo recoge el retry */ }
            }

            // Notificar solo cuando el alumno ya tiene lo que le corresponde:
            // carpeta siempre, y si es workspace también su archivo.
            const resourcesReady = !!studentFolderId && (!isWorkspace || !!studentWorkspaceUrl)

            let emailSent = !student.correo
            if (student.correo && resourcesReady) {
              try {
                const r = await callAppsScript("enviarCorreoActividad", {
                  emails: [student.correo], title, description: descriptionForDelivery, rubric: rubric_json,
                  fileUrl: studentWorkspaceUrl, folderUrl: studentFolderId ? `https://drive.google.com/drive/folders/${studentFolderId}` : null,
                  deadline: soft_deadline,
                }, 20_000)
                emailSent = !!r.success
              } catch (_) { /* lo recoge el retry */ }
            }

            await serviceClient.from("submissions")
              .update({ drive_folder_id: studentFolderId, content_url: studentWorkspaceUrl, email_sent: emailSent })
              .eq("assignment_id", assignment.id).eq("student_id", student.id)
          })
        }
      } catch (bgErr) {
        // Cualquier falla aquí queda registrada en logs — las filas siguen
        // pendientes y el cron de retry-pending-deliveries las recoge solo.
        console.error("[CREATE_ASSIGNMENT_HUB_BACKGROUND]", bgErr)
      }
    })()

    // @ts-expect-error — EdgeRuntime es un global del runtime de Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined") {
      // @ts-expect-error — mismo motivo que arriba
      EdgeRuntime.waitUntil(backgroundWork)
    } else {
      // Fallback local (no debería darse en producción): no bloquea la respuesta.
      backgroundWork.catch(() => {})
    }

    return response

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout
      ? "Timeout al crear la actividad."
      : err instanceof Error ? err.message : "Error interno."
    console.error("[CREATE_ASSIGNMENT_HUB]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: isTimeout ? 504 : 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
