import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabaseServer'
import { validateFileBytesByExtension } from '@/lib/server/fileValidationServer'

// Cierra el gap documentado en SECURITY_AUDIT.md punto 20: antes, 3 flujos
// (justificantes de asistencia, captura de campo, bitácora de laboratorio)
// subían directo a Supabase Storage desde el navegador con la anon key —
// sin ningún punto de validación server-side, saltándose trivialmente la
// validación client-side (que es solo UX, ver lib/fileValidation.ts).
//
// Este endpoint es un proxy delgado: valida los bytes reales del archivo
// ANTES de subirlo, y sube usando el cliente Supabase con la sesión del
// usuario autenticado (getServerSupabase) — las mismas RLS policies de
// Storage que ya protegían cada bucket siguen aplicando tal cual, esto no
// añade ni quita permisos, solo agrega la validación que faltaba.

const ALLOWED_BUCKETS = new Set(['JUSTIFICANTES', 'campo-capturas'])
const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20MB — generoso para foto/PDF/audio corto, acota abuso obvio

export async function POST(request: Request) {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Petición inválida: se esperaba multipart/form-data.' }, { status: 400 })
  }

  const file = form.get('file')
  const bucket = form.get('bucket')
  const path = form.get('path')
  const upsert = form.get('upsert') === 'true'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo (campo 'file')." }, { status: 400 })
  }
  if (typeof bucket !== 'string' || !ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'Bucket no permitido.' }, { status: 400 })
  }
  // Bloqueo básico de path traversal — el resto de la validación de "a
  // quién le pertenece esta ruta" corre por cuenta de la RLS policy del
  // bucket (igual que antes, cuando el cliente subía directo).
  if (typeof path !== 'string' || !path || path.includes('..') || path.startsWith('/')) {
    return NextResponse.json({ error: 'Ruta de almacenamiento inválida.' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `Archivo demasiado grande (máx ${MAX_FILE_BYTES / (1024 * 1024)}MB).` }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const validation = validateFileBytesByExtension(bytes, file.name)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 415 })
  }

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, bytes, {
    upsert,
    contentType: file.type || 'application/octet-stream',
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
  return NextResponse.json({ success: true, publicUrl: urlData.publicUrl })
}
