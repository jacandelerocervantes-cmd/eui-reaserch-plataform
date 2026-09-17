// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * retry-pending-deliveries
 * Job de mantenimiento — NO lo invoca un docente, lo dispara un cron de
 * Supabase (pg_cron) cada 2 horas. Busca actividades cuya carpeta/archivo/
 * correo no se haya podido crear o enviar (por límite de Apps Script:
 * 30 ejecuciones simultáneas, o cuota diaria de correo) y lo reintenta.
 * Idempotente: solo toca filas con drive_folder_id nulo o email_sent=false.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildCorsHeaders } from "../_shared/auth.ts"

// Secuencial — mismo motivo que en create-assignment-hub: varias ejecuciones
// de Apps Script tocando Drive a la vez podían dejar el archivo fuera de su
// carpeta. Este job ya corre solo en segundo plano (cron), tardar más no afecta a nadie.
const APPS_SCRIPT_CONCURRENCY = 1

async function runThrottled<T>(items: T[], fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += APPS_SCRIPT_CONCURRENCY) {
    const chunk = items.slice(i, i + APPS_SCRIPT_CONCURRENCY)
    await Promise.all(chunk.map(fn))
    if (i + APPS_SCRIPT_CONCURRENCY < items.length) await new Promise((r) => setTimeout(r, 300))
  }
}

// El archivo de Docs/Sheets/Slides siempre trae el ID en /d/{ID}/ en su URL.
function extractDriveFileId(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/\/d\/([^/]+)/)
  return match ? match[1] : null
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth: cron (service role key) o trigger interno seguro ─────────────
  const authHeader = req.headers.get("Authorization") ?? ""
  const triggerSecret = req.headers.get("X-Trigger-Secret") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const isAuthorized = (authHeader === `Bearer ${serviceRoleKey}`) || (triggerSecret === "eui-sync-drive-2026")
  if (!isAuthorized) {
    return new Response(
      JSON.stringify({ success: false, error: "No autorizado: este endpoint es solo para el job de mantenimiento." }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey)

  const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
  const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")

  const callAppsScript = async (action: string, scriptPayload: Record<string, unknown>, timeoutMs: number) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(APPS_SCRIPT_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: WEBHOOK_SECRET, action, payload: scriptPayload }),
        signal: controller.signal,
      })
      const json = await res.json()
      // Router.gs envuelve todo éxito como {success:true, data:<resultado real>}.
      // Sin este unwrap, result.drive_folder_id/result.fileUrl venían undefined.
      if (!json.success) return { success: false, error: json.error }
      return json.data ?? {}
    } finally {
      clearTimeout(timeout)
    }
  }

  try {
    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurado.")

    let retriedFolders = 0
    let retriedEmails = 0
    let retriedInfoDocs = 0

    // ── 1a. Carpeta CONTENEDORA de la actividad — pendiente si el primer
    // intento (en create-assignment-hub) falló y nunca se guardó drive_folder_id
    // en `assignments`. Sin esto el doc informativo nunca tiene dónde vivir.
    const { data: pendingContainers } = await serviceClient
      .from("assignments")
      .select(`
        id, title, description, rubric_data, drive_folder_id,
        course_units(unit_number, title, courses(drive_folder_id))
      `)
      .is("drive_folder_id", null)
      .limit(50)

    await runThrottled(pendingContainers || [], async (a: any) => {
      const unit = a.course_units
      const course = unit?.courses
      if (!course?.drive_folder_id) return
      try {
        const result = await callAppsScript("crearCarpetaActividad", {
          courseFolderId: course.drive_folder_id, unitNumber: unit.unit_number ?? 1,
          unitTitle: unit.title ?? "", activityTitle: a.title,
        }, 20_000)
        if (!result.success) return
        const folderId = result.activity_folder_id ?? result.drive_folder_id
        retriedFolders++
        await serviceClient.from("assignments").update({ drive_folder_id: folderId }).eq("id", a.id)

        const docResult = await callAppsScript("crearDocInformativoActividad", {
          folderId, title: a.title, description: a.description, rubric: a.rubric_data,
        }, 20_000)
        if (docResult.success) {
          retriedInfoDocs++
          await serviceClient.from("assignments").update({ info_doc_synced: true }).eq("id", a.id)
        }
      } catch (_) { /* se reintenta en el próximo ciclo */ }
    })

    // ── 1b. Doc informativo de la actividad (título+instrucciones+rúbrica en
    // la carpeta raíz) — pendiente si ya hay carpeta pero el doc nunca se
    // confirmó creado (falló la primera vez por cuota, timeout, etc.).
    const { data: pendingInfoDocs } = await serviceClient
      .from("assignments")
      .select("id, title, description, rubric_data, drive_folder_id")
      .not("drive_folder_id", "is", null)
      .eq("info_doc_synced", false)
      .limit(50)

    await runThrottled(pendingInfoDocs || [], async (a: any) => {
      try {
        const result = await callAppsScript("crearDocInformativoActividad", {
          folderId: a.drive_folder_id, title: a.title, description: a.description, rubric: a.rubric_data,
        }, 20_000)
        if (result.success) {
          retriedInfoDocs++
          await serviceClient.from("assignments").update({ info_doc_synced: true }).eq("id", a.id)
        }
      } catch (_) { /* se reintenta en el próximo ciclo */ }
    })

    // Prioridad 1: Carpetas faltantes en Drive (sin carpeta no hay entrega)
    let { data: pendingStudents } = await serviceClient
      .from("submissions")
      .select(`
        id, drive_folder_id, content_url, email_sent,
        students(matricula, nombres, apellido_paterno, correo),
        assignments(id, title, description, submission_type,
          course_units(unit_number, title,
            courses(drive_folder_id)
          )
        )
      `)
      .is("team_id", null)
      .eq("status", "draft")
      .is("drive_folder_id", null)
      .limit(50)

    // Prioridad 2: Si todas las carpetas ya existen, procesar correos pendientes
    if (!pendingStudents || pendingStudents.length === 0) {
      const { data: pendingEmails } = await serviceClient
        .from("submissions")
        .select(`
          id, drive_folder_id, content_url, email_sent,
          students(matricula, nombres, apellido_paterno, correo),
          assignments(id, title, description, submission_type,
            course_units(unit_number, title,
              courses(drive_folder_id)
            )
          )
        `)
        .is("team_id", null)
        .eq("status", "draft")
        .eq("email_sent", false)
        .limit(50)
      pendingStudents = pendingEmails ?? []
    }

    await runThrottled(pendingStudents || [], async (row: any) => {
      const a = row.assignments
      const unit = a?.course_units
      const course = unit?.courses
      const student = row.students
      if (!a || !unit || !course || !student) return

      const isWorkspace = ['doc', 'sheet', 'slide'].includes(a.submission_type)
      let folderId = row.drive_folder_id
      let workspaceUrl = row.content_url

      let folderJustResolved = false
      if (!folderId && course.drive_folder_id) {
        try {
          const result = await callAppsScript("crearCarpetaActividad", {
            courseFolderId: course.drive_folder_id,
            unitNumber:     unit.unit_number ?? 1,
            unitTitle:      unit.title ?? "",
            activityTitle:  a.title,
            teamName:       `${student.matricula} - ${student.apellido_paterno} ${student.nombres}`,
          }, 20_000)
          if (result.success) { folderId = result.drive_folder_id; retriedFolders++; folderJustResolved = true }
        } catch (_) { /* se reintenta en el próximo ciclo */ }
      }

      if (folderJustResolved && workspaceUrl && isWorkspace) {
        // El archivo ya existía de un ciclo anterior (quedó huérfano porque
        // su carpeta no existía todavía) y la carpeta se acaba de resolver
        // ahora — hay que MOVERLO, no crear uno nuevo.
        const fileId = extractDriveFileId(workspaceUrl)
        if (fileId) {
          try { await callAppsScript("moverArchivoACarpeta", { fileId, folderId }, 15_000) } catch (_) { /* se reintenta en el próximo ciclo */ }
        }
      } else if (!workspaceUrl && isWorkspace && folderId) {
        try {
          const result = await callAppsScript("crearEntornoWorkspace", {
            title:        `${a.title} - ${student.apellido_paterno} ${student.nombres}`,
            documentType: a.submission_type,
            emails:       student.correo ? [student.correo] : [],
            folderId:     folderId,
          }, 28_000)
          if (result.success) workspaceUrl = result.fileUrl ?? null
        } catch (_) { /* se reintenta en el próximo ciclo */ }
      }

      // No notificar a medias: si es workspace y el archivo todavía no se
      // pudo crear (ej. la carpeta se acaba de resolver apenas en este
      // ciclo), se espera al próximo ciclo para mandar el correo completo.
      const resourcesReady = !!folderId && (!isWorkspace || !!workspaceUrl)

      let emailSent = row.email_sent
      if (!emailSent && student.correo && resourcesReady) {
        try {
          const result = await callAppsScript("enviarCorreoActividad", {
            emails:    [student.correo],
            title:     a.title,
            description: a.description,
            fileUrl:   workspaceUrl,
            folderUrl: folderId ? `https://drive.google.com/drive/folders/${folderId}` : null,
          }, 20_000)
          emailSent = !!result.success
          if (emailSent) retriedEmails++
        } catch (_) { /* se reintenta en el próximo ciclo */ }
      }

      await serviceClient
        .from("submissions")
        .update({ drive_folder_id: folderId, content_url: workspaceUrl, email_sent: emailSent })
        .eq("id", row.id)
    })

    // ── 3. Equipos pendientes ───────────────────────────────────────────────
    const { data: pendingTeams } = await serviceClient
      .from("assignment_teams")
      .select(`
        id, name, drive_folder_id, workspace_url, email_sent,
        assignment_team_members(students(correo)),
        assignments(id, title, description, submission_type,
          course_units(unit_number, title,
            courses(drive_folder_id)
          )
        )
      `)
      .or("drive_folder_id.is.null,email_sent.eq.false")
      .limit(50)

    await runThrottled(pendingTeams || [], async (team: any) => {
      const a = team.assignments
      const unit = a?.course_units
      const course = unit?.courses
      if (!a || !unit || !course) return

      const memberEmails = (team.assignment_team_members || [])
        .map((m: any) => m.students?.correo)
        .filter(Boolean)

      const isWorkspace = ['doc', 'sheet', 'slide'].includes(a.submission_type)
      let folderId = team.drive_folder_id
      let workspaceUrl = team.workspace_url

      let folderJustResolved = false
      if (!folderId && course.drive_folder_id) {
        try {
          const result = await callAppsScript("crearCarpetaActividad", {
            courseFolderId: course.drive_folder_id,
            unitNumber:     unit.unit_number ?? 1,
            unitTitle:      unit.title ?? "",
            activityTitle:  a.title,
            teamName:       team.name,
          }, 20_000)
          if (result.success) { folderId = result.drive_folder_id; retriedFolders++; folderJustResolved = true }
        } catch (_) { /* se reintenta en el próximo ciclo */ }
      }

      if (folderJustResolved && workspaceUrl && isWorkspace) {
        const fileId = extractDriveFileId(workspaceUrl)
        if (fileId) {
          try { await callAppsScript("moverArchivoACarpeta", { fileId, folderId }, 15_000) } catch (_) { /* se reintenta en el próximo ciclo */ }
        }
      } else if (!workspaceUrl && isWorkspace && folderId && memberEmails.length > 0) {
        try {
          const result = await callAppsScript("crearEntornoWorkspace", {
            title:        `${a.title} - ${team.name}`,
            documentType: a.submission_type,
            emails:       memberEmails,
            folderId:     folderId,
          }, 28_000)
          if (result.success) workspaceUrl = result.fileUrl ?? null
        } catch (_) { /* se reintenta en el próximo ciclo */ }
      }

      const resourcesReady = !!folderId && (!isWorkspace || !!workspaceUrl)

      let emailSent = team.email_sent
      if (!emailSent && memberEmails.length > 0 && resourcesReady) {
        try {
          const result = await callAppsScript("enviarCorreoActividad", {
            emails:    memberEmails,
            title:     `${a.title} (${team.name})`,
            description: a.description,
            fileUrl:   workspaceUrl,
            folderUrl: folderId ? `https://drive.google.com/drive/folders/${folderId}` : null,
          }, 20_000)
          emailSent = !!result.success
          if (emailSent) retriedEmails++
        } catch (_) { /* se reintenta en el próximo ciclo */ }
      } else if (memberEmails.length === 0) {
        emailSent = true
      }

      await serviceClient
        .from("assignment_teams")
        .update({ drive_folder_id: folderId, workspace_url: workspaceUrl, email_sent: emailSent })
        .eq("id", team.id)

      // Si la carpeta/archivo del equipo se acaba de resolver, propagar a las
      // filas de submissions de cada integrante (todas comparten la misma).
      if (folderId || workspaceUrl) {
        await serviceClient
          .from("submissions")
          .update({ drive_folder_id: folderId, content_url: workspaceUrl })
          .eq("team_id", team.id)
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        checked: (pendingStudents?.length ?? 0) + (pendingTeams?.length ?? 0) + (pendingInfoDocs?.length ?? 0),
        retriedFolders,
        retriedEmails,
        retriedInfoDocs,
        message: `${(pendingStudents?.length ?? 0) + (pendingTeams?.length ?? 0)} unidad(es) revisada(s): ${retriedFolders} carpeta(s) creada(s), ${retriedEmails} correo(s) enviado(s), ${retriedInfoDocs} doc(s) informativo(s) regenerado(s) en este ciclo.`,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[RETRY_PENDING_DELIVERIES]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
