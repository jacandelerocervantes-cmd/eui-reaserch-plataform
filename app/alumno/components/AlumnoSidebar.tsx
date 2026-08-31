'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  MessageSquare, LayoutDashboard,
  MessageSquareShare, Cloud, NotebookPen, LineChart, UserCheck,
  ClipboardCheck, ArrowLeft, LogOut, Settings
} from 'lucide-react';
import { signOut } from '@/lib/supabase';
import styles from './AlumnoSidebar.module.css';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Hub Global', href: '/alumno' },
  { icon: MessageSquare,   label: 'Comunidad',  href: '/alumno/comunicacion' },
];

export default function AlumnoSidebar() {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();

  const courseMatch = pathname.match(/^\/alumno\/materia\/([^/]+)/);
  const courseId = courseMatch?.[1] ?? params?.id;
  const inCourse = !!courseMatch;

  const courseTools = courseId ? [
    { icon: MessageSquareShare, label: 'Tablón',         href: `/alumno/materia/${courseId}` },
    { icon: Cloud,              label: 'Material',       href: `/alumno/materia/${courseId}/material` },
    { icon: NotebookPen,        label: 'Actividades',    href: `/alumno/materia/${courseId}/actividades` },
    { icon: ClipboardCheck,     label: 'Evaluaciones',   href: `/alumno/materia/${courseId}/evaluaciones` },
    { icon: LineChart,          label: 'Calificaciones', href: `/alumno/materia/${courseId}/calificaciones` },
    { icon: UserCheck,          label: 'Asistencia',     href: `/alumno/materia/${courseId}/asistencia` },
  ] : [];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.scrollContainer}>
        <nav className={styles.nav}>
          {inCourse && (
            <>
              <Link href="/alumno" className={styles.itemWrapper} title="Volver al Hub">
                <div className={styles.icon} style={{ backgroundColor: "#f1f5f9", border: "1.5px solid #3b82f6" }}>
                  <ArrowLeft size={20} color="#1B396A" />
                </div>
                <span className={styles.label} style={{ fontWeight: 'bold' }}>Volver al Hub</span>
              </Link>

              {courseTools.map(({ icon: Icon, label, href }) => {
                const isActive = pathname === href;
                return (
                  <Link key={href} href={href} className={styles.itemWrapper} title={label}>
                    <div
                      className={styles.icon}
                      style={isActive ? { backgroundColor: '#1B396A', color: 'white', boxShadow: '0 4px 12px rgba(27,57,106,0.25)' } : undefined}
                    >
                      <Icon size={20} />
                    </div>
                    <span className={styles.label}>{label}</span>
                  </Link>
                );
              })}

              <div className={styles.separator} />
            </>
          )}

          {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
            const isActive = pathname === href;
            return (
              <Link key={href} href={href} className={styles.itemWrapper} title={label}>
                <div
                  className={styles.icon}
                  style={isActive ? { backgroundColor: '#1B396A', color: 'white', boxShadow: '0 4px 12px rgba(27,57,106,0.25)' } : undefined}
                >
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
        <Link href="/alumno/perfil" className={styles.itemWrapper} title="Mi Perfil">
          <div className={styles.icon} style={{ color: "#64748b" }}><Settings size={20} /></div>
          <span className={styles.label}>Mi Perfil</span>
        </Link>
        <button onClick={signOut} className={styles.itemWrapper} title="Cerrar Sesión" style={{ marginTop: '0.8rem' }}>
          <div className={styles.icon} style={{ color: '#ef4444' }}><LogOut size={20} /></div>
          <span className={styles.label}>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}

