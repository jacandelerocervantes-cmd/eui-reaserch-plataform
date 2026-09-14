// deno-lint-ignore-file no-import-prefix no-explicit-any
/**
 * analyze-submission-integrity
 * Analiza el historial de revisiones de Drive de una entrega (Doc/Sheet) para:
 * 1. Calcular el % de contribución de cada integrante (si es entrega de equipo).
 * 2. Detectar pegados masivos (muchas palabras agregadas en muy poco tiempo).
 * El análisis real ocurre en Apps Script (analizarHistorialEntrega); aquí solo
 * se valida ownership, se llama, se traduce correo->alumno y se persiste.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders, errorResponse, verifyCourseOwnership, verifyDocente } from "../_shared/auth.ts"

function extractDriveFileId(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/\/d\/([^/]+)/)
  return match ? match[1] : null
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    const { submission_id } = await req.json()
    if (!submission_id) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'submission_id'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const { data: sub, error: subErr } = await serviceClient
      .from("submissions")
      .select("id, team_id, content_url, assignment_id, assignments(course_id)")
      .eq("id", submission_id)
      .single()
    if (subErr || !sub) return new Response(
      JSON.stringify({ success: false, error: "Entrega no encontrada." }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const courseId = (sub as any).assignments?.course_id
    if (!courseId || !(await verifyCourseOwnership(serviceClient, courseId, userId))) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta entrega." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const fileId = extractDriveFileId((sub as any).content_url)
    if (!fileId) return new Response(
      JSON.stringify({ success: false, error: "Esta entrega no tiene un archivo de Workspace para analizar (¿es de tipo 'subida'?)." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
    const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")
    if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL no configurado.")

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 35_000)
    let scriptResult: any
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: WEBHOOK_SECRET, action: "analizarHistorialEntrega", payload: { fileId } }),
        signal: controller.signal,
      })
      const json = await res.json()
      // Router.gs envuelve el éxito como {success:true, data:<resultado real>}.
      scriptResult = json.success ? (json.data ?? {}) : { success: false, error: json.error }
    } finally {
      clearTimeout(timeout)
    }

    if (!scriptResult.success) throw new Error(scriptResult.error || "Error al analizar el historial.")

    // Traducir correo -> alumno real del curso.
    const emails: string[] = (scriptResult.contributions ?? []).map((c: any) => c.email).filter(Boolean)
    const { data: matchedStudents } = await serviceClient
      .from("students")
      .select("id, correo, nombres, apellido_paterno")
      .eq("course_id", courseId)
      .in("correo", emails.length > 0 ? emails : ["__none__"])

    const studentByEmail = new Map((matchedStudents ?? []).map((s: any) => [s.correo?.toLowerCase(), s]))

    const contributions = (scriptResult.contributions ?? []).map((c: any) => {
      const student = studentByEmail.get(c.email?.toLowerCase())
      return {
        ...c,
        student_id: student?.id ?? null,
        student_name: student ? `${student.apellido_paterno} ${student.nombres}` : c.email,
      }
    })

    // Si es entrega de equipo, cada integrante recibe SU propio % en su fila.
    if ((sub as any).team_id) {
      for (const c of contributions) {
        if (!c.student_id) continue
        await serviceClient.from("submissions")
          .update({ contribution_percent: c.percent, contribution_analyzed_at: new Date().toISOString() })
          .eq("team_id", (sub as any).team_id).eq("student_id", c.student_id)
      }
    }

    // Flags de integridad (pegado masivo) — se guardan en todas las filas que
    // comparten el mismo archivo (todo el equipo, o la única fila si es individual).
    const integrityFlags = scriptResult.suspiciousPastes ?? []
    if ((sub as any).team_id) {
      await serviceClient.from("submissions").update({ integrity_flags: integrityFlags }).eq("team_id", (sub as any).team_id)
    } else {
      await serviceClient.from("submissions").update({ integrity_flags: integrityFlags }).eq("id", (sub as any).id)
    }

    return new Response(
      JSON.stringify({ success: true, contributions, suspiciousPastes: integrityFlags, totalRevisions: scriptResult.totalRevisions }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout al analizar el historial." : err instanceof Error ? err.message : "Error interno."
    console.error("[ANALYZE_SUBMISSION_INTEGRITY]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: isTimeout ? 504 : 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
