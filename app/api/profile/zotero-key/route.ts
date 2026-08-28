import { NextResponse } from 'next/server'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { getServerSupabase } from '@/lib/supabaseServer'

// profiles.zotero_api_key es una credencial real de un servicio externo —
// se cifra en reposo (AES-256-GCM) con una clave que solo existe en el
// servidor (PROFILE_ENCRYPTION_KEY, sin prefijo NEXT_PUBLIC_). Antes se
// leía/escribía directo desde el navegador vía el cliente Supabase, en
// texto plano, pese a que la UI le decía al usuario "tus claves se guardan
// cifradas" (app/(investigacion)/investigacion/config/page.tsx).
const ENC_PREFIX = 'enc:v1:'

function getKey(): Buffer {
  const secret = process.env.PROFILE_ENCRYPTION_KEY
  if (!secret) throw new Error('PROFILE_ENCRYPTION_KEY no configurado')
  const key = Buffer.from(secret, 'hex')
  if (key.length !== 32) throw new Error('PROFILE_ENCRYPTION_KEY debe ser 32 bytes en hex (openssl rand -hex 32)')
  return key
}

function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${ENC_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`
}

// Valores guardados antes de este cambio quedaron en texto plano — se
// devuelven tal cual (y se re-guardan cifrados en el próximo GET) en vez de
// fallar, para no perder la key que el usuario ya había configurado.
function decrypt(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored
  const [ivB64, tagB64, dataB64] = stored.slice(ENC_PREFIX.length).split(':')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
}

async function getAuthedUser(supabase: Awaited<ReturnType<typeof getServerSupabase>>) {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const supabase = await getServerSupabase()
  const user = await getAuthedUser(supabase)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select('zotero_user_id, zotero_api_key')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: 'No se pudo leer el perfil' }, { status: 500 })

  const rawKey = data?.zotero_api_key ?? ''
  const wasLegacyPlaintext = !!rawKey && !rawKey.startsWith(ENC_PREFIX)
  const zoteroApiKey = rawKey ? decrypt(rawKey) : ''

  // Migración perezosa: la primera vez que se lee una key vieja en texto
  // plano, se re-guarda cifrada — sin bloquear la respuesta al usuario.
  if (wasLegacyPlaintext) {
    supabase.from('profiles').update({ zotero_api_key: encrypt(zoteroApiKey) }).eq('id', user.id)
      .then(({ error: e }) => { if (e) console.error('[zotero-key] migración perezosa falló:', e) })
  }

  return NextResponse.json({ zotero_user_id: data?.zotero_user_id ?? '', zotero_api_key: zoteroApiKey })
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase()
  const user = await getAuthedUser(supabase)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { zotero_user_id, zotero_api_key } = await request.json()

  const { error } = await supabase
    .from('profiles')
    .update({
      zotero_user_id: zotero_user_id ?? null,
      zotero_api_key: zotero_api_key ? encrypt(zotero_api_key) : null,
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
