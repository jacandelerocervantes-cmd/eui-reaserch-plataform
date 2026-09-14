// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * enforce-assignment-deadlines
 * Job de mantenimiento — lo dispara un cron de Supabase (pg_cron), no un
 * docente. Una vez que pasa la fecha límite de una actividad (hard_deadline,
 * o soft_deadline si no hay hard_deadline), revoca el acceso de edición de
 * los archivos Workspace de alumnos/equipos para que ya no se puedan seguir
 * haciendo cambios. No usa IA — solo permisos de Drive, así que no hay
 * riesgo de cuota/tiempo por volumen de alumnos; aun así se limita el lote
 * por corrida para mantener cada ejecución corta y predecible.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildCorsHeaders } from "../_shared/auth.ts"

const BATCH_LIMIT = 100

function extractDriveFileId(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/\/d\/([^/]+)/)
  return match ? match[1] : null
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const authHeader = req.headers.get("Authorization") ?? ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(
      JSON.stringify({ success: false, error: "No autorizado: este endpoint es solo para el job de mantenimiento." }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey)
  const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
  const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")

  const callAppsScript = async (action: string, payload: any, timeoutMs: number) => {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(APPS_SCRIPT_URL!, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: WEBHOOK_SECRET, action, payload }),
        signal: controller.signal,
      })
      const json = await res.json()
      return json.success ? (json.data ?? {}) : { success: false, error: json.error }
    } finally { clearTimeout(t) }
  }

  try {
    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurado.")

    const nowIso = new Date().toISOString()
    let locked = 0

    // Actividades cuya fecha límite ya pasó (hard_deadline si existe, si no soft_deadline).
    const { data: dueAssignments } = await serviceClient
      .from("assignments")
      .select("id")
      .or(`hard_deadline.lt.${nowIso},and(hard_deadline.is.null,soft_deadline.lt.${nowIso})`)
      .limit(200)

    const assignmentIds = (dueAssignments ?? []).map((a: any) => a.id)
    if (assignmentIds.length === 0) {
      return new Response(JSON.stringify({ success: true, locked: 0, message: "Sin actividades vencidas pendientes de bloquear." }), { headers: { ...cors, "Content-Type": "application/json" } })
    }

    // Individuales (sin team_id) con archivo Workspace y aún sin bloquear.
    const { data: pendingSubs } = await serviceClient
      .from("submissions")
      .select("id, content_url")
      .in("assignment_id", assignmentIds)
      .is("team_id", null)
      .eq("access_locked", false)
      .not("content_url", "is", null)
      .limit(BATCH_LIMIT)

    for (const sub of pendingSubs ?? []) {
      const fileId = extractDriveFileId((sub as any).content_url)
      if (fileId) {
        try { await callAppsScript("revocarAccesoArchivo", { fileId }, 15_000) } catch (_) { /* se reintenta en el próximo ciclo */ }
      }
      await serviceClient.from("submissions").update({ access_locked: true }).eq("id", (sub as any).id)
      locked++
    }

    // Equipos con archivo Workspace y aún sin bloquear.
    const { data: pendingTeams } = await serviceClient
      .from("assignment_teams")
      .select("id, workspace_url")
      .in("assignment_id", assignmentIds)
      .eq("access_locked", false)
      .not("workspace_url", "is", null)
      .limit(BATCH_LIMIT)

    for (const team of pendingTeams ?? []) {
      const fileId = extractDriveFileId((team as any).workspace_url)
      if (fileId) {
        try { await callAppsScript("revocarAccesoArchivo", { fileId }, 15_000) } catch (_) { /* se reintenta en el próximo ciclo */ }
      }
      await serviceClient.from("assignment_teams").update({ access_locked: true }).eq("id", (team as any).id)
      locked++
    }

    return new Response(
      JSON.stringify({ success: true, locked, message: `${locked} archivo(s) bloqueado(s) en este ciclo.` }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[ENFORCE_ASSIGNMENT_DEADLINES]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
