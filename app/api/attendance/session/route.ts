import { NextResponse } from 'next/server'
import { createHmac } from 'node:crypto'
import { getServerSupabase } from '@/lib/supabaseServer'

// Firma el hash del QR con un secreto que solo existe en el servidor
// (QR_HMAC_SECRET, sin prefijo NEXT_PUBLIC_). register-attendance recalcula
// la misma firma antes de aceptar un registro — un hash sin firma válida
// no pudo salir de esta ruta, así que no sirve aunque se filtre o se adivine.
function signHash(hash: string): string {
  const secret = process.env.QR_HMAC_SECRET
  if (!secret) throw new Error('QR_HMAC_SECRET no configurado')
  return createHmac('sha256', secret).update(hash).digest('hex')
}

async function assertOwnsCourse(supabase: Awaited<ReturnType<typeof getServerSupabase>>, courseId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .eq('teacher_id', user.id)
    .maybeSingle()
  return course ? user : null
}

// Inicia el radar: crea la sesión y devuelve el primer hash firmado.
export async function POST(request: Request) {
  const supabase = await getServerSupabase()
  const { courseId, sessionNumber, unitNumber } = await request.json()

  if (!(await assertOwnsCourse(supabase, courseId))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const hash = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('insitu_sessions')
    .insert({
      course_id: courseId,
      qr_hash: hash,
      session_number: sessionNumber,
      expires_at: expiresAt,
      is_active: true,
      unit_number: unitNumber ?? 1,
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo iniciar la sesión' }, { status: 500 })
  }

  return NextResponse.json({ sessionId: data.id, hash, sig: signHash(hash), expiresAt })
}

// Rota el hash de una sesión activa (llamado cada 40s desde el panel docente).
export async function PATCH(request: Request) {
  const supabase = await getServerSupabase()
  const { sessionId, courseId } = await request.json()

  if (!(await assertOwnsCourse(supabase, courseId))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const hash = crypto.randomUUID()
  const { error } = await supabase
    .from('insitu_sessions')
    .update({ qr_hash: hash })
    .eq('id', sessionId)
    .eq('course_id', courseId)

  if (error) {
    return NextResponse.json({ error: 'No se pudo rotar el código' }, { status: 500 })
  }

  return NextResponse.json({ hash, sig: signHash(hash) })
}
