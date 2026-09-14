'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AlumnoCourseCard from './components/AlumnoCourseCard';
import styles from './alumno.module.css';

type Course = { id: string; title: string };

export default function HubGlobalAlumno() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/alumno/login'); return; }

        const { data: studentRecords, error: fetchError } = await supabase
          .from('students')
          .select('course_id, courses(id, title)')
          .ilike('correo', user.email ?? '');

        if (fetchError) throw fetchError;

        const list: Course[] = (studentRecords as { courses: Course | null }[] ?? [])
          .map((rec) => rec.courses)
          .filter((c: Course | null): c is Course => c !== null);
        setCourses(list);
      } catch (err) {
        console.error('Error cargando materias:', err);
        setError('No se pudieron cargar tus materias. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  return (
    <div className={styles.pageContainer}>
      <main className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <h2 className={styles.pageTitle}>Mis Materias</h2>
            <p className={styles.pageSubtitle}>Selecciona una materia para entrar.</p>
          </div>
        </header>

        {loading && <div className={styles.emptyState}>Cargando materias...</div>}

        {!loading && error && (
          <div className={styles.emptyState} style={{ color: '#ef4444' }}>{error}</div>
        )}

        {!loading && !error && courses.length === 0 && (
          <div className={styles.emptyState}>
            <p>Tu correo no está inscrito en ninguna materia todavía. Contacta a tu docente.</p>
          </div>
        )}

        {!loading && !error && courses.length > 0 && (
          <div className={styles.cardsGrid}>
            {courses.map((course) => (
              <AlumnoCourseCard key={course.id} id={course.id} title={course.title} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
