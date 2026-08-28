import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { isValidQrSignature } from "../_shared/hmac.ts"

// Endpoint público: seguridad basada en hash QR firmado (HMAC) + geocerca +
// rate limiting, no en origen (por eso CORS abierto — cualquier navegador
// que escanee el QR llega desde un origen distinto).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 300; // 5 minutos

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { hash, sig, matricula, lat, lng } = await req.json()
    const logPrefix = `[${matricula}]`;

    console.log(`${logPrefix} Intentando registro con hash: ${hash}`);

    // 0. Verificar firma HMAC del hash — si no coincide, el hash no salió
    // de la ruta server-side que genera el QR (fue adivinado/forjado).
    const secret = Deno.env.get('QR_HMAC_SECRET') ?? '';
    if (!(await isValidQrSignature(secret, hash ?? '', sig ?? ''))) {
      console.error(`${logPrefix} ERROR: Firma inválida.`);
      return new Response(JSON.stringify({ success: false, error_code: 'INVALID_SIGNATURE' }), { headers: corsHeaders });
    }

    // 1. Validar sesión activa y hash
    const { data: session, error: sErr } = await supabase
      .from('insitu_sessions')
      .select('id, course_id, is_active, expires_at, session_number')
      .eq('qr_hash', hash)
      .single();

    if (sErr || !session) {
      console.error(`${logPrefix} ERROR: Hash no encontrado.`);
      return new Response(JSON.stringify({ success: false, error_code: 'HASH_EXPIRED' }), { headers: corsHeaders });
    }

    // Validar expiración por tiempo o si el docente ya cerró el radar
    const now = new Date();
    const expiration = new Date(session.expires_at);
    if (!session.is_active || now > expiration) {
      console.error(`${logPrefix} ERROR: Sesión cerrada o expirada.`);
      return new Response(JSON.stringify({ success: false, error_code: 'HASH_EXPIRED' }), { headers: corsHeaders });
    }

    // 2. Rate limiting — máximo intentos por matrícula dentro del curso,
    // independiente de cuántas veces rote el hash del QR.
    const { data: allowed, error: rlErr } = await supabase.rpc('check_and_bump_attendance_rate_limit', {
      p_key: `${session.course_id}:${matricula?.trim().toUpperCase() ?? ''}`,
      p_max_attempts: RATE_LIMIT_MAX_ATTEMPTS,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (rlErr) {
      console.error(`${logPrefix} ERROR rate limit:`, JSON.stringify(rlErr));
      throw rlErr;
    }
    if (allowed === false) {
      console.error(`${logPrefix} ERROR: Rate limit excedido.`);
      return new Response(JSON.stringify({ success: false, error_code: 'RATE_LIMITED' }), { headers: corsHeaders });
    }

    // 3. Validar Geocerca (Usando nombres de columna en inglés de tu esquema)
    const { data: geo } = await supabase
      .from('course_geofences')
      .select('latitude, longitude, radius_meters')
      .eq('course_id', session.course_id)
      .maybeSingle();

    // Distancia real (Haversine) y desfase de horario — antes se calculaban
    // solo para decidir pase/rechazo y se descartaban. Se persisten ahora
    // (requiere supabase/pendiente/008_attendance_metadata.sql) para
    // habilitar análisis de puntualidad/patrones de abuso en
    // compute-student-risk-signals, sin cambiar la lógica de aceptación.
    let geoDistanceMeters: number | null = null;
    // Ventana fija del radar (useAsistencia.ts: startRadar arranca con
    // timeLeft=300s) — el inicio real de la sesión es expires_at - 300s, ya
    // que insitu_sessions no trae una columna de inicio explícita.
    const SESSION_WINDOW_SECONDS = 300;
    const sessionStart = new Date(expiration.getTime() - SESSION_WINDOW_SECONDS * 1000);
    const scanOffsetSeconds = Math.max(0, Math.round((now.getTime() - sessionStart.getTime()) / 1000));

    if (geo) {
      const R = 6371e3; // Radio de la Tierra en metros
      const dLat = (geo.latitude - lat) * Math.PI / 180;
      const dLon = (geo.longitude - lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat * Math.PI / 180) * Math.cos(geo.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      geoDistanceMeters = Math.round(distance * 100) / 100;

      if (distance > geo.radius_meters) {
        console.error(`${logPrefix} ERROR_GEO: Distancia ${distance.toFixed(1)}m fuera de rango.`);
        return new Response(JSON.stringify({ success: false, error_code: 'GEO_OUT' }), { headers: corsHeaders });
      }
    }

    // 4. Obtener ID del alumno inscrito
    const { data: student, error: stErr } = await supabase
      .from('students')
      .select('id')
      .eq('course_id', session.course_id)
      .eq('matricula', matricula.trim().toUpperCase())
      .single();

    if (stErr || !student) {
      console.error(`${logPrefix} ERROR: Alumno no encontrado.`);
      return new Response(JSON.stringify({ success: false, error_code: 'STUDENT_NOT_FOUND' }), { headers: corsHeaders });
    }

    // 5. Registrar asistencia — upsert para tolerar doble escaneo
    const sessionDate = new Date().toISOString().split('T')[0];
    const { error: insErr } = await supabase
      .from('validated_attendances')
      .upsert({
        session_id:     session.id,
        course_id:      session.course_id,
        student_id:     student.id,
        session_number: session.session_number,
        session_date:   sessionDate,
        status:         1,
        source:         'qr_scan',
        geo_distance_meters: geoDistanceMeters,
        scan_offset_seconds: scanOffsetSeconds,
      }, { onConflict: 'session_id, student_id', ignoreDuplicates: false });

    if (insErr) {
      console.error(`${logPrefix} Error insertando asistencia:`, JSON.stringify(insErr));
      throw insErr;
    }

    console.log(`${logPrefix} Registro exitoso.`);
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err) {
    console.error(`ERROR CRÍTICO:`, err);
    return new Response(JSON.stringify({ success: false, error_code: 'INTERNAL_ERROR' }), { headers: corsHeaders, status: 500 });
  }
})
