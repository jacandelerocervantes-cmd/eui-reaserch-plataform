// deno-lint-ignore-file no-import-prefix
/**
 * upload-course-material
 * Sube un archivo de material didáctico a la Bóveda (drive/) de una materia.
 * El archivo NO va a Supabase Storage — va a Google Drive vía Apps Script
 * (misma arquitectura que create-assignment-hub): se resuelve/crea la
 * subcarpeta de la unidad dentro de 01_Materiales_Boveda, se sube el
 * binario, y se registra la fila en `materiales_boveda` con la URL real de
 * Drive. Invocada desde
 * app/(docente)/panel/materias/[id]/drive/_hooks/useDriveMateria.ts.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  buildCorsHeaders, errorResponse,
  verifyCourseOwnership, verifyDocente,
} from "../_shared/auth.ts"
import { validateFileBytesByExtension } from "../_shared/fileValidation.ts"

// Mismo tope que app/api/storage/validated-upload/route.ts — generoso para
// PDF/Office/imágenes de clase, acota abuso obvio.
const MAX_FILE_BYTES = 20 * 1024 * 1024

serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ────────────────────────────────────────────────────────────
  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  try {
    const formData = await req.formData()
    const course_id = String(formData.get("course_id") ?? "")
    const unit_id = String(formData.get("unit_id") ?? "")
    const file = formData.get("file")

    if (!course_id || !unit_id || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan campos requeridos: course_id, unit_id, file." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 2. Ownership ─────────────────────────────────────────────────────
    const owns = await verifyCourseOwnership(serviceClient, course_id, userId)
    if (!owns) {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permiso sobre esta materia." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 3. Tamaño + contenido real (magic bytes) ────────────────────────
    if (file.size === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "El archivo está vacío." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }
    if (file.size > MAX_FILE_BYTES) {
      return new Response(
        JSON.stringify({ success: false, error: `Archivo demasiado grande (máx ${MAX_FILE_BYTES / (1024 * 1024)}MB).` }),
        { status: 413, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const fileCheck = validateFileBytesByExtension(bytes, file.name)
    if (!fileCheck.ok) {
      return new Response(
        JSON.stringify({ success: false, error: fileCheck.reason }),
        { status: 415, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 4. Resolver curso/unidad ─────────────────────────────────────────
    const { data: course } = await serviceClient
      .from("courses").select("drive_folder_id").eq("id", course_id).single()

    if (!course?.drive_folder_id) {
      return new Response(
        JSON.stringify({ success: false, error: "La materia no tiene una carpeta de Drive configurada todavía." }),
        { status: 409, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const { data: unit } = await serviceClient
      .from("course_units").select("unit_number, title").eq("id", unit_id).single()
    if (!unit) {
      return new Response(
        JSON.stringify({ success: false, error: "Unidad no encontrada." }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_URL")
    const WEBHOOK_SECRET  = Deno.env.get("APPS_SCRIPT_SECRET")
    if (!APPS_SCRIPT_URL) {
      return new Response(
        JSON.stringify({ success: false, error: "Integración con Drive no configurada (APPS_SCRIPT_URL)." }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    const callAppsScript = async (action: string, scriptPayload: Record<string, unknown>, timeoutMs: number) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: WEBHOOK_SECRET, action, payload: scriptPayload }),
          signal: controller.signal,
        })
        const json = await res.json()
        // Router.gs envuelve todo éxito como {success:true, data:<resultado>}.
        if (!json.success) return { success: false, error: json.error }
        return { success: true, ...(json.data ?? {}) }
      } finally {
        clearTimeout(timeout)
      }
    }

    // ── 5. Carpeta de la unidad (find-or-create) ─────────────────────────
    const folderRes = await callAppsScript("crearCarpetaUnidadMaterial", {
      courseFolderId: course.drive_folder_id, unitNumber: unit.unit_number, unitTitle: unit.title,
    }, 20_000)
    if (!folderRes.success || !folderRes.folderId) {
      return new Response(
        JSON.stringify({ success: false, error: folderRes.error || "No se pudo crear/encontrar la carpeta de la unidad en Drive." }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 6. Subir el archivo ──────────────────────────────────────────────
    const base64Data = btoa(String.fromCharCode(...bytes))
    const uploadRes = await callAppsScript("subirArchivoMaterial", {
      folderId: folderRes.folderId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      base64Data,
    }, 28_000)
    if (!uploadRes.success || !uploadRes.fileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: uploadRes.error || "No se pudo subir el archivo a Drive." }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 7. Registrar en materiales_boveda ────────────────────────────────
    const tipo = file.name.split(".").pop()?.toLowerCase() || file.type || "archivo"
    const { data: material, error: insertErr } = await serviceClient
      .from("materiales_boveda")
      .insert([{
        materia_id: course_id,
        unit_id,
        nombre: file.name,
        tipo,
        url: uploadRes.fileUrl,
        size: uploadRes.sizeBytes != null ? String(uploadRes.sizeBytes) : String(file.size),
        ai: false,
        es_visible: true,
      }])
      .select()
      .single()

    if (insertErr) throw insertErr

    return new Response(
      JSON.stringify({ success: true, material }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout
      ? "Timeout al subir el material."
      : err instanceof Error ? err.message : "Error interno."
    console.error("[UPLOAD_COURSE_MATERIAL]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: isTimeout ? 504 : 500, headers: { ...cors, "Content-Type": "application/json" } }
    )
  }
})
