import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import AlumnoSidebar from './components/AlumnoSidebar'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default async function AlumnoLayout({ children }: { children: React.ReactNode }) {
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
  if (!user) redirect('/alumno/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'alumno') redirect('/alumno/login')

  // Sin inscripción en ninguna materia (tabla students) → sin acceso, aunque
  // el rol ya sea 'alumno'. ilike en vez de eq: el correo del roster puede
  // tener mayúsculas distintas a como Google devuelve el email de la sesión.
  const { data: enrollment } = await supabase
    .from('students')
    .select('id')
    .ilike('correo', user.email ?? '')
    .limit(1)
    .maybeSingle()

  // Código de error referenciado en app/login/page.tsx:
  // ERROR_CATALOG.SIN_MATERIA (clave de URL: "sin_materia").
  if (!enrollment) redirect('/alumno/login?error=sin_materia')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        <AlumnoSidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: '80px', minWidth: 0 }}>
          <main style={{ flex: 1, padding: '30px 40px', width: '100%', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box' }}>
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}

