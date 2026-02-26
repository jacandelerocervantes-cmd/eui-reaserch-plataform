import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 1. AJUSTE DE RUTA: Cambiamos /panel por /inicio (que es la que usas)
  const isDashboard = request.nextUrl.pathname.startsWith('/inicio');
  const isLoginPage = request.nextUrl.pathname === '/login';

  // 2. PROTECCIÓN: Si no hay usuario y quiere entrar a inicio, al login.
  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. ELIMINAMOS EL REBOTE AUTOMÁTICO AL LOGIN (Temporalmente)
  // Comentamos esta parte para que el Middleware NO te mande a inicio 
  // si ya estás en login. Esto te permite "limpiar" la sesión.
  /*
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/inicio', request.url));
  }
  */

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};