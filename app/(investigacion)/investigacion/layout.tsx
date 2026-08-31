import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

// Segunda capa de defensa: middleware ya verificó sesión y role+level,
// este Server Component lo confirma antes de renderizar cualquier hijo.
// Acceso: role=docente + access_level 1 ó 2.
export default async function InvestigacionLayout({ children }: { children: React.ReactNode }) {
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

  if (!profile || profile.role !== 'docente' || (profile.access_level ?? 99) > 2) {
    redirect('/inicio')
  }

  return (
    <div style={{ display: 'flex', width: '100%', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '80px', minWidth: 0 }}>
        <Header />
        <main style={{ flex: 1, position: 'relative', width: '100%' }}>
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}

