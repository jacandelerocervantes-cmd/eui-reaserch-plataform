import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cacheGet, cacheSet, sha256Hex } from '@/lib/server/cache'

// TTL corto (1.3.1 de docs/01_ARQUITECTURA_DEVOPS_FRUGAL.md): evita repetir
// el round-trip a Supabase Auth/Postgres en cada navegación dentro de la
// misma sesión, sin dejar una sesión revocada viva por mucho tiempo.
const SESSION_CACHE_TTL_SECONDS = 90

type CachedUser = { id: string }
type CachedProfile = { role: string | null; access_level: number | null }

/** Concatena las cookies `sb-*-auth-token*` presentes — su valor cambia en
 * login/logout/refresh, así que sirve como clave de caché sin tener que
 * parsear el formato interno (a veces "chunked") de @supabase/ssr. */
function extractAuthCookieFingerprint(request: NextRequest): string | null {
  const relevant = request.cookies
    .getAll()
    .filter((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `${c.name}=${c.value}`)
  return relevant.length ? relevant.join('|') : null
}

// ── Rutas que requieren sesión activa ─────────────────────────────────────────
const AUTH_PATHS = ['/panel', '/alumno', '/inicio', '/investigacion', '/laboratorio', '/campo', '/admin']

// ── Rutas que además requieren verificar role y/o access_level ────────────────
// /inicio entra aquí solo para sacar al alumno (ve el Sidebar de docente con
// Control Maestro IA, que no le corresponde) — el docente sigue sin cambios.
const ROLE_PATHS = ['/panel', '/alumno', '/inicio', '/investigacion', '/laboratorio', '/campo', '/admin']

// ── Cabeceras de seguridad (punto 8 de la auditoría) ──────────────────────────
// Se generan aquí (no en next.config.ts) porque el nonce de script-src tiene
// que ser distinto en cada request — next.config.ts solo puede emitir
// cabeceras estáticas.
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

const SUPABASE_ORIGIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin } catch { return '' }
})()
const SUPABASE_WS_ORIGIN = SUPABASE_ORIGIN.replace(/^http/, 'ws')

function buildCsp(nonce: string): string {
  // 'strict-dynamic' + nonce es el patrón que recomienda Next.js para App
  // Router: los scripts propios de Next (hidratación/RSC) se inyectan
  // inline y Next les aplica el nonce automáticamente al detectar esta
  // cabecera. 'strict-dynamic' además cubre el <script> que
  // @react-google-maps/api inserta dinámicamente en runtime (heredá la
  // confianza del código que lo inserta, que sí corre con nonce válido).
  // Turbopack/React en modo desarrollo necesitan eval() para HMR y stack
  // traces — nunca ocurre en producción ("React will never use eval() in
  // production mode"), así que solo se permite fuera de NODE_ENV=production.
  const devEval = process.env.NODE_ENV === 'production' ? '' : ` 'unsafe-eval'`
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    // style-src necesita 'unsafe-inline': la UI usa style={{...}} inline en
    // casi todas las páginas — pasar eso a nonce/hash sería una reescritura
    // completa de la capa visual, fuera de alcance de este hardening.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https://maps.gstatic.com https://maps.googleapis.com https://*.googleusercontent.com`,
    `font-src 'self' data:`,
    `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS_ORIGIN} https://maps.googleapis.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ')
}

function withSecurityHeaders(res: NextResponse, csp: string): NextResponse {
  res.headers.set('Content-Security-Policy', csp)
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=(), payment=()')
  // HSTS: solo tiene efecto sobre HTTPS, así que es seguro emitirlo siempre
  // (en dev sobre http el navegador lo ignora).
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  return res
}

export async function proxy(request: NextRequest) {
  const nonce = generateNonce()
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    csp
  )

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // NUNCA usar getSession() aquí — puede ser falsificado desde el cliente.
  // Caché de 90s keyed por hash del propio cookie de sesión: si el cookie
  // no cambió, evitamos el round-trip a Supabase Auth en cada navegación.
  const authFingerprint = extractAuthCookieFingerprint(request)
  const sessionCacheKey = authFingerprint ? `sess:${await sha256Hex(authFingerprint)}` : null

  let user: CachedUser | null = sessionCacheKey ? await cacheGet<CachedUser>(sessionCacheKey) : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user ? { id: data.user.id } : null
    if (user && sessionCacheKey) await cacheSet(sessionCacheKey, user, SESSION_CACHE_TTL_SECONDS)
  }
  const { pathname } = request.nextUrl

  // ── Rutas públicas — no requieren sesión ─────────────────────────────────
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/alumno/login' ||
    pathname.startsWith('/asistencia/validar') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')

  if (isPublicRoute) return response

  // ── Redirigir login + raíz si ya tiene sesión ────────────────────────────
  if (user && (pathname === '/' || pathname === '/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/inicio'
    url.search = ''
    return withSecurityHeaders(NextResponse.redirect(url), csp)
  }

  // ── Capa 1: Verificar sesión ──────────────────────────────────────────────
  const isProtected = AUTH_PATHS.some(p => pathname.startsWith(p))
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    // Determinar a qué login redirigir según la ruta intentada
    url.pathname = pathname.startsWith('/alumno') ? '/alumno/login' : '/login'
    url.searchParams.set('next', pathname)
    return withSecurityHeaders(NextResponse.redirect(url), csp)
  }

  // ── Capa 2: Verificar role y access_level en la DB ────────────────────────
  // Una sola query cubre todos los checks de esta request.
  if (user && ROLE_PATHS.some(p => pathname.startsWith(p))) {
    const profileCacheKey = `profile:${user.id}`
    let profile = await cacheGet<CachedProfile>(profileCacheKey)
    if (!profile) {
      const { data } = await supabase
        .from('profiles')
        .select('role, access_level')
        .eq('id', user.id)
        .single()
      profile = data
      if (profile) await cacheSet(profileCacheKey, profile, SESSION_CACHE_TTL_SECONDS)
    }

    // Sin perfil → sesión corrupta o incompleta.
    // Código de error referenciado en app/login/page.tsx:
    // ERROR_CATALOG.PROFILE_MISSING (clave de URL: "profile_missing").
    if (!profile) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'profile_missing')
      return withSecurityHeaders(NextResponse.redirect(url), csp)
    }

    const role  = profile.role ?? null
    // access_level null → nivel más restrictivo (99)
    const level = profile.access_level ?? 99

    const redirectHome = (dest = '/inicio') => {
      const url = request.nextUrl.clone()
      url.pathname = dest
      url.search = ''
      return withSecurityHeaders(NextResponse.redirect(url), csp)
    }

    // /inicio → el alumno no entra aquí (es el Hub de docente/investigación,
    // con su propio Sidebar y Control Maestro IA); se va a su propio Hub.
    if (pathname.startsWith('/inicio')) {
      if (role === 'alumno') return redirectHome('/alumno')
    }

    // /panel → solo docentes (cualquier nivel)
    if (pathname.startsWith('/panel')) {
      if (role !== 'docente') return redirectHome()
    }

    // /alumno → solo alumnos
    if (pathname.startsWith('/alumno')) {
      if (role !== 'alumno') return redirectHome()
    }

    // /investigacion → docente con access_level 1 ó 2
    if (pathname.startsWith('/investigacion')) {
      if (role !== 'docente' || level > 2) return redirectHome()
    }

    // /laboratorio → solo docente con access_level 1
    if (pathname.startsWith('/laboratorio')) {
      if (role !== 'docente' || level !== 1) return redirectHome()
    }

    // /campo → solo docente con access_level 1
    if (pathname.startsWith('/campo')) {
      if (role !== 'docente' || level !== 1) return redirectHome()
    }

    // /admin → solo administradores — hoy nadie tiene este rol todavía
    if (pathname.startsWith('/admin')) {
      if (role !== 'admin') return redirectHome()
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
