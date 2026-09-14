import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type ExamQuestionOptions = string[] | { left?: string[]; right?: string[] } | null;

export type ExamQuestion = {
  id: string;
  q_type: string;
  content: string;
  correct_answer: string | null;
  points: number;
  options: ExamQuestionOptions;
};

export type StudentInfo = { apellido_paterno: string; nombres: string; matricula: string };

export type AntiCheatMeta = {
  total_violations?: number;
  tab_switches?: number;
  copy_attempts?: number;
  fullscreen_exits?: number;
  duration_minutes?: number | string;
};

export type EvalResponseMeta = {
  anti_cheat?: AntiCheatMeta;
  respuestas_puntos?: Record<string, number>;
  question_scores?: Record<string, number>;
  manual_error_flag?: boolean;
};

export type EvalResponse = {
  id: string;
  answers: Record<string, unknown> | null;
  metadata: EvalResponseMeta | null;
  score_ia: number | null;
  students: StudentInfo | null;
};

export type ExamWithQuestions = { title?: string; course_units?: { title: string } | null; questions: ExamQuestion[] };

// Da formato legible a la respuesta del alumno y la clave correcta para los
// tipos cuya respuesta no es un simple string (matching ya tiene su propio
// render de tabla; el resto cae aquí).
export function describeAnswer(q: ExamQuestion, resAlumno: unknown): { alumno: string; clave: string; correcto: boolean } {
  const safeParse = (s: string | null) => { try { return JSON.parse(s ?? "null") } catch { return null } };
  switch (q.q_type) {
    case 'ordering': {
      const expected: string[] = safeParse(q.correct_answer) ?? [];
      const given: string[] = Array.isArray(resAlumno) ? resAlumno : [];
      return {
        alumno: given.length ? given.map((v, i) => `${i + 1}. ${v}`).join(' · ') : '(en blanco)',
        clave: expected.map((v, i) => `${i + 1}. ${v}`).join(' · '),
        correcto: given.length === expected.length && given.every((v, i) => v === expected[i]),
      };
    }
    case 'multi_select': {
      const correct: string[] = safeParse(q.correct_answer) ?? [];
      const given: string[] = Array.isArray(resAlumno) ? resAlumno : [];
      const sameSet = given.length === correct.length && correct.every((c) => given.includes(c));
      return {
        alumno: given.length ? given.join(', ') : '(en blanco)',
        clave: correct.join(', '),
        correcto: sameSet,
      };
    }
    case 'fill_blank': {
      const expected: string[] = safeParse(q.correct_answer) ?? [];
      const given: string[] = Array.isArray(resAlumno) ? resAlumno : [];
      return {
        alumno: given.length ? given.join(' / ') : '(en blanco)',
        clave: expected.join(' / '),
        correcto: given.length === expected.length && given.every((v, i) => (v ?? '').trim().toLowerCase() === (expected[i] ?? '').trim().toLowerCase()),
      };
    }
    case 'short_answer': {
      const accepted: string[] = safeParse(q.correct_answer) ?? [];
      const given = String(resAlumno ?? '');
      return {
        alumno: given || '(en blanco)',
        clave: accepted.join(' / '),
        correcto: accepted.some((a) => a.trim().toLowerCase() === given.trim().toLowerCase()),
      };
    }
    default:
      return { alumno: (resAlumno as string) || '(en blanco)', clave: q.correct_answer ?? '', correcto: resAlumno === q.correct_answer };
  }
}

export type FetchResult =
  | { ok: true; exam: ExamWithQuestions; response: EvalResponse | null; orderedStudentIds: string[]; initialScores: Record<string, number>; initialFeedback: string }
  | { ok: false; error: string };

async function fetchAuditData(courseId: string, examId: string, studentId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    // 1. Datos del examen (tabla correcta: exams; course_units.title, no .name) + reactivos
    const { data: ex } = await supabase.from('exams').select('*, course_units(title)').eq('id', examId).single();
    const { data: qs } = await supabase.from('questions').select('*').eq('exam_id', examId).order('order_index', { ascending: true });
    const exam = { ...ex, questions: (qs ?? []) as ExamQuestion[] } as ExamWithQuestions;

    // 2. Respuesta del alumno
    const { data: res } = await supabase.from('evaluation_responses')
      .select(`*, students(*)`)
      .eq('exam_id', examId)
      .eq('student_id', studentId)
      .single();
    const response = res as EvalResponse | null;

    // 3. Orden de alumnos para navegación prev/next
    const { data: studentsList } = await supabase
      .from('students').select('id').eq('course_id', courseId).order('apellido_paterno', { ascending: true });
    const { data: audience } = await supabase.from('exam_students').select('student_id').eq('exam_id', examId);
    const audienceIds = audience?.map((a: { student_id: string }) => a.student_id) ?? [];
    const orderedStudentIds = (studentsList ?? []).map((s: { id: string }) => s.id).filter((id: string) => audienceIds.length === 0 || audienceIds.includes(id));

    const initialScores = response?.metadata?.respuestas_puntos || response?.metadata?.question_scores || {};
    const initialFeedback = res?.feedback_manual || "";

    return { ok: true, exam, response, orderedStudentIds, initialScores, initialFeedback };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cargar la entrega del alumno." };
  }
}

/**
 * Maneja el ciclo de recarga (reloadKey) que dispara el refetch en
 * useAuditoriaConsola.
 */
export function useRevisionExamen(courseId: string, examId: string, studentId: string) {
  const [reloadKey, setReloadKey] = useState(0);
  const retry = () => setReloadKey((k) => k + 1);
  return { reloadKey, retry };
}

/**
 * Carga los datos de la auditoría (con reloadKey para recarga manual) y
 * expone todo el estado/handlers de la consola (ajuste de puntos, feedback,
 * navegación entre alumnos y guardado).
 */
export function useAuditoriaConsola(courseId: string, examId: string, studentId: string, reloadKey: number) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FetchResult>({ ok: false, error: "" });

  const [isSaving, setIsSaving] = useState(false);
  const [questionScores, setQuestionScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const [manualAlert, setManualAlert] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchAuditData(courseId, examId, studentId, reloadKey).then((r) => {
      if (!isMounted) return;
      setResult(r);
      if (r.ok) {
        setQuestionScores(r.initialScores);
        setFeedback(r.initialFeedback);
        setManualAlert(!!r.response?.metadata?.manual_error_flag);
      }
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [courseId, examId, studentId, reloadKey]);

  const exam = result.ok ? result.exam : undefined;
  const response = result.ok ? result.response : undefined;
  const orderedStudentIds = result.ok ? result.orderedStudentIds : [];

  const currentIndex = orderedStudentIds.indexOf(studentId);
  const prevStudentId = currentIndex > 0 ? orderedStudentIds[currentIndex - 1] : null;
  const nextStudentId = currentIndex >= 0 && currentIndex < orderedStudentIds.length - 1 ? orderedStudentIds[currentIndex + 1] : null;
  const goToStudent = (sid: string) => router.push(`/panel/materias/${courseId}/evaluaciones/${examId}/revision/${sid}`);
  const goBack = () => router.back();

  // CÁLCULO DINÁMICO (ADN Actividades)
  const totalGrade = Number(Object.values(questionScores).reduce((a, b) => Number(a) + Number(b), 0));

  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!actionFeedback) return;
    const t = setTimeout(() => setActionFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [actionFeedback]);

  const handleSave = async () => {
    if (!response) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('evaluation_responses')
        .update({
          final_score: totalGrade,
          feedback_manual: feedback,
          metadata: { ...response.metadata, question_scores: questionScores, manual_error_flag: manualAlert },
          status: 'completed'
        })
        .eq('id', response.id);
      if (error) throw error;
      setActionFeedback({ type: 'success', message: "Auditoría guardada exitosamente." });
    } catch {
      setActionFeedback({ type: 'error', message: "Error al guardar la auditoría." });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    loading,
    result,
    exam,
    response,
    orderedStudentIds,
    currentIndex,
    prevStudentId,
    nextStudentId,
    goToStudent,
    goBack,
    questionScores, setQuestionScores,
    feedback, setFeedback,
    actionFeedback, setActionFeedback,
    manualAlert, setManualAlert,
    totalGrade,
    isSaving,
    handleSave,
  };
}
