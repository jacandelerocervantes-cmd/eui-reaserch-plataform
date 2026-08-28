import { use, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type ExamInfo = {
  title: string;
  course_units: { title: string; unit_number: number } | null;
};

export type AlumnoRevision = {
  id: string;
  matricula: string;
  nombre: string;
  entregado: boolean;
  score_ia: number;
  final_score: number;
  feedback: string;
  revisado: boolean;
  responseId: string | undefined;
};

export type FetchResult = { ok: true; examInfo: ExamInfo | null; alumnos: AlumnoRevision[] } | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchRevision(courseId: string, examId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    // 1. Datos del examen (tabla correcta: exams; course_units.title, no .name)
    const { data: exam } = await supabase
      .from('exams')
      .select('*, course_units(title, unit_number)')
      .eq('id', examId)
      .single();

    // 2. Alumnos inscritos
    const { data: studentsListRaw } = await supabase
      .from('students')
      .select('id, matricula, nombres, apellido_paterno, apellido_materno, correo')
      .eq('course_id', courseId)
      .order('apellido_paterno', { ascending: true });
    const studentsList = studentsListRaw as {
      id: string; matricula: string; nombres: string;
      apellido_paterno: string; apellido_materno: string | null; correo: string | null;
    }[] | null;

    // 2b. Si el examen tiene audiencia restringida (ej. extraordinario), filtrar
    const { data: audience } = await supabase.from('exam_students').select('student_id').eq('exam_id', examId);
    const audienceIds = audience?.map((a: { student_id: string }) => a.student_id) ?? [];
    const eligibleStudents = audienceIds.length > 0
      ? (studentsList ?? []).filter((s) => audienceIds.includes(s.id))
      : (studentsList ?? []);

    let alumnos: AlumnoRevision[] = [];
    if (eligibleStudents.length > 0) {
      const studentIds = eligibleStudents.map((s) => s.id);

      // 3. Respuestas por separado
      const { data: responsesRaw } = await supabase
        .from('evaluation_responses')
        .select('id, student_id, score_ia, final_score, feedback_ia, feedback_manual, status')
        .eq('exam_id', examId)
        .in('student_id', studentIds);
      const responses = responsesRaw as {
        id: string; student_id: string; score_ia: number | null; final_score: number | null;
        feedback_ia: string | null; feedback_manual: string | null; status: string;
      }[] | null;

      alumnos = eligibleStudents.map((s) => {
        const resp = responses?.find((r) => r.student_id === s.id);
        return {
          id:          s.id,
          matricula:   s.matricula,
          nombre:      `${s.apellido_paterno} ${s.apellido_materno ?? ''} ${s.nombres}`.trim(),
          entregado:   !!resp,
          score_ia:    resp?.score_ia    ?? 0,
          final_score: resp?.final_score ?? 0,
          feedback:    resp?.feedback_manual || resp?.feedback_ia || "",
          revisado:    resp?.status === 'completed',
          responseId:  resp?.id,
        };
      });
    }

    return { ok: true, examInfo: exam ?? null, alumnos };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cargar el examen." };
  }
}

// Hook orquestador: resuelve el recurso de datos (patrón use()+Suspense con recarga manual).
export function useEvaluacionDetalle(courseId: string, examId: string) {
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchRevision(courseId, examId, reloadKey), [courseId, examId, reloadKey]);

  return {
    resource,
    reloadKey,
    onReload: () => setReloadKey((k) => k + 1),
  };
}

// Hook de la vista de contenido: consume el recurso, guarda estado local y expone
// los handlers que hacen llamadas a Supabase (revisión IA, sincronizar, notificar, calificar).
export function useEvaluacionDetalleContent(resource: Promise<FetchResult>, courseId: string, examId: string, onReload: () => void) {
  const result = use(resource);

  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [feedbackModal, setFeedbackModal] = useState<AlumnoRevision | null>(null);
  const [savingScoreId, setSavingScoreId] = useState<string | null>(null);
  const [alumnos, setAlumnos] = useState<AlumnoRevision[]>(result.ok ? result.alumnos : []);

  const examInfo = result.ok ? result.examInfo : null;

  // --- ACCIÓN 1: Revisión Masiva IA (Edge Function) ---
  const handleBulkIA = async () => {
    setIsAIProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('bulk-evaluate-exams', {
        body: { examId, studentIds: alumnos.filter(a => a.entregado).map(a => a.id) }
      });
      if (error) throw error;
      onReload(); // Recargar datos tras procesar
    } catch (e) { alert("Certeza AIA: " + (e instanceof Error ? e.message : String(e))); }
    finally { setIsAIProcessing(false); }
  };

  // --- ACCIÓN 2: Sincronizar con Sábana (via edge function) ---
  const handleSyncGrades = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-grading-matrix', {
        body: {
          courseId,
          matrixData: {
            unidades: [{
              numero: examInfo?.course_units?.unit_number ?? 1,
              nombre: examInfo?.title ?? "Examen",
              criterios: [{ nombre: examInfo?.title ?? "Examen", valor: 100 }],
            }],
            alumnos: alumnos.map(a => ({
              matricula: a.matricula,
              nombre: a.nombre,
              unidades: [{ notas: [a.final_score], promedioUnidad: a.final_score }],
              promedioFinal: a.final_score,
            })),
          },
        }
      });
      if (error) throw error;
      alert("Sábana de notas actualizada en Google Sheets.");
    } catch (e) { alert("Error al sincronizar: " + (e instanceof Error ? e.message : String(e))); }
    finally { setIsSyncing(false); }
  };

  // --- ACCIÓN 3: Notificar resultados publicados por correo ---
  const handleNotify = async () => {
    if (!confirm("¿Enviar correo con la calificación final a cada alumno con resultado publicado?")) return;
    setIsNotifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('notify-exam-results', { body: { examId } });
      if (error) throw error;
      alert(data?.message || "Notificaciones enviadas.");
    } catch (e) { alert("Error al notificar: " + (e instanceof Error ? e.message : String(e))); }
    finally { setIsNotifying(false); }
  };

  // --- ACCIÓN 4: Guardar calificación final manual desde la tabla ---
  const handleSaveScore = async (alumno: AlumnoRevision, value: number) => {
    if (!alumno.responseId) return;
    setSavingScoreId(alumno.id);
    try {
      const { error } = await supabase
        .from('evaluation_responses')
        .update({ final_score: value, status: 'completed', graded_at: new Date().toISOString() })
        .eq('id', alumno.responseId);
      if (error) throw error;
      setAlumnos(prev => prev.map(a => a.id === alumno.id ? { ...a, final_score: value, revisado: true } : a));
    } catch (e) { alert("Error al guardar calificación: " + (e instanceof Error ? e.message : String(e))); }
    finally { setSavingScoreId(null); }
  };

  const filteredAlumnos = alumnos.filter(a =>
    a.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.matricula.includes(searchTerm)
  );

  return {
    result,
    examInfo,
    alumnos,
    filteredAlumnos,
    isAIProcessing,
    isSyncing,
    isNotifying,
    searchTerm, setSearchTerm,
    feedbackModal, setFeedbackModal,
    savingScoreId,
    handleBulkIA,
    handleSyncGrades,
    handleNotify,
    handleSaveScore,
  };
}
