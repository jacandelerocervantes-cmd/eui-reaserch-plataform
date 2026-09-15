import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatStudentName } from '@/lib/formatStudentName';

export type Aviso = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  allow_comments?: boolean;
};

export type FeedItem =
  | { tipo: 'aviso'; id: string; title: string; content: string; created_at: string; allow_comments?: boolean }
  | { tipo: 'actividad'; id: string; title: string; deadline: string | null; created_at: string }
  | { tipo: 'examen'; id: string; title: string; status: string; created_at: string };

export type FetchResult =
  | { kind: "ok"; courseName: string; avisos: Aviso[]; feedItems: FeedItem[]; studentName: string }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

const EMPTY_RESULT: FetchResult = {
  kind: "ok",
  courseName: "Materia",
  avisos: [],
  feedItems: [],
  studentName: "Alumno",
};

export async function fetchMateriaAlumno(
  courseId: string,
  router: ReturnType<typeof useRouter>,
  _reloadKey: number
): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (typeof window !== 'undefined') router.push('/alumno/login');
      return { kind: "redirect" };
    }

    const { data: studentRec } = await supabase
      .from('students')
      .select('id, nombres, apellido_paterno, apellido_materno, courses(title)')
      .ilike('correo', user.email?.trim() ?? '')
      .eq('course_id', courseId)
      .maybeSingle();

    let courseName = 'Materia';
    let studentName = 'Alumno';

    if (studentRec) {
      const courseObj = (studentRec as unknown as { courses: { title: string } | null }).courses;
      courseName = courseObj?.title ?? 'Materia';
      studentName = formatStudentName(studentRec as { nombres: string; apellido_paterno: string; apellido_materno?: string | null }, { order: 'nombre-apellido' }) || 'Alumno';
    } else {
      // Fallback: verificar que la materia exista
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, title')
        .eq('id', courseId)
        .maybeSingle();

      if (courseData) {
        courseName = courseData.title;
      } else {
        if (typeof window !== 'undefined') router.push('/alumno');
        return { kind: "redirect" };
      }
    }

    const { data: avisosData } = await supabase
      .from('course_announcements')
      .select('id, title, content, created_at, allow_comments')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    const avisosList: Aviso[] = (avisosData ?? []).map((a: any) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      created_at: a.created_at,
      allow_comments: a.allow_comments ?? true,
    }));

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
      ...avisosList.map((a): FeedItem => ({ tipo: 'aviso', id: a.id, title: a.title, content: a.content, created_at: a.created_at, allow_comments: a.allow_comments ?? true })),
      ...actividades.map((a): FeedItem => ({ tipo: 'actividad', id: a.id, title: a.title, deadline: a.soft_deadline ?? null, created_at: a.created_at })),
      ...examenes.map((e): FeedItem => ({ tipo: 'examen', id: e.id, title: e.title, status: e.status, created_at: e.created_at })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { kind: "ok", courseName, avisos: avisosList, feedItems: combined, studentName };
  } catch (err) {
    console.error('Error cargando el tablón:', err);
    return { kind: "error", message: 'No se pudo cargar el tablón de esta materia.' };
  }
}

export function useMateriaAlumno({
  courseId,
  reloadKey,
  onReload,
}: {
  courseId: string;
  reloadKey: number;
  onReload?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FetchResult>(EMPTY_RESULT);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchMateriaAlumno(courseId, router, reloadKey).then((r) => {
      if (!isMounted) return;
      setResult(r);
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [courseId, router, reloadKey]);

  return { loading, result, onReload };
}
