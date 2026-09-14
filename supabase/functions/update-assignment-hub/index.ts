// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * update-assignment-hub
 * Guarda los cambios de una actividad existente y, en segundo plano, refresca
 * ÚNICAMENTE el doc informativo ("ℹ️ Información de la Actividad") dentro de
 * su carpeta general en Drive. No toca carpetas ni archivos de alumnos/equipos:
 * esas son entregas ya en curso y no deben regenerarse al editar.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  buildCorsHeaders, errorResponse,
  verifyCourseOwnership, verifyDocente,
} from "../_shared/auth.ts"

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    const payload = await req.json()
    const {
      assignment_id, unit_id, criteria_id, title, description,
      format, submission_type, soft_deadline, hard_deadline,
      late_penalty_percent, rubric_json, requiere_sesion_id,
    } = payload

    if (!assignment_id || !title || !soft_deadline) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan campos requeridos: assignment_id, title, soft_deadline." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const { data: current, error: fetchErr } = await serviceClient
      .from("assignments")
      .select("course_id, drive_folder_id")
      .eq("id", assignment_id)
      .single()
    if (fetchErr || !current) {
      return new Response(
        JSON.stringify({ success: false, error: "Actividad no encontrada." }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const owns = await verifyCourseOwnership(serviceClient, current.course_id, userId)
    if (!owns) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // Guardar de inmediato — el doc informativo se refresca después en segundo
    // plano y no bloquea la respuesta al docente.
    const { data: updated, error: updateErr } = await serviceClient
      .from("assignments")
      .update({
        unit_id,
        criteria_id:          criteria_id || null,
        title,
        description,
        format,
        submission_type,
        soft_deadline,
        hard_deadline:        hard_deadline || null,
        late_penalty_percent: late_penalty_percent ?? 0,
        rubric_data:          rubric_json ?? [],
        requiere_sesion_id:   requiere_sesion_id ?? null,
      })
      .eq("id", assignment_id)
      .select()
      .single()
    if (updateErr) throw updateErr

    const response = new Response(
      JSON.stringify({ success: true, data: updated }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
    const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")

    const backgroundWork = (async () => {
      try {
        if (!APPS_SCRIPT_URL || !current.drive_folder_id) return
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 20_000)
        try {
          const res = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: WEBHOOK_SECRET,
              action: "crearDocInformativoActividad",
              payload: { folderId: current.drive_folder_id, title, description, rubric: rubric_json },
            }),
            signal: controller.signal,
          })
          const json = await res.json()
          // Router.gs envuelve el éxito como {success:true, data:<resultado real>}.
          const infoDocSynced = !!json.success && !!json.data?.success
          if (!infoDocSynced) console.error("[UPDATE_ASSIGNMENT_HUB] Doc informativo falló:", json.error || json.data?.error)
          await serviceClient.from("assignments").update({ info_doc_synced: infoDocSynced }).eq("id", assignment_id)
        } finally {
          clearTimeout(timeout)
        }
      } catch (bgErr) {
        console.error("[UPDATE_ASSIGNMENT_HUB_BACKGROUND]", bgErr)
      }
    })()

    // @ts-ignore — EdgeRuntime es un global del runtime de Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined") {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundWork)
    } else {
      backgroundWork.catch(() => {})
    }

    return response

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[UPDATE_ASSIGNMENT_HUB]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
