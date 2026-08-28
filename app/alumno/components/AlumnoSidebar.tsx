'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  BookOpen, MessageSquare, LayoutDashboard,
  MessageSquareShare, Cloud, ClipboardList, GraduationCap, UserCheck, ArrowLeft, LogOut
} from 'lucide-react';
import { signOut } from '@/lib/supabase';
import styles from './AlumnoSidebar.module.css';

// Investigación/Laboratorio/Campo NO van aquí por defecto — son módulos de
// docente (con access_level), no del rol alumno. Si en el futuro un alumno
// es invitado a un proyecto específico, esa entrada debe salir del flujo de
// invitación, no de la navegación global del alumno.
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Hub Global', href: '/alumno' },
  { icon: MessageSquare,   label: 'Comunidad',  href: '/alumno/comunicacion' },
];

export default function AlumnoSidebar() {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();

  // Sub-navegación contextual cuando estás dentro de una materia — mismo
  // espíritu que el sidebar del docente (Tablón/Material/Actividades/...).
  const courseMatch = pathname.match(/^\/alumno\/materia\/([^/]+)/);
  const courseId = courseMatch?.[1] ?? params?.id;
  const inCourse = !!courseMatch;

  const courseTools = courseId ? [
    { icon: MessageSquareShare, label: 'Tablón',         href: `/alumno/materia/${courseId}` },
    { icon: Cloud,              label: 'Material',       href: `/alumno/materia/${courseId}/material` },
    { icon: ClipboardList,      label: 'Actividades',    href: `/alumno/materia/${courseId}/actividades` },
    { icon: BookOpen,           label: 'Evaluaciones',   href: `/alumno/materia/${courseId}/evaluaciones` },
    { icon: GraduationCap,      label: 'Calificaciones', href: `/alumno/materia/${courseId}/calificaciones` },
    { icon: UserCheck,          label: 'Asistencia',     href: `/alumno/materia/${courseId}/asistencia` },
  ] : [];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.scrollContainer}>
        <nav className={styles.nav}>
          {inCourse && (
            <>
              <Link href="/alumno" className={styles.itemWrapper} title="Volver al Hub">
                <div className={styles.icon}><ArrowLeft size={20} /></div>
                <span className={styles.label}>Volver al Hub</span>
              </Link>

              {courseTools.map(({ icon: Icon, label, href }) => (
                <Link key={href} href={href} className={styles.itemWrapper} title={label}>
                  <div className={styles.icon} style={pathname === href ? { background: '#1B396A', color: 'white' } : undefined}>
                    <Icon size={20} />
                  </div>
                  <span className={styles.label}>{label}</span>
                </Link>
              ))}

              <div className={styles.separator} />
            </>
          )}

          {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
            const isActive = pathname === href || (href !== '/alumno' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={styles.itemWrapper} title={label}>
                <div className={styles.icon} style={isActive ? { background: '#1B396A', color: 'white' } : undefined}>
                  <Icon size={20} />
                </div>
                <span className={styles.label}>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className={styles.footer}>
        <div className={styles.separator} />
        <button onClick={signOut} className={styles.itemWrapper} title="Cerrar Sesión">
          <div className={styles.icon} style={{ color: '#ef4444' }}><LogOut size={20} /></div>
          <span className={styles.label}>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
