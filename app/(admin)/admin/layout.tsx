import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import AdminSidebar from './components/AdminSidebar'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/login')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        <AdminSidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '80px', minWidth: 0 }}>
          <main style={{ flex: 1, position: 'relative', width: '100%', padding: '2.5rem' }}>
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}


