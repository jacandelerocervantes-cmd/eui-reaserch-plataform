import { createBrowserClient } from '@supabase/ssr'

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder';

export const supabase = (() => {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    )
  }

  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    )
  }
  return supabaseInstance;
})();

export const signInWithGoogle = async (next?: string) => {
  // Si venimos de proxy.ts (intentó entrar a una ruta protegida sin sesión),
  // `next` viaja como query param del propio redirectTo — Supabase lo
  // conserva y solo agrega `code` al volver, así que auth/callback/route.ts
  // puede leerlo desde ahí y mandar al usuario a donde iba en vez de siempre
  // caer en /inicio o /alumno.
  const redirectTo = next
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${window.location.origin}/auth/callback`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent select_account',
      },
    },
  })
  if (error) throw error
}

export const signOut = async () => {
  await supabase.auth.signOut()
  localStorage.clear()
  // Recarga completa deliberada (no router.push): tras signOut() se quiere
  // descartar por completo el estado en memoria de la app, no solo navegar
  // — esta función además vive fuera de un componente, sin acceso a
  // useRouter().
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = '/login'
}
