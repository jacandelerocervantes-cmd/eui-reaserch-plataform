'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  School, MessageSquare,
  MessageSquareShare, Cloud, NotebookPen, LineChart, UserCheck,
  ClipboardCheck, ArrowLeft, LogOut, Settings
} from 'lucide-react';
import { signOut } from '@/lib/supabase';
import styles from '@/components/layout/Sidebar.module.css';

const ICON_SIZE = 24;

export default function AlumnoSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const courseMatch = pathname.match(/^\/alumno\/materia\/([^/]+)/);
  const courseId = courseMatch?.[1];
  const inCourse = Boolean(courseMatch);

  const activeColor = "#3b82f6";

  const courseTools = courseId ? [
    { name: 'Tablón',         icon: <MessageSquareShare size={20} />, path: `/alumno/materia/${courseId}` },
    { name: 'Material',       icon: <Cloud size={20} />,              path: `/alumno/materia/${courseId}/material` },
    { name: 'Actividades',    icon: <NotebookPen size={20} />,        path: `/alumno/materia/${courseId}/actividades` },
    { name: 'Evaluaciones',   icon: <ClipboardCheck size={20} />,     path: `/alumno/materia/${courseId}/evaluaciones` },
    { name: 'Calificaciones', icon: <LineChart size={20} />,          path: `/alumno/materia/${courseId}/calificaciones` },
    { name: 'Asistencia',     icon: <UserCheck size={20} />,          path: `/alumno/materia/${courseId}/asistencia` },
  ] : [];

  const globalModules = [
    { name: 'Mis Clases', icon: <School size={ICON_SIZE} />, path: '/alumno', color: '#3b82f6', rootMatch: '/alumno' },
    { name: 'Comunidad',  icon: <MessageSquare size={ICON_SIZE} />, path: '/alumno/comunicacion', color: '#64748b', rootMatch: '/alumno/comunicacion' },
  ];

  // Regla Anti-Espejo
  const visibleGlobalModules = globalModules.filter(m => {
    if (m.path === '/alumno') return !inCourse && pathname !== '/alumno';
    return !pathname.startsWith(m.rootMatch);
  });

  const filteredCourseTools = courseTools.filter(tool => tool.path !== pathname);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error logout:', error);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.scrollContainer}>
        <nav className={styles.nav}>
          {/* BLOQUE CONTEXTUAL DE LA MATERIA */}
          {inCourse && (
            <>
              <Link href="/alumno" className={styles.itemWrapper} title="Volver a Mis Clases">
                <div className={styles.icon} style={{ backgroundColor: "#f1f5f9", border: `1.5px solid ${activeColor}` }}>
                  <ArrowLeft size={20} color="#1B396A" />
                </div>
                <span className={styles.label} style={{ fontWeight: 'bold' }}>Volver a Mis Clases</span>
              </Link>

              {filteredCourseTools.map((tool, index) => (
                <Link key={`course-tool-${index}`} href={tool.path} className={styles.itemWrapper} title={tool.name}>
                  <div className={styles.icon} style={{ color: activeColor }}>
                    {tool.icon}
                  </div>
                  <span className={styles.label}>{tool.name}</span>
                </Link>
              ))}

              <div className={styles.separator} />
            </>
          )}

          {/* BLOQUE GLOBAL */}
          {visibleGlobalModules.map((module, index) => (
            <Link key={`global-${index}`} href={module.path} className={styles.itemWrapper} title={module.name}>
              <div className={styles.icon} style={{ color: "#64748b", opacity: 0.8 }}>
                {module.icon}
              </div>
              <span className={styles.label}>{module.name}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* FOOTER */}
      <div className={styles.footer}>
        <div className={styles.separator} />
        
        <Link href="/configuracion" className={styles.itemWrapper} title="Ajustes">
          <div className={styles.icon} style={{ color: "#64748b" }}><Settings size={ICON_SIZE} /></div>
          <span className={styles.label}>Ajustes</span>
        </Link>

        <button onClick={handleLogout} className={styles.itemWrapper} title="Cerrar Sesión" style={{ background: "none", border: "none", cursor: "pointer", marginTop: '0.8rem' }}>
          <div className={styles.icon} style={{ color: "#ef4444" }}><LogOut size={ICON_SIZE} /></div>
          <span className={styles.label}>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}


