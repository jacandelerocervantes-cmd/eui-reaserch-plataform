import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export type Aviso = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

export type FeedItem =
  | { tipo: 'aviso'; id: string; title: string; content: string; created_at: string }
  | { tipo: 'actividad'; id: string; title: string; deadline: string | null; created_at: string }
  | { tipo: 'examen'; id: string; title: string; status: string; created_at: string };

export type FetchResult =
  | { kind: "ok"; courseName: string; avisos: Aviso[]; feedItems: FeedItem[]; allowStudentComments: boolean; studentName: string }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchTablon(
  courseId: string,
  router: ReturnType<typeof useRouter>,
  _reloadKey: number
): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/alumno/login'); return { kind: "redirect" }; }

    const { data: studentRec } = await supabase
      .from('students')
      .select('id, nombres, apellido_paterno, courses(title, allow_student_comments)')
      .ilike('correo', user.email ?? '')
      .eq('course_id', courseId)
      .maybeSingle();

    if (!studentRec) { router.push('/alumno'); return { kind: "redirect" }; }
    const courseObj = (studentRec as unknown as { courses: { title: string; allow_student_comments?: boolean } | null }).courses;
    const courseName = courseObj?.title ?? 'Materia';
    const allowStudentComments = courseObj?.allow_student_comments ?? true;
    const studentName = `${(studentRec as { nombres?: string }).nombres || ''} ${(studentRec as { apellido_paterno?: string }).apellido_paterno || ''}`.trim() || 'Alumno';

    const { data: avisosData } = await supabase
      .from('course_announcements')
      .select('id, title, content, created_at')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });
    const avisosList: Aviso[] = avisosData ?? [];

    const { data: unitsData } = await supabase
      .from('course_units').select('id').eq('course_id', courseId);
    const unitIds = (unitsData ?? []).map((u: { id: string }) => u.id);

    type ActividadRow = { id: string; title: string; soft_deadline: string | null; created_at: string };
    type ExamenRow = { id: string; title: string; status: string; created_at: string };
    let actividades: ActividadRow[] = [];
    let examenes: ExamenRow[] = [];
    if (unitIds.length > 0) {
      const [{ data: actsData }, { data: examsData }] = await Promise.all([
        supabase.from('assignments').select('id, title, soft_deadline, created_at').in('unit_id', unitIds),
        supabase.from('exams').select('id, title, status, created_at').in('unit_id', unitIds).in('status', ['published', 'closed']),
      ]);
      actividades = actsData ?? [];
      examenes = examsData ?? [];
    }

    const combined: FeedItem[] = [
      ...avisosList.map((a): FeedItem => ({ tipo: 'aviso', id: a.id, title: a.title, content: a.content, created_at: a.created_at })),
      ...actividades.map((a): FeedItem => ({ tipo: 'actividad', id: a.id, title: a.title, deadline: a.soft_deadline ?? null, created_at: a.created_at })),
      ...examenes.map((e): FeedItem => ({ tipo: 'examen', id: e.id, title: e.title, status: e.status, created_at: e.created_at })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { kind: "ok", courseName, avisos: avisosList, feedItems: combined, allowStudentComments, studentName };
  } catch (err) {
    console.error('Error cargando el tablón:', err);
    return { kind: "error", message: 'No se pudo cargar el tablón de esta materia.' };
  }
}

export function useMateriaAlumno(courseId: string) {
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchTablon(courseId, router, reloadKey), [courseId, router, reloadKey]);

  const retry = () => setReloadKey((k) => k + 1);

  return { resource, retry };
}
