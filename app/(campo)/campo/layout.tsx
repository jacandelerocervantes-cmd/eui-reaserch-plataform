import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Sidebar from '@/components/layout/Sidebar'

// Segunda capa de defensa: middleware ya verificó sesión y role+level,
// este Server Component lo confirma antes de renderizar cualquier hijo.
// Acceso: role=docente + access_level 1 (acceso completo).
export default async function CampoLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, access_level')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'docente' || profile.access_level !== 1) {
    redirect('/inicio')
  }

  return (
    <div style={{ display: 'flex', width: '100%', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: '80px', width: 'calc(100% - 80px)', position: 'relative' }}>
        {children}
      </main>
    </div>
  )
}
