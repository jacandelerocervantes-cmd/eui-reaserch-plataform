// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * activate-scheduled-exams
 * Job de mantenimiento — lo dispara un cron de Supabase (pg_cron), no un
 * docente. Pasa exámenes de "draft" a "published" cuando llega su start_at,
 * y de "published" a "closed" cuando pasa su end_at. Sin IA ni llamadas
 * externas — solo dos updates por lote, pensado para correr cada pocos
 * minutos sin costo. El docente puede adelantarse a esto con los botones
 * "Publicar ahora"/"Cerrar ahora" en la tarjeta del examen.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildCorsHeaders } from "../_shared/auth.ts"

const BATCH_LIMIT = 200

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
  const nowIso = new Date().toISOString()

  try {
    const { data: published, error: e1 } = await serviceClient
      .from("exams")
      .update({ status: "published" })
      .eq("status", "draft")
      .not("start_at", "is", null)
      .lte("start_at", nowIso)
      .select("id")
      .limit(BATCH_LIMIT)
    if (e1) throw e1

    const { data: closed, error: e2 } = await serviceClient
      .from("exams")
      .update({ status: "closed" })
      .eq("status", "published")
      .not("end_at", "is", null)
      .lte("end_at", nowIso)
      .select("id")
      .limit(BATCH_LIMIT)
    if (e2) throw e2

    return new Response(
      JSON.stringify({ success: true, published: published?.length ?? 0, closed: closed?.length ?? 0 }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[ACTIVATE_SCHEDULED_EXAMS]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
