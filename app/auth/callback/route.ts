import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Evita open-redirect: solo se acepta una ruta relativa dentro del propio
// sitio (empieza con "/" único, sin "//" ni "://" — eso descartaría algo
// como "https://sitio-falso.com" colado en el parámetro).
function isSafeNextPath(next: string | null): next is string {
  return !!next && next.startsWith('/') && !next.startsWith('//') && !next.includes('://')
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Si el usuario venía de una ruta protegida específica (proxy.ts
        // puso `next` antes de mandarlo a /login), volvemos ahí en vez del
        // destino genérico por rol — proxy.ts y los layouts vuelven a
        // validar rol/permiso en esa ruta de todos modos, así que no hay
        // riesgo de mandar a alguien a algo que no le corresponde.
        if (isSafeNextPath(next)) {
          return NextResponse.redirect(`${origin}${next}`)
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const destination = profile?.role === 'docente' ? '/inicio' : '/alumno'
        return NextResponse.redirect(`${origin}${destination}`)
      }
    }
  }

  // Código de error referenciado en el catálogo de app/login/page.tsx:
  // ERROR_CATALOG.AUTH_CODE_ERROR (clave de URL: "auth-code-error").
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}
