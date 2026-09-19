// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * activate-scheduled-exams
 * Job de relay y mantenimiento automático de evaluaciones:
 * 1. T - 10 min: Envía correo institucional previo con la liga oficial a los alumnos.
 * 2. T = 0 (start_at): Pasa examen de "draft" a "published" y abre el Google Form en Drive.
 * 3. T = fin (end_at): Pasa examen de "published" a "closed" y cierra el Google Form en Drive.
 *
 * Puede ser invocado por pg_cron (vía service_role) o por un docente autenticado (para pruebas).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildCorsHeaders, verifyDocente } from "../_shared/auth.ts"

const BATCH_LIMIT = 100

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim()

  let isServiceRole = Boolean(serviceRoleKey && token === serviceRoleKey)
  if (!isServiceRole && token.includes(".")) {
    try {
      const parts = token.split(".")
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        if (payload.role === "service_role") {
          isServiceRole = true
        }
      }
    } catch {}
  }

  let docenteUserId: string | null = null
  let serviceClient: any

  if (isServiceRole) {
    serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey)
  } else {
    const auth = await verifyDocente(req)
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "No autorizado. Se requiere cuenta docente o token de sistema." }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }
    docenteUserId = auth.ctx.userId
    serviceClient = auth.ctx.serviceClient
  }

  const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
  const WEBHOOK_SECRET = Deno.env.get("APPS_SCRIPT_SECRET")
  const now = new Date()
  const nowIso = now.toISOString()
  // Ventana de aviso: 5 minutos antes (para que el correo llegue a las 9:00 AM si el examen inicia a las 9:05 AM)
  const notificationWindowIso = new Date(now.getTime() + 5 * 60 * 1000).toISOString()
  const oneHourFromNowIso = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

  let testExamId: string | null = null
  let forceAction: string | null = null

  if (req.method === "POST") {
    try {
      const body = await req.json()
      testExamId = body.testExamId ?? null
      forceAction = body.forceAction ?? null // "notify" | "open" | "close" | "full_test"
    } catch {}
  }

  const results = {
    formsCreated: 0,
    notifiedExams: 0,
    emailsSent: 0,
    openedExams: 0,
    closedExams: 0,
    details: [] as string[],
  }

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // FASE 0: PRE-CREACIÓN AUTOMÁTICA DE GOOGLE FORMS (1 HORA ANTES O MENOS)
    // Si un examen usa Google Forms y aún no tiene form_id, se pre-crea en Drive
    // en estado cerrado para que esté listo sin importar con cuántos minutos
    // de anticipación lo programó o guardó el docente.
    // ══════════════════════════════════════════════════════════════════════════
    let preCreateQuery = serviceClient
      .from("exams")
      .select("id, title, start_at, end_at, course_id, unit_id, deployment_method, google_form_id, course_units(title, courses(id, title, teacher_id))")
      .eq("deployment_method", "google_forms")
      .is("google_form_id", null)
      .in("status", ["draft", "published"])
      .not("start_at", "is", null)

    if (testExamId) {
      preCreateQuery = preCreateQuery.eq("id", testExamId)
    } else {
      preCreateQuery = preCreateQuery
        .lte("start_at", oneHourFromNowIso)
        .gt("end_at", nowIso)
        .limit(BATCH_LIMIT)
    }

    const { data: examsNeedingForm } = await preCreateQuery
    if (examsNeedingForm && examsNeedingForm.length > 0) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
      for (const ex of examsNeedingForm) {
        if (docenteUserId && ex.course_units?.courses?.teacher_id && ex.course_units.courses.teacher_id !== docenteUserId) {
          continue
        }
        try {
          const pubRes = await fetch(`${SUPABASE_URL}/functions/v1/publish-exam-form`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ examId: ex.id }),
          })
          const pubJson = await pubRes.json()
          if (pubJson?.success) {
            results.formsCreated++
            results.details.push(`Google Form pre-creado en Drive para "${ex.title}".`)
          }
        } catch (cErr) {
          console.error("[RELAY] Error pre-creando formulario:", cErr)
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FASE 1: NOTIFICACIÓN ANTICIPADA (10 MINUTOS ANTES DE INICIAR O INMEDIATA)
    // ══════════════════════════════════════════════════════════════════════════
    let notifyQuery = serviceClient
      .from("exams")
      .select("id, title, start_at, end_at, course_id, unit_id, deployment_method, google_form_url, google_form_id, start_notified_at, course_units(title, courses(id, title, teacher_id))")

    if (testExamId) {
      if (forceAction === "notify" || forceAction === "full_test") {
        notifyQuery = notifyQuery.eq("id", testExamId)
      } else if (!forceAction) {
        notifyQuery = notifyQuery
          .eq("id", testExamId)
          .is("start_notified_at", null)
          .in("status", ["draft", "published"])
          .lte("start_at", notificationWindowIso)
          .gt("end_at", nowIso)
      } else {
        notifyQuery = notifyQuery.eq("id", "00000000-0000-0000-0000-000000000000")
      }
    } else {
      notifyQuery = notifyQuery
        .not("start_at", "is", null)
        .is("start_notified_at", null)
        .in("status", ["draft", "published"])
        .lte("start_at", notificationWindowIso)
        .gt("end_at", nowIso)
        .limit(BATCH_LIMIT)
    }

    const { data: examsToNotify, error: errNotify } = await notifyQuery
    if (errNotify) console.error("[RELAY] Error buscando exámenes a notificar:", errNotify)

    if (examsToNotify && examsToNotify.length > 0) {
      for (const ex of examsToNotify) {
        const course = (ex as any).course_units?.courses
        const effectiveCourseId = ex.course_id || course?.id
        const courseTitle = course?.title || "Materia"

        // Si es docente invocando test, validar que el curso sea de su propiedad
        if (docenteUserId && course?.teacher_id && course.teacher_id !== docenteUserId) {
          continue
        }

        // Obtener correos de alumnos (respetando si hay audiencia restringida)
        let studentEmails: string[] = []
        const { data: audience } = await serviceClient
          .from("exam_students")
          .select("students(correo, nombres, apellido_paterno)")
          .eq("exam_id", ex.id)

        if (audience && audience.length > 0) {
          studentEmails = audience
            .map((a: any) => a.students?.correo)
            .filter((email: string | undefined): email is string => Boolean(email && email.includes("@")))
        } else if (effectiveCourseId) {
          const { data: allStudents } = await serviceClient
            .from("students")
            .select("correo")
            .eq("course_id", effectiveCourseId)
          if (allStudents) {
            studentEmails = allStudents
              .map((s: any) => s.correo)
              .filter((email: string | undefined): email is string => Boolean(email && email.includes("@")))
          }
        }

        if (studentEmails.length > 0 && APPS_SCRIPT_URL) {
          const startTimeStr = ex.start_at
            ? new Date(ex.start_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })
            : "07:05"
          const endTimeStr = ex.end_at
            ? new Date(ex.end_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })
            : "08:05"
          const formUrl = ex.google_form_url || `https://eui-reaserch-plataform.vercel.app/panel/materias/${effectiveCourseId}/evaluaciones/${ex.id}`

          try {
            const emailRes = await fetch(APPS_SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                secret: WEBHOOK_SECRET,
                action: "enviarCorreoAvisoExamen",
                payload: {
                  emails: studentEmails,
                  title: ex.title,
                  courseTitle: courseTitle,
                  startTimeStr: startTimeStr,
                  endTimeStr: endTimeStr,
                  formUrl: formUrl,
                },
              }),
            })
            const emailJson = await emailRes.json()
            if (emailJson.success) {
              results.emailsSent += studentEmails.length
              results.details.push(`Aviso enviado a ${studentEmails.length} alumnos para "${ex.title}".`)
            }
          } catch (mailErr) {
            console.error("[RELAY] Error enviando correo:", mailErr)
          }
        }

        // Marcar start_notified_at
        await serviceClient
          .from("exams")
          .update({ start_notified_at: nowIso })
          .eq("id", ex.id)

        results.notifiedExams++
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FASE 2: APERTURA AUTOMÁTICA EN HORA DE INICIO (start_at <= now)
    // ══════════════════════════════════════════════════════════════════════════
    let openQuery = serviceClient
      .from("exams")
      .select("id, title, google_form_id, deployment_method, status, course_units(courses(teacher_id))")

    if (testExamId) {
      if (forceAction === "open" || forceAction === "full_test") {
        openQuery = openQuery.eq("id", testExamId)
      } else if (!forceAction) {
        openQuery = openQuery
          .eq("id", testExamId)
          .eq("status", "draft")
          .not("start_at", "is", null)
          .lte("start_at", nowIso)
          .or(`end_at.is.null,end_at.gt.${nowIso}`)
      } else {
        openQuery = openQuery.eq("id", "00000000-0000-0000-0000-000000000000")
      }
    } else {
      openQuery = openQuery
        .eq("status", "draft")
        .not("start_at", "is", null)
        .lte("start_at", nowIso)
        .or(`end_at.is.null,end_at.gt.${nowIso}`)
        .limit(BATCH_LIMIT)
    }

    const { data: examsToOpen, error: errOpen } = await openQuery
    if (errOpen) console.error("[RELAY] Error buscando exámenes a abrir:", errOpen)

    if (examsToOpen && examsToOpen.length > 0) {
      for (const ex of examsToOpen) {
        // Actualizar estado en base de datos
        await serviceClient
          .from("exams")
          .update({ status: "published" })
          .eq("id", ex.id)

        // Si usa Google Forms, abrir el formulario en Google Drive
        if (ex.google_form_id && APPS_SCRIPT_URL) {
          try {
            await fetch(APPS_SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                secret: WEBHOOK_SECRET,
                action: "abrirFormularioGoogle",
                payload: { formId: ex.google_form_id },
              }),
            })
            results.details.push(`Google Form ${ex.google_form_id} abierto exitosamente.`)
          } catch (openErr) {
            console.error("[RELAY] Error abriendo Google Form:", openErr)
          }
        }

        results.openedExams++
        results.details.push(`Examen "${ex.title}" publicado.`)
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FASE 3: CIERRE AUTOMÁTICO EN HORA DE FIN (end_at <= now)
    // ══════════════════════════════════════════════════════════════════════════
    let closeQuery = serviceClient
      .from("exams")
      .select("id, title, google_form_id, deployment_method, status, course_units(courses(teacher_id))")

    if (testExamId) {
      if (forceAction === "close" || forceAction === "full_test") {
        closeQuery = closeQuery.eq("id", testExamId)
      } else if (!forceAction) {
        closeQuery = closeQuery
          .eq("id", testExamId)
          .eq("status", "published")
          .not("end_at", "is", null)
          .lte("end_at", nowIso)
      } else {
        closeQuery = closeQuery.eq("id", "00000000-0000-0000-0000-000000000000")
      }
    } else {
      closeQuery = closeQuery
        .eq("status", "published")
        .not("end_at", "is", null)
        .lte("end_at", nowIso)
        .limit(BATCH_LIMIT)
    }

    const { data: examsToClose, error: errClose } = await closeQuery
    if (errClose) console.error("[RELAY] Error buscando exámenes a cerrar:", errClose)

    if (examsToClose && examsToClose.length > 0) {
      for (const ex of examsToClose) {
        // Actualizar estado en base de datos
        await serviceClient
          .from("exams")
          .update({ status: "closed" })
          .eq("id", ex.id)

        // Si usa Google Forms, cerrar el formulario en Google Drive
        if (ex.google_form_id && APPS_SCRIPT_URL) {
          try {
            await fetch(APPS_SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                secret: WEBHOOK_SECRET,
                action: "cerrarFormularioGoogle",
                payload: { formId: ex.google_form_id },
              }),
            })
            results.details.push(`Google Form ${ex.google_form_id} cerrado exitosamente.`)
          } catch (closeErr) {
            console.error("[RELAY] Error cerrando Google Form:", closeErr)
          }
        }

        results.closedExams++
        results.details.push(`Examen "${ex.title}" cerrado.`)
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno en relay."
    console.error("[ACTIVATE_SCHEDULED_EXAMS]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
