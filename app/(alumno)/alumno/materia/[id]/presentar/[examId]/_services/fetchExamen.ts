import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { shuffle, type Answers, type ExistingResponse, type Question, type FetchResult } from '../_lib/examHelpers';

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
export async function fetchExamen(courseId: string, examId: string, router: ReturnType<typeof useRouter>, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/alumno/login'); return { kind: 'redirect' }; }

    const { data: studentRec } = await supabase
      .from('students')
      .select('id')
      .ilike('correo', user.email ?? '')
      .eq('course_id', courseId)
      .single();

    if (!studentRec) { router.push('/alumno'); return { kind: 'redirect' }; }

    const { data: examData } = await supabase
      .from('exams')
      .select('id, title, status, course_id, duration_minutes')
      .eq('id', examId)
      .single();

    if (!examData || examData.status !== 'published') {
      router.push(`/alumno/materia/${courseId}`);
      return { kind: 'redirect' };
    }

    const { data: existing } = await supabase
      .from('evaluation_responses')
      .select('id, status, answers, final_score, score_ia, metadata')
      .eq('student_id', studentRec.id)
      .eq('exam_id', examId)
      .maybeSingle();

    const existingAnswers: Answers = (existing?.answers as Answers | null) ?? {};
    const alreadySubmitted = !!existing && existing.status !== 'draft';

    const { data: qs } = await supabase
      .from('questions')
      .select('id, content, q_type, options, points, order_index')
      .eq('exam_id', examId)
      .order('order_index', { ascending: true });

    const loadedQuestions: Question[] = qs ?? [];

    // "ordering" necesita un orden revuelto para mostrar al alumno — se
    // genera una sola vez y se guarda directo como respuesta inicial
    // (igual que cualquier lista de "arrastrar y ordenar" llega pre-llena).
    const orderingDefaults: Answers = {};
    loadedQuestions.forEach((q) => {
      if (q.q_type === 'ordering' && !existingAnswers[q.id] && Array.isArray(q.options)) {
        orderingDefaults[q.id] = shuffle(q.options);
      }
    });
    const initialAnswers = { ...orderingDefaults, ...existingAnswers };

    return { kind: 'ok', studentId: studentRec.id, exam: examData, questions: loadedQuestions, initialAnswers, existingResponse: (existing as ExistingResponse | null) ?? null, alreadySubmitted };
  } catch (err) {
    console.error('Error cargando el examen:', err);
    return { kind: 'error', message: 'No se pudo cargar el examen. Intenta de nuevo.' };
  }
}
