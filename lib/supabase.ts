import { createBrowserClient } from '@supabase/ssr'

// Evitamos que se creen múltiples clientes en el navegador
let supabaseInstance: any = null;

export const supabase = (() => {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return supabaseInstance;
})();

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks.readonly',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent select_account', // ESTO ES LO QUE TE SALVA DEL BUCLE
      },
    },
  })
  if (error) throw error
}

export const signOut = async () => {
  await supabase.auth.signOut()
  localStorage.clear()
  window.location.href = '/login'
}