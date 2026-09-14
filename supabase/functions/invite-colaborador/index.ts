import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const buildCorsHeaders = () => ({
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
})

async function verifyDocente(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) throw new Error('No token')
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error } = await sb.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return { user, sb }
}

const ROL_LABEL: Record<string, string> = {
  capturista: 'Capturista de datos',
  lector: 'Lector',
  analista: 'Analista',
}

serve(async (req) => {
  const cors = buildCorsHeaders()
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const { user, sb } = await verifyDocente(req)
    const { proyecto_id, correo_invitado, rol } = await req.json()

    if (!proyecto_id || !correo_invitado || !rol) {
      return new Response(JSON.stringify({ error: 'Faltan campos: proyecto_id, correo_invitado, rol' }), { status: 400, headers: cors })
    }
    if (!['capturista', 'lector', 'analista'].includes(rol)) {
      return new Response(JSON.stringify({ error: 'rol inválido' }), { status: 400, headers: cors })
    }

    // Verificar que el docente es el investigador principal del proyecto
    const { data: proyecto } = await sb
      .from('proyectos_investigacion')
      .select('id, titulo, investigador_principal_id')
      .eq('id', proyecto_id)
      .single()

    if (!proyecto || proyecto.investigador_principal_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Sin autorización sobre este proyecto' }), { status: 403, headers: cors })
    }

    // Crear/actualizar invitación con service role (bypass RLS para INSERT)
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const expira_en = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: inv, error: invErr } = await service
      .from('proyecto_colaboradores')
      .upsert(
        {
          proyecto_id,
          correo_invitado: correo_invitado.toLowerCase().trim(),
          rol,
          invitado_por: user.id,
          status: 'pendiente',
          expira_en,
        },
        { onConflict: 'proyecto_id,correo_invitado' }
      )
      .select('token_invitacion')
      .single()

    if (invErr || !inv) {
      return new Response(JSON.stringify({ error: invErr?.message ?? 'Error creando invitación' }), { status: 500, headers: cors })
    }

    // Obtener nombre del docente
    const { data: profile } = await service
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()
    const nombreDocente = profile
      ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
      : 'Un docente'

    const appUrl = Deno.env.get('APP_URL') ?? ''
    const link = `${appUrl}/alumno/invitacion?token=${inv.token_invitacion}`

    const emailBody = `Hola,

Has sido invitado/a a colaborar en un proyecto de investigación:

  Proyecto: ${proyecto.titulo}
  Investigador principal: ${nombreDocente}
  Tu rol: ${ROL_LABEL[rol] ?? rol}

Para aceptar la invitación ingresa al siguiente enlace (válido por 7 días):

${link}

Si no solicitaste esta invitación puedes ignorar este correo.

— Plataforma EUI Research`

    // Enviar correo vía Apps Script (GmailApp)
    const scriptUrl = Deno.env.get('APPS_SCRIPT_URL')
    if (scriptUrl) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 25000)
      try {
        await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: Deno.env.get('APPS_SCRIPT_SECRET'),
            action: 'sendEmail',
            payload: {
              to: correo_invitado,
              subject: `Invitación al proyecto: ${proyecto.titulo}`,
              body: emailBody,
            },
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
    }

    return new Response(
      JSON.stringify({ ok: true, correo_invitado }),
      { headers: cors }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: cors })
  }
})
