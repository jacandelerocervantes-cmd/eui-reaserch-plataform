// deno-lint-ignore-file no-import-prefix
/**
 * detect-cross-plagiarism
 * Compara las entregas de una actividad entre sí (no contra fuentes externas)
 * y señala pares con similitud sospechosa. Invocada desde
 * app/(docente)/panel/materias/[id]/actividades/[assignmentId]/page.tsx
 * ("Revisar similitud").
 *
 * ── Rediseño con embeddings (04-RECOMENDACIONES-IA-DOCENTE.md punto 3.4) ──
 * ANTES: un solo prompt todo-contra-todo con las N entregas completas como
 * `inline_data`, topado a MAX_FILES=12 porque no escalaba (O(N²) pares
 * dentro de un mismo prompt, cuota de tokens de Gemini por request).
 *
 * AHORA, en dos fases:
 *   1) UNA llamada Gemini por entrega (no por par) que resume su contenido
 *      en texto plano — reusa `embedText` (mismo wrapper de
 *      text-embedding-004 que ya usa build-knowledge-graph/graphrag-query)
 *      para vectorizar ese resumen. Cálculo de similitud coseno entre TODOS
 *      los pares es aritmética JS pura sobre esos vectores (barato, sin
 *      llamadas a IA) — de O(N²) llamadas a Gemini pasa a O(N).
 *   2) Solo los pares que la similitud coseno marca como sospechosos
 *      (>= EMBEDDING_PRESELECT_THRESHOLD) pasan a una verificación
 *      cualitativa final con Gemini VIENDO AMBOS PDFs completos — el mismo
 *      veredicto detallado de antes, pero solo para los candidatos reales,
 *      no para cada par posible.
 * Estrictamente mejor en costo Y escalabilidad: menos tokens de Gemini por
 * corrida que el enfoque anterior, y ya no depende de un tope arbitrario de
 * N archivos para no reventar el presupuesto de un solo prompt.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { embedText } from "../_shared/embeddings.ts"
import { applyInputGuardrail, guardOutputOrBlock } from "../_shared/guardrail.ts"
import { extractTextWithOcr } from "../_shared/ocrClient.ts"

const MAX_FILES = 40 // antes 12 — el cuello de botella real (prompt todo-contra-todo) ya no existe
const EMBEDDING_PRESELECT_THRESHOLD = 0.88 // similitud coseno del RESUMEN, no del texto completo — conservador a propósito, es solo un filtro previo
const MAX_PAIRS_TO_VERIFY = 25 // tope de costo para la fase 2 (verificación cualitativa con PDFs completos)

interface SubmissionRow {
  id: string
  file_path: string | null
  student_id: string | null
  team_id: string | null
  students: { nombres: string; apellido_paterno: string } | null
  assignment_teams: { name: string } | null
}

interface FlaggedPair {
  submission_id_a: string
  submission_id_b: string
  similarity_percent: number
  motivo: string
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i] }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55_000) // dos fases: más margen que antes (28s)

  try {
    const { assignment_id } = await req.json()
    if (!assignment_id) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'assignment_id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── 1. Actividad y ownership ─────────────────────────────────────────
    const { data: assignment } = await serviceClient
      .from("assignments")
      .select("id, course_id, title")
      .eq("id", assignment_id)
      .single()

    if (!assignment) return new Response(
      JSON.stringify({ success: false, error: "Actividad no encontrada." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const owns = await verifyCourseOwnership(serviceClient, assignment.course_id, userId)
    if (!owns) return new Response(
      JSON.stringify({ success: false, error: "No tienes permiso sobre esta actividad." }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── 2. Entregas con archivo (una por equipo, no por alumno duplicado) ──
    const { data: rowsRaw } = await serviceClient
      .from("submissions")
      .select("id, file_path, student_id, team_id, students(nombres, apellido_paterno), assignment_teams(name)")
      .eq("assignment_id", assignment_id)
      .not("file_path", "is", null)

    const rows = (rowsRaw ?? []) as unknown as SubmissionRow[]

    const seenUnit = new Set<string>()
    const candidates = rows.filter((r) => {
      const key = r.team_id ? `team:${r.team_id}` : `solo:${r.id}`
      if (seenUnit.has(key)) return false
      seenUnit.add(key)
      return true
    })

    if (candidates.length < 2) {
      return new Response(
        JSON.stringify({ success: true, flagged: [], compared: candidates.length, pdfSkipped: 0 }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const batch = candidates.slice(0, MAX_FILES)
    const pdfSkipped = candidates.length - batch.length

    const label = (r: SubmissionRow) =>
      r.team_id ? (r.assignment_teams?.name ?? "Equipo") : (r.students ? `${r.students.apellido_paterno}, ${r.students.nombres}`.trim() : "Alumno")

    // ── 3. FASE 1: descargar cada PDF, resumirlo (1 llamada Gemini c/u) y
    //      embeber el resumen (1 llamada de embeddings c/u). O(N), no O(N²). ─
    interface DocInfo { id: string; label: string; base64: string; embedding: number[] | null }
    const docs: DocInfo[] = []

    for (const row of batch) {
      const { data: fileData } = await serviceClient.storage
        .from("archivos_docentes")
        .download(row.file_path!)
      if (!fileData) continue

      const arrayBuffer = await fileData.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const base64File = btoa(String.fromCharCode(...bytes))

      // ── OCR previo (docs/05_OCR_Unlimited_Integracion.md) ────────────────
      // Si el cliente OCR está disponible, extrae texto plano ANTES de
      // mandar el PDF a Gemini y aplica el guardrail de ENTRADA sobre ese
      // texto — contenido de un ALUMNO (trustedActor=false, igual que
      // bulk-evaluate-exams), así que inyección de alta confianza SÍ
      // bloquea: esa entrega se excluye de la comparación de similitud y se
      // deja constancia, en vez de mandarla a Gemini. Si el OCR no está
      // disponible (breaker abierto, rate limit agotado, no configurado, o
      // el archivo no pasa validación), el comportamiento es EXACTAMENTE el
      // de antes: el PDF binario sigue su flujo normal sin este paso.
      const ocrResult = await extractTextWithOcr(bytes, controller.signal)
      if (ocrResult.available) {
        const guard = applyInputGuardrail(ocrResult.text, false)
        if (guard.block) {
          await serviceClient.from("ai_action_log").insert({
            teacher_id: userId, tool_name: "detect_cross_plagiarism",
            success: false, metadata: { guardrail_block_input: true, reasons: guard.reasons, submission_id: row.id },
          }).then(() => {}, () => {})
          continue
        }
        if (guard.reasons.length) {
          await serviceClient.from("ai_action_log").insert({
            teacher_id: userId, tool_name: "detect_cross_plagiarism",
            success: true, metadata: { guardrail_reasons: guard.reasons.map((r) => `ocr_input:${r}`), submission_id: row.id },
          }).then(() => {}, () => {})
        }
      }

      let embedding: number[] | null = null
      try {
        const summaryRes = await fetchGeminiWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
            contents: [{ parts: [
              { text: "Resume el contenido de este documento en 150-250 palabras, en prosa, capturando su estructura de argumentación, ejemplos y datos concretos que usa — no una lista de temas genérica, un resumen que preserve lo distintivo de ESTE documento en particular." },
              { inline_data: { mime_type: "application/pdf", data: base64File } },
            ] }],
            generationConfig: { temperature: 0.1 },
          },
          controller.signal,
        )
        if (summaryRes.ok) {
          const summaryJson = await summaryRes.json()
          const summaryText = summaryJson.candidates?.[0]?.content?.parts?.[0]?.text
          if (summaryText) embedding = await embedText(summaryText, GEMINI_KEY!, controller.signal)
        }
      } catch (err) {
        console.error(`[DETECT_CROSS_PLAGIARISM] resumen/embedding de ${row.id}:`, err instanceof Error ? err.message : err)
      }

      docs.push({ id: row.id, label: label(row), base64: base64File, embedding })
    }

    const embeddedDocs = docs.filter((d) => d.embedding !== null)
    if (embeddedDocs.length < 2) {
      return new Response(
        JSON.stringify({ success: true, flagged: [], compared: docs.length, pdfSkipped }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 4. Similitud coseno de TODOS los pares (JS puro, sin llamadas a IA) ─
    const preselected: { a: DocInfo; b: DocInfo; cosine: number }[] = []
    for (let i = 0; i < embeddedDocs.length; i++) {
      for (let j = i + 1; j < embeddedDocs.length; j++) {
        const cosine = cosineSimilarity(embeddedDocs[i].embedding!, embeddedDocs[j].embedding!)
        if (cosine >= EMBEDDING_PRESELECT_THRESHOLD) preselected.push({ a: embeddedDocs[i], b: embeddedDocs[j], cosine })
      }
    }
    preselected.sort((x, y) => y.cosine - x.cosine)
    const pairsToVerify = preselected.slice(0, MAX_PAIRS_TO_VERIFY)

    if (pairsToVerify.length === 0) {
      return new Response(
        JSON.stringify({ success: true, flagged: [], compared: embeddedDocs.length, pdfSkipped, preselected_pairs: 0 }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 5. FASE 2: verificación cualitativa SOLO de los pares preseleccionados,
    //      viendo ambos PDFs completos — mismo criterio detallado que antes. ─
    const flagged: FlaggedPair[] = []
    for (const pair of pairsToVerify) {
      try {
        const verifyRes = await fetchGeminiWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
            contents: [{ parts: [
              { text: `Eres un revisor de integridad académica del TecNM. Actividad: "${assignment.title ?? "Sin título"}". Dos documentos abajo (DOCUMENTO A de "${pair.a.label}", DOCUMENTO B de "${pair.b.label}") ya pasaron un filtro previo de similitud temática — tu trabajo es confirmar si de verdad comparten similitud textual/estructural sospechosa (estructura idéntica de argumentación, mismas frases literales, mismos ejemplos o errores compartidos), no solo el tema esperable por ser la misma consigna.` },
              { text: "--- DOCUMENTO A ---" },
              { inline_data: { mime_type: "application/pdf", data: pair.a.base64 } },
              { text: "--- DOCUMENTO B ---" },
              { inline_data: { mime_type: "application/pdf", data: pair.b.base64 } },
              { text: "Responde JSON puro sin markdown: {\"sospechoso\":true,\"similarity_percent\":0,\"motivo\":\"...\"} — sospechoso=false si al verlos completos NO hay similitud real más allá del tema compartido." },
            ] }],
            generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
          },
          controller.signal,
        )
        if (!verifyRes.ok) continue
        const verifyJson = await verifyRes.json()
        const content = verifyJson.candidates?.[0]?.content?.parts?.[0]?.text
        if (!content) continue
        const verdict: { sospechoso?: boolean; similarity_percent?: number; motivo?: string } = JSON.parse(content)
        if (verdict.sospechoso) {
          flagged.push({
            submission_id_a: pair.a.id, submission_id_b: pair.b.id,
            similarity_percent: verdict.similarity_percent ?? Math.round(pair.cosine * 100),
            motivo: verdict.motivo ?? "Similitud confirmada tras verificación.",
          })
        }
      } catch (err) {
        console.error(`[DETECT_CROSS_PLAGIARISM] verificación par ${pair.a.id}/${pair.b.id}:`, err instanceof Error ? err.message : err)
      }
    }

    // ── 6. Guardrail de salida sobre los motivos redactados por Gemini antes
    //      de persistirlos (quedan visibles al docente en el panel). ─────────
    if (flagged.length > 0) {
      const guard = await guardOutputOrBlock(JSON.stringify(flagged.map((f) => f.motivo)), {
        serviceClient, teacherId: userId, toolName: "detect_cross_plagiarism", cors,
        errorBody: { success: false, error: "El reporte de similitud no pudo mostrarse por una regla de seguridad interna." },
      })
      if (guard.blocked) return guard.response
    }

    // ── 7. Persistir: submission_similarity_flags (pares) + ai_integrity_flag
    //      por entrega. Best-effort: un fallo al guardar no debe tirar la
    //      respuesta ya calculada.
    if (flagged.length > 0) {
      await serviceClient.from("submission_similarity_flags").insert(
        flagged.map((f) => ({
          assignment_id,
          submission_id_a: f.submission_id_a,
          submission_id_b: f.submission_id_b,
          similarity_percent: f.similarity_percent,
        }))
      ).then(({ error }) => { if (error) console.error("[DETECT_CROSS_PLAGIARISM] insert flags:", error.message) })

      const flaggedIds = [...new Set(flagged.flatMap((f) => [f.submission_id_a, f.submission_id_b]))]
      await serviceClient
        .from("submissions")
        .update({ ai_integrity_flag: true, ai_integrity_notes: "Similitud cruzada detectada con otra entrega de la misma actividad." })
        .in("id", flaggedIds)
        .then(({ error }) => { if (error) console.error("[DETECT_CROSS_PLAGIARISM] update flags:", error.message) })
    }

    return new Response(
      JSON.stringify({
        success: true,
        flagged: flagged.map((f) => ({
          ...f,
          label_a: docs.find((s) => s.id === f.submission_id_a)?.label,
          label_b: docs.find((s) => s.id === f.submission_id_b)?.label,
        })),
        compared: embeddedDocs.length,
        pdfSkipped,
        preselected_pairs: pairsToVerify.length,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout (55s) revisando similitud." : err instanceof Error ? err.message : "Error interno."
    console.error("[DETECT_CROSS_PLAGIARISM]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
