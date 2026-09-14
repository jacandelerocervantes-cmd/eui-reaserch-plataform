import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const buildCorsHeaders = () => ({
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
})

serve(async (req) => {
  const cors = buildCorsHeaders()
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    // Requerir sesión activa del alumno
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Se requiere sesión' }), { status: 401, headers: cors })
    }

    const anonSb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user }, error: userErr } = await anonSb.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: cors })
    }

    const body = await req.json()
    const { token_invitacion, accion } = body

    if (!token_invitacion) {
      return new Response(JSON.stringify({ error: 'Falta token_invitacion' }), { status: 400, headers: cors })
    }
    if (accion && !['aceptar', 'rechazar', 'preview'].includes(accion)) {
      return new Response(JSON.stringify({ error: 'accion inválida' }), { status: 400, headers: cors })
    }

    // Usar service role para leer por token (bypass RLS — el alumno_id aún es null)
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: inv } = await service
      .from('proyecto_colaboradores')
      .select(`
        id,
        correo_invitado,
        rol,
        status,
        expira_en,
        alumno_id,
        proyecto_id,
        proyectos_investigacion (titulo, descripcion)
      `)
      .eq('token_invitacion', token_invitacion)
      .single()

    if (!inv) {
      return new Response(JSON.stringify({ error: 'Invitación no encontrada o token inválido' }), { status: 404, headers: cors })
    }

    // Validar que el correo de la sesión coincide con el invitado
    if (user.email?.toLowerCase() !== inv.correo_invitado.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Esta invitación no corresponde a tu cuenta de correo' }), { status: 403, headers: cors })
    }

    // Para preview: retornar detalles sin modificar nada
    if (!accion || accion === 'preview') {
      return new Response(JSON.stringify({
        ok: true,
        invitacion: {
          status: inv.status,
          rol: inv.rol,
          expira_en: inv.expira_en,
          expirada: new Date(inv.expira_en) < new Date(),
          proyecto: inv.proyectos_investigacion,
        },
      }), { headers: cors })
    }

    // A partir de aquí se requiere que la invitación esté pendiente
    if (inv.status !== 'pendiente') {
      return new Response(JSON.stringify({ error: 'Esta invitación ya fue procesada', status: inv.status }), { status: 409, headers: cors })
    }
    if (new Date(inv.expira_en) < new Date()) {
      return new Response(JSON.stringify({ error: 'La invitación ha expirado' }), { status: 410, headers: cors })
    }

    const nuevoStatus = accion === 'aceptar' ? 'activo' : 'rechazado'
    const { error: updErr } = await service
      .from('proyecto_colaboradores')
      .update({
        status: nuevoStatus,
        alumno_id: accion === 'aceptar' ? user.id : null,
        aceptado_en: accion === 'aceptar' ? new Date().toISOString() : null,
      })
      .eq('id', inv.id)

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: cors })
    }

    return new Response(JSON.stringify({
      ok: true,
      status: nuevoStatus,
      proyecto_id: inv.proyecto_id,
    }), { headers: cors })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: cors })
  }
})
