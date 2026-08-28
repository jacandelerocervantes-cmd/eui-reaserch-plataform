// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { applyInputGuardrail, applyOutputGuardrail } from "../_shared/guardrail.ts"
import { extractDriveFileId } from "../_shared/driveUrl.ts"
import { extractTextWithOcr } from "../_shared/ocrClient.ts"

// PDFs son pesados: 3 × ~8s ≈ 24s dentro del budget de 30s por llamada.
// El cliente llama de nuevo si remaining > 0 (patrón cursor-DB).
const BATCH_SIZE = 3

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { serviceClient } = auth.ctx

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  try {
    const { submission_ids, assignment_id } = await req.json()
    if (!submission_ids?.length || !assignment_id) return new Response(
      JSON.stringify({ error: "Se requieren 'submission_ids' y 'assignment_id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── 2. Rúbrica y contexto de la actividad ─────────────────────────────
    const { data: assignment } = await serviceClient
      .from("assignments")
      .select("rubric_data, title, description, course_id")
      .eq("id", assignment_id)
      .single()

    if (!assignment) return new Response(
      JSON.stringify({ error: "Actividad no encontrada." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // Umbral calibrado empíricamente (validate-ai-grading + calibrate-ai-thresholds,
    // dominio submission_grading) — misma mecánica que bulk-evaluate-exams.
    // Segmentado por curso (04-RECOMENDACIONES-IA-DOCENTE.md punto 3.2):
    // curso propio primero, luego global, luego el default 0.3.
    let confidenceThreshold = 0.3
    if (assignment.course_id) {
      const { data: courseCalibration } = await serviceClient
        .from("ai_calibration_state")
        .select("confidence_threshold")
        .eq("domain", "submission_grading").eq("course_id", assignment.course_id)
        .order("calibrated_at", { ascending: false }).limit(1).maybeSingle()
      if (courseCalibration) confidenceThreshold = courseCalibration.confidence_threshold
      else {
        const { data: globalCalibration } = await serviceClient
          .from("ai_calibration_state")
          .select("confidence_threshold")
          .eq("domain", "submission_grading").is("course_id", null)
          .order("calibrated_at", { ascending: false }).limit(1).maybeSingle()
        if (globalCalibration) confidenceThreshold = globalCalibration.confidence_threshold
      }
    }

    // ── 3. Checkpoint de entrada: marcar elegibles → ai_queued ───────────
    // Idempotente: no sobreescribe ai_queued/ai_draft/completed existentes.
    // Si la función cortó a mitad en una llamada anterior, los items
    // no terminados siguen en ai_queued y se retoman aquí automáticamente.
    await serviceClient
      .from("submissions")
      .update({ status: "ai_queued" })
      .in("id", submission_ids)
      .not("status", "in", '("ai_queued","ai_draft","completed")')

    // ── 4. Tomar el siguiente lote pendiente ──────────────────────────────
    // team_id agrupa: un equipo entrega UN solo archivo, así que se evalúa una
    // sola vez con la IA y la nota se replica a cada integrante (ajustable
    // después por alumno). Los alumnos sin team_id se evalúan individualmente
    // como siempre.
    const { data: queuedRows } = await serviceClient
      .from("submissions")
      .select("id, content_url, team_id, students(nombres, apellido_paterno), assignment_teams(name)")
      .in("id", submission_ids)
      .eq("status", "ai_queued")

    if (!queuedRows?.length) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, remaining: 0, done: true }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    type EvalUnit = { rowIds: string[]; content_url: string | null; label: string }
    type QueuedRow = {
      id: string; content_url: string | null; team_id: string | null;
      students: { nombres: string; apellido_paterno: string } | null;
      assignment_teams: { name: string } | null;
    }
    const unitsMap = new Map<string, EvalUnit>()
    // `queuedRows` viene de un `.select()` con relaciones embebidas
    // (students/assignment_teams) sobre un SupabaseClient sin generic
    // `Database` tipado — el compilador no puede saber que son FKs a-uno y
    // por defecto las infiere como arreglo; el shape real en runtime SÍ es
    // objeto único (confirmado por el uso de `.correo`/`.nombres` sueltos
    // más abajo, ya presente antes de este cambio). Cast vía `unknown`
    // porque el propio compilador (TS2352) señala que los tipos no
    // solapan lo suficiente para un cast directo.
    for (const row of queuedRows as unknown as QueuedRow[]) {
      const key = row.team_id ? `team:${row.team_id}` : `solo:${row.id}`
      if (!unitsMap.has(key)) {
        unitsMap.set(key, {
          rowIds: [],
          content_url: row.content_url,
          label: row.team_id
            ? (row.assignment_teams?.name ?? "Equipo")
            : (row.students ? `${row.students.apellido_paterno}, ${row.students.nombres}`.trim() : "Alumno"),
        })
      }
      unitsMap.get(key)!.rowIds.push(row.id)
    }
    const batch = Array.from(unitsMap.values()).slice(0, BATCH_SIZE)

    // ── 5. Evaluar cada unidad del lote (alumno suelto o equipo completo) ──
    let processed = 0
    let rateLimited = false

    for (let i = 0; i < batch.length; i++) {
      const unit = batch[i]

      // Si ya detectamos 429 en este lote, no insistimos con el resto:
      // dejamos los demás en ai_queued para que el próximo llamado los retome.
      if (rateLimited) break

      // Espaciar las llamadas a Gemini dentro del mismo lote (no disparar
      // varias casi simultáneas) — margen conservador frente a límites por minuto.
      if (i > 0) await new Promise((r) => setTimeout(r, 2_000))

      const controller = new AbortController()
      const timeout    = setTimeout(() => controller.abort(), 28_000)

      try {
        // Los archivos de entregas ya no viven en Supabase Storage — desde
        // submit-assignment-file van a Drive, y la URL real queda en
        // submissions.content_url (no en file_path/Storage, que ya no se
        // escribe para entregas nuevas). Se extrae el fileId de esa URL y se
        // le pide el base64 a Apps Script (obtenerArchivoBase64) en vez de
        // descargar de un bucket.
        const driveFileId = extractDriveFileId(unit.content_url)
        if (!driveFileId) {
          await serviceClient.from("submissions").update({ status: "error_archivo" }).in("id", unit.rowIds)
          continue
        }

        const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
        const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")
        if (!APPS_SCRIPT_URL) {
          await serviceClient.from("submissions").update({ status: "error_archivo" }).in("id", unit.rowIds)
          continue
        }

        let base64File: string | null = null
        try {
          const driveController = new AbortController()
          const driveTimeout    = setTimeout(() => driveController.abort(), 20_000)
          try {
            const driveRes = await fetch(APPS_SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                secret: WEBHOOK_SECRET, action: "obtenerArchivoBase64", payload: { fileId: driveFileId },
              }),
              signal: driveController.signal,
            })
            const driveJson = await driveRes.json()
            // Router.gs envuelve todo éxito como {success:true, data:<resultado>}.
            if (driveJson.success && driveJson.data?.success && driveJson.data?.base64Data) {
              base64File = driveJson.data.base64Data
            }
          } finally {
            clearTimeout(driveTimeout)
          }
        } catch (_) { /* base64File queda null, se marca error_archivo abajo */ }

        if (!base64File) {
          // Archivo faltante/no descargable — marcamos para que el docente lo revise manualmente
          await serviceClient
            .from("submissions")
            .update({ status: "error_archivo" })
            .in("id", unit.rowIds)
          continue
        }

        const alumnoNombre = unit.label

        // ── OCR previo (docs/05_OCR_Unlimited_Integracion.md) ───────────────
        // Si el cliente OCR está disponible (breaker cerrado, dentro del
        // rate limit diario), extrae texto plano del PDF ANTES de mandarlo a
        // Gemini y aplica el guardrail de ENTRADA sobre ese texto — contenido
        // de un ALUMNO (trustedActor=false, igual que bulk-evaluate-exams),
        // así que inyección de alta confianza bloquea la evaluación de esta
        // unidad (se deja constancia y se marca error_archivo en vez de
        // evaluarla). Si el OCR no está disponible (no configurado, breaker
        // abierto, rate limit agotado, o el archivo no pasa validación), el
        // comportamiento es EXACTAMENTE el de antes: el PDF binario sigue su
        // flujo normal a Gemini sin este paso extra.
        const ocrBytes = Uint8Array.from(atob(base64File), (c) => c.charCodeAt(0))
        const ocrResult = await extractTextWithOcr(ocrBytes, controller.signal)
        if (ocrResult.available) {
          const ocrGuard = applyInputGuardrail(ocrResult.text, false)
          if (ocrGuard.block) {
            await serviceClient.from("ai_action_log").insert({
              teacher_id: auth.ctx.userId, tool_name: "evaluate_submissions_ia",
              success: false, metadata: { guardrail_block_input: true, reasons: ocrGuard.reasons, submission_ids: unit.rowIds },
            }).then(() => {}, () => {})
            await serviceClient.from("submissions").update({ status: "error_archivo" }).in("id", unit.rowIds)
            continue
          }
          if (ocrGuard.reasons.length) {
            await serviceClient.from("ai_action_log").insert({
              teacher_id: auth.ctx.userId, tool_name: "evaluate_submissions_ia",
              success: true, metadata: { guardrail_reasons: ocrGuard.reasons.map((r) => `ocr_input:${r}`), submission_ids: unit.rowIds },
            }).then(() => {}, () => {})
          }
        }

        // retryStatuses=[503] (no 429): un 429 aquí debe frenar TODO el lote
        // (ver abajo), no reintentarse local — eso ya lo maneja el flag rateLimited.
        const aiRes = await fetchGeminiWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
              contents: [{
                parts: [
                  { inline_data: { mime_type: "application/pdf", data: base64File } },
                  { text:
                    `Eres un evaluador académico riguroso del TecNM. Evalúa el trabajo de "${alumnoNombre}".

ACTIVIDAD: "${assignment.title ?? "Sin título"}"
${assignment.description ? `INSTRUCCIONES ORIGINALES: ${assignment.description}` : ""}

RÚBRICA OFICIAL (evalúa ÚNICAMENTE con estos criterios):
${JSON.stringify(assignment.rubric_data, null, 2)}

PROTOCOLO DE EVALUACIÓN:
1. Lee el documento completo antes de asignar ningún puntaje.
2. Para cada criterio: asigna puntos de 0 al peso máximo del criterio según el desempeño evidenciado.
3. ai_score: promedio ponderado de todos los criterios (escala 0-100). No redondees arbitrariamente.
4. ai_feedback: en español, 150-250 palabras. Estructura obligatoria:
   - LOGROS: menciona 2-3 aspectos positivos con cita o referencia al documento.
   - ÁREAS DE MEJORA: señala 1-2 deficiencias específicas con ejemplo del trabajo.
   - RECOMENDACIÓN: una acción concreta que el alumno debe ejecutar para mejorar.
   Tono profesional y constructivo. Sin saludos ni fórmulas de cortesía.
5. criteria_scores: objeto JSON con el nombre EXACTO de cada criterio como clave y la puntuación numérica obtenida como valor.
6. integrity_flag (booleano): true SOLO si encuentras señales razonablemente claras de que el texto fue copiado de una fuente externa sin atribución, o de que fue generado por una IA conversacional (ej. estructura genérica tipo "claro, aquí tienes...", frases de relleno típicas de chatbot, inconsistencia de estilo/vocabulario entre secciones, contenido desconectado de las instrucciones específicas de la actividad). No marques true solo por sospecha débil o porque el texto esté bien escrito — la duda razonable favorece al alumno.
7. integrity_notes: si integrity_flag es true, 1-2 frases explicando la señal concreta detectada. Si es false, cadena vacía "".

JSON puro sin markdown ni bloques de código:
{"ai_score":0,"ai_feedback":"...","criteria_scores":{"Nombre Criterio":0},"integrity_flag":false,"integrity_notes":""}`
                  }
                ]
              }],
              generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
          },
          controller.signal,
          2,
          [503],
        )

        if (aiRes.status === 429) {
          rateLimited = true
          throw new Error("Gemini 429: límite de la API alcanzado.")
        }
        if (!aiRes.ok) throw new Error(`Gemini ${aiRes.status}`)
        const aiJson   = await aiRes.json()
        const content  = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
        if (!content)  throw new Error("Gemini devolvió respuesta vacía.")
        const evaluation = JSON.parse(content)

        // Guardrail de salida (docs/04_Multi_Agente_MCP.md §3, actualizado en
        // §4.6/§4.7 tras la integración OCR de docs/05_OCR_Unlimited_Integracion.md):
        // el guardrail de ENTRADA ya corrió arriba, PERO solo cuando el
        // cliente OCR estuvo disponible — con el breaker abierto o sin cupo
        // diario, el contenido del alumno sigue viajando como PDF binario
        // (inline_data) sin texto extraído que escanear, igual que antes. Lo
        // que SIEMPRE se hace, con o sin OCR disponible, es revisar el texto
        // que Gemini devuelve antes de persistirlo: fuga del propio prompt de
        // sistema bloquea el guardado
        // (el ai_feedback nunca debe repetir la rúbrica/instrucciones
        // internas), y lenguaje discriminatorio marca revisión prioritaria.
        const feedbackScan = applyOutputGuardrail(String(evaluation.ai_feedback ?? ""))
        if (!feedbackScan.allow) {
          await serviceClient.from("ai_action_log").insert({
            teacher_id: auth.ctx.userId, tool_name: "evaluate_submissions_ia",
            success: false, metadata: { guardrail_block_output: true, reasons: feedbackScan.reasons, submission_ids: unit.rowIds },
          }).then(() => {}, () => {})
          await serviceClient.from("submissions").update({ status: "error_archivo" }).in("id", unit.rowIds)
          continue
        }

        // Muestreo proporcional al umbral calibrado — igual que
        // bulk-evaluate-exams, ver VALIDACION_Y_CALIBRACION.md.
        const requierePrioridad = Math.random() < confidenceThreshold || feedbackScan.requiresHumanReview

        // Misma nota y feedback para TODOS los integrantes del equipo (o el
        // único alumno, si no hay team_id) — editable después por separado.
        await serviceClient
          .from("submissions")
          .update({
            ai_score:           evaluation.ai_score,
            ai_feedback:        evaluation.ai_feedback,
            status:             "ai_draft",
            metadata:           { criteria_scores: evaluation.criteria_scores, requiere_revision_prioritaria: requierePrioridad },
            evaluated_at:       new Date().toISOString(),
            ai_integrity_flag:  !!evaluation.integrity_flag,
            ai_integrity_notes: evaluation.integrity_notes || null,
          })
          .in("id", unit.rowIds)

        processed += unit.rowIds.length
      } catch (err) {
        // No marcamos como error: el item queda en ai_queued y el próximo
        // call lo retomará. Solo logueamos para diagnóstico.
        console.error(`[EVAL_SUBMISSIONS] unidad (${unit.rowIds.join(",")}):`, err instanceof Error ? err.message : err)
      } finally {
        clearTimeout(timeout)
      }
    }

    // ── 6. Contar pendientes para que el cliente decida si llama de nuevo ─
    const { count: remaining } = await serviceClient
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("id", submission_ids)
      .eq("status", "ai_queued")

    return new Response(
      JSON.stringify({
        success:     true,
        processed,
        remaining:   remaining ?? 0,
        done:        (remaining ?? 0) === 0,
        rateLimited,
        message:     `Lote: ${processed}/${batch.length} evaluados. Pendientes: ${remaining ?? 0}.`,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno."
    console.error("[EVALUATE_SUBMISSIONS_IA]", msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
