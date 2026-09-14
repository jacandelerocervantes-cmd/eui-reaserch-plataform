// deno-lint-ignore-file no-import-prefix
/**
 * copilot-execute-tool
 * Ejecuta UNA de las herramientas del catálogo (_shared/copilotTools.ts)
 * después de que el docente confirmó la propuesta en el Canvas — este es el
 * único lugar donde el Master Copilot realmente escribe en la base de datos.
 * master-copilot-orchestrator solo propone; nunca ejecuta directamente.
 *
 * "crear_material_boveda"/"crear_presentacion_slides"/"crear_rubrica_sheet"
 * suben el contenido como archivo de texto al bucket "materiales-docentes"
 * (crear ese bucket en Supabase Storage antes de desplegar — no vía SQL) y
 * registran la fila en materiales_boveda. No es una hoja de Google Sheets
 * nativa para la rúbrica (el nombre "_sheet" lo sugiere pero no hay
 * integración con Apps Script confirmada para esto) — es un archivo de
 * texto estructurado, funcionalmente correcto pero no un Sheet real. Si se
 * necesita Sheets real después, se reemplaza esta rama sin tocar las demás.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente, type SupabaseClient } from "../_shared/auth.ts"
import { findTool, missingParams } from "../_shared/copilotTools.ts"

const MATERIALS_BUCKET = "materiales-docentes"

/**
 * Ingesta best-effort al knowledge-graph de docencia (04-RECOMENDACIONES-IA-DOCENTE.md
 * punto 13) — build-knowledge-graph YA soporta source_type='exam'/'activity'
 * (ver _shared del propio archivo, SOURCE_TYPES_BY_DOMAIN) pero nada lo
 * invocaba con esos tipos: el grafo solo se alimentaba de material subido
 * (course_materials), nunca de lo que realmente se evalúa. Se llama aquí,
 * justo después de crear un examen/actividad vía Copilot, reenviando el
 * mismo JWT del docente que ya pasó verifyDocente en este mismo request
 * (build-knowledge-graph vuelve a autenticar y a validar ownership del
 * curso por su cuenta — esto no es un bypass de esos checks).
 *
 * Se espera (await) antes de responder — un Edge Function serverless puede
 * congelar/matar la instancia apenas se manda la respuesta, así que un
 * fetch verdaderamente "fire-and-forget" (sin await) arriesga no completarse
 * nunca. Sí es best-effort en el sentido de que un error AQUÍ nunca hace
 * fallar la creación del examen/actividad, que ya se guardó con éxito antes
 * de llamar esto — el grafo es un enriquecimiento secundario, no una
 * dependencia dura de la herramienta (por eso el try/catch se traga el
 * error en vez de propagarlo).
 */
async function ingestToKnowledgeGraphBestEffort(
  authHeader: string | null, courseId: string, sourceType: "exam" | "activity", sourceId: string, text: string, titulo: string,
): Promise<void> {
  const baseUrl = Deno.env.get("SUPABASE_URL")
  if (!baseUrl || !authHeader || !text.trim()) return
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 20_000)
    await fetch(`${baseUrl}/functions/v1/build-knowledge-graph`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ domain: "docencia", course_id: courseId, source_type: sourceType, source_id: sourceId, text, titulo }),
      signal: controller.signal,
    }).finally(() => clearTimeout(t))
  } catch (err) {
    console.error("[COPILOT_EXECUTE_TOOL] ingesta a knowledge-graph (no bloqueante):", err instanceof Error ? err.message : err)
  }
}

async function uploadTextMaterial(
  serviceClient: SupabaseClient,
  courseId: string, unitId: string, titulo: string, contenido: string, tipo: "doc" | "slide" | "sheet",
): Promise<{ url: string }> {
  const path = `${courseId}/${unitId}/${Date.now()}-${titulo.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`
  const { error: upErr } = await serviceClient.storage
    .from(MATERIALS_BUCKET)
    .upload(path, new Blob([contenido], { type: "text/markdown" }))
  if (upErr) throw new Error(`No se pudo subir el material: ${upErr.message}`)
  const { data } = serviceClient.storage.from(MATERIALS_BUCKET).getPublicUrl(path)

  const { error: insertErr } = await serviceClient
    .from("materiales_boveda")
    .insert({ materia_id: courseId, unit_id: unitId, nombre: titulo, tipo, url: data.publicUrl, ai: true, es_visible: true })
  if (insertErr) throw new Error(`Material subido pero no se pudo registrar: ${insertErr.message}`)

  return { url: data.publicUrl }
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    const { tool_name, params, course_id } = await req.json()
    if (!tool_name || !course_id) return new Response(
      JSON.stringify({ success: false, error: "Se requieren 'tool_name' y 'course_id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const tool = findTool(tool_name)
    if (!tool) return new Response(
      JSON.stringify({ success: false, error: `Herramienta desconocida: ${tool_name}.` }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )
    const missing = missingParams(tool, params ?? {})
    if (missing.length > 0) return new Response(
      JSON.stringify({ success: false, error: `Faltan parámetros: ${missing.join(", ")}.` }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const owns = await verifyCourseOwnership(serviceClient, course_id, userId)
    if (!owns) return new Response(
      JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // Defensa contra IDOR: si el tool trae unit_id/assignment_id, confirmar
    // que pertenece a ESTA materia antes de escribir nada.
    const p = (params ?? {}) as Record<string, unknown>
    if (typeof p.unit_id === "string") {
      const { data: unit } = await serviceClient.from("course_units").select("course_id").eq("id", p.unit_id).single()
      if (!unit || unit.course_id !== course_id) return new Response(
        JSON.stringify({ success: false, error: "La unidad indicada no pertenece a esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    let result: Record<string, unknown> = {}

    switch (tool_name) {
      case "crear_aviso": {
        const { error } = await serviceClient.from("course_announcements").insert({
          course_id, author_id: userId, title: p.titulo, content: p.contenido,
        })
        if (error) throw new Error(error.message)
        break
      }

      case "crear_material_boveda": {
        result = await uploadTextMaterial(serviceClient, course_id, p.unit_id as string, p.titulo as string, p.contenido as string, "doc")
        break
      }

      case "crear_presentacion_slides": {
        result = await uploadTextMaterial(serviceClient, course_id, p.unit_id as string, p.titulo as string, p.contenido_outline as string, "slide")
        break
      }

      case "crear_rubrica_sheet": {
        const criteriosText = JSON.stringify(p.criterios, null, 2)
        result = await uploadTextMaterial(serviceClient, course_id, p.unit_id as string, p.titulo as string, criteriosText, "sheet")
        break
      }

      case "crear_evaluacion": {
        const { data: exam, error } = await serviceClient
          .from("exams")
          .insert({
            course_id, unit_id: p.unit_id, title: p.titulo, description: p.tema,
            start_at: p.start_at ?? null, end_at: p.end_at ?? null, status: "draft",
          })
          .select("id")
          .single()
        if (error) throw new Error(error.message)
        result = { exam_id: exam.id, nota: "Examen creado sin reactivos — genera los reactivos desde Evaluaciones > este examen." }
        await ingestToKnowledgeGraphBestEffort(req.headers.get("Authorization"), course_id, "exam", exam.id, `${p.titulo}\n\n${p.tema}`, p.titulo as string)
        break
      }

      case "crear_actividad": {
        const { data: assignment, error } = await serviceClient
          .from("assignments")
          .insert({
            course_id, unit_id: p.unit_id, title: p.titulo, description: p.descripcion,
            format: p.format, submission_type: p.submission_type, soft_deadline: p.soft_deadline,
            rubric_data: {},
          })
          .select("id")
          .single()
        if (error) throw new Error(error.message)
        result = { assignment_id: assignment.id }
        await ingestToKnowledgeGraphBestEffort(req.headers.get("Authorization"), course_id, "activity", assignment.id, `${p.titulo}\n\n${p.descripcion}`, p.titulo as string)
        break
      }

      case "cerrar_unidad": {
        const { error } = await serviceClient
          .from("course_units")
          .update({ is_closed: true, closed_at: new Date().toISOString() })
          .eq("id", p.unit_id)
        if (error) throw new Error(error.message)
        break
      }

      case "cerrar_entrega": {
        const { data: assignment } = await serviceClient.from("assignments").select("course_id").eq("id", p.assignment_id).single()
        if (!assignment || assignment.course_id !== course_id) return new Response(
          JSON.stringify({ success: false, error: "La actividad indicada no pertenece a esta materia." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        )
        const { error } = await serviceClient
          .from("assignments")
          .update({ hard_deadline: new Date().toISOString() })
          .eq("id", p.assignment_id)
        if (error) throw new Error(error.message)
        break
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Herramienta reconocida pero sin ejecutor: ${tool_name}.` }),
          { status: 501, headers: { ...cors, "Content-Type": "application/json" } }
        )
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[COPILOT_EXECUTE_TOOL]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
