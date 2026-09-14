// deno-lint-ignore-file no-import-prefix
/**
 * confirm-capture
 * Paso 2 (humano) del pipeline: el docente/investigador revisa
 * ai_extracted_data (sugerencia de analyze-capture) y envía los datos ya
 * confirmados/corregidos. Este es el ÚNICO punto que escribe el dato
 * "final" que otros módulos pueden consumir como válido — campos_datos en
 * capturas_campo, o notas ampliadas en equipos_lab_logs.
 *
 * También soporta rechazar la sugerencia sin aceptar ningún dato (la
 * captura queda con review_status='rechazado', no se pierde el registro
 * original, solo no se usa la sugerencia de IA).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"

const DOMAINS = ["campo", "laboratorio"] as const
type Domain = typeof DOMAINS[number]

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, role, serviceClient } = auth.ctx

  try {
    const { domain, id, action, datos_confirmados } = await req.json()
    if (!DOMAINS.includes(domain)) return new Response(
      JSON.stringify({ success: false, error: "'domain' debe ser 'campo' o 'laboratorio'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )
    if (!id || (action !== "validar" && action !== "rechazar")) return new Response(
      JSON.stringify({ success: false, error: "Se requieren 'id' y 'action' ('validar'|'rechazar')." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const table = (domain as Domain) === "campo" ? "capturas_campo" : "equipos_lab_logs"
    const { data: row } = await serviceClient.from(table).select("id, docente_id").eq("id", id).single()
    if (!row) return new Response(
      JSON.stringify({ success: false, error: "Registro no encontrado." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )
    if (role !== "admin" && row.docente_id !== userId) return new Response(
      JSON.stringify({ success: false, error: "No tienes permiso sobre este registro." }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    )

    if (action === "rechazar") {
      const { error } = await serviceClient
        .from(table)
        .update({ review_status: "rechazado", reviewed_by: userId, reviewed_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw new Error(error.message)
      return new Response(
        JSON.stringify({ success: true, data: { review_status: "rechazado" } }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // action === "validar": persiste el dato ya revisado/corregido por el humano.
    const updatePayload: Record<string, unknown> = {
      review_status: "validado", reviewed_by: userId, reviewed_at: new Date().toISOString(),
    }
    if (domain === "campo") {
      updatePayload.campos_datos = datos_confirmados ?? {}
    } else {
      // equipos_lab_logs no tiene un jsonb "final" propio (su dato principal
      // es texto libre en "notas") — el humano confirma anexando lo
      // corregido a notas en vez de duplicar un jsonb que nadie más lee.
      const { data: current } = await serviceClient.from(table).select("notas").eq("id", id).single()
      const extra = datos_confirmados ? `\n[Confirmado por revisor]: ${JSON.stringify(datos_confirmados)}` : ""
      updatePayload.notas = `${current?.notas ?? ""}${extra}`
    }

    const { error } = await serviceClient.from(table).update(updatePayload).eq("id", id)
    if (error) throw new Error(error.message)

    return new Response(
      JSON.stringify({ success: true, data: { review_status: "validado" } }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[CONFIRM_CAPTURE]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
