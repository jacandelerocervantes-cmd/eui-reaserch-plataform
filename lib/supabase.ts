import { createBrowserClient } from '@supabase/ssr'

// Cliente de Supabase para el navegador (Client Components)
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Inicia sesión con Google usando OAuth.
 * Esta función redirige al usuario a la pantalla de selección de cuenta de Google.
 */
export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Esta URL debe estar configurada en el Dashboard de Supabase (Auth > URL Configuration)
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    console.error("Error al iniciar sesión con Google:", error.message)
    throw error
  }
}

/**
 * Cierra la sesión del usuario y limpia las cookies de autenticación.
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error("Error al cerrar sesión:", error.message)
  }
}