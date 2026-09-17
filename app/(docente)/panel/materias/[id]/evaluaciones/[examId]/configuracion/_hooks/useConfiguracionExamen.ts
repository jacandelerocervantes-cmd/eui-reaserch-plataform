import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildQuestionRow, parseQuestionRow, type EditQuestion, type QuestionRow } from "../../../_components/questionMapping";

export type UnitOption = { id: string; unit_number: number; title: string };
export type StudentOption = { id: string; matricula: string; nombres: string; apellido_paterno: string; apellido_materno?: string | null };

export function useConfiguracionExamen(courseId: string, examId: string) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishingForm, setIsPublishingForm] = useState(false);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState("");
  const [status, setStatus] = useState("draft");
  const [examConfig, setExamConfig] = useState({ title: "", startAt: "", endAt: "" });
  const [questions, setQuestions] = useState<EditQuestion[]>([]);
  const [deploymentMethod, setDeploymentMethod] = useState("interno");
  const [googleFormUrl, setGoogleFormUrl] = useState<string | null>(null);
  const [googleFormEditUrl, setGoogleFormEditUrl] = useState<string | null>(null);
  const [startNotifiedAt, setStartNotifiedAt] = useState<string | null>(null);
  const [isTestingRelay, setIsTestingRelay] = useState(false);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [restrictAudience, setRestrictAudience] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  // questionId -> id real en DB (null si es nueva, para saber si insertar o actualizar)
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  // Derivado de questions en cada render — no necesita ser estado propio.
  const total = Number(questions.reduce((acc, q) => acc + (parseFloat(String(q.points)) || 0), 0).toFixed(1));

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showRePublishConfirm, setShowRePublishConfirm] = useState(false);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: unitsData } = await supabase.from("course_units").select("id, unit_number, title").eq("course_id", courseId).order("unit_number", { ascending: true });
      if (unitsData) setUnits(unitsData);

      const { data: studentsData } = await supabase.from("students").select("id, matricula, nombres, apellido_paterno, apellido_materno").eq("course_id", courseId).order("apellido_paterno", { ascending: true });
      if (studentsData) setStudents(studentsData);

      const { data: exam, error: examError } = await supabase.from("exams").select("*").eq("id", examId).single();
      if (examError) throw examError;
      if (exam) {
        setUnitId(exam.unit_id ?? "");
        setStatus(exam.status ?? "draft");
        setExamConfig({
          title: exam.title ?? "",
          startAt: exam.start_at ? new Date(exam.start_at).toISOString().slice(0, 16) : "",
          endAt: exam.end_at ? new Date(exam.end_at).toISOString().slice(0, 16) : "",
        });
        setRandomizeQuestions(exam.randomize_questions ?? true);
        setRandomizeOptions(exam.randomize_options ?? true);
        setShowAllQuestions(exam.show_all_questions ?? false);
        setDeploymentMethod(exam.deployment_method ?? "interno");
        setGoogleFormUrl(exam.google_form_url ?? null);
        setGoogleFormEditUrl(exam.google_form_edit_url ?? null);
        setStartNotifiedAt((exam as any).start_notified_at ?? null);
      }

      const { data: audience } = await supabase.from("exam_students").select("student_id").eq("exam_id", examId);
      if (audience && audience.length > 0) {
        setRestrictAudience(true);
        setSelectedStudentIds(audience.map((a: { student_id: string }) => a.student_id));
      }

      const { data: qs } = await supabase.from("questions").select("*").eq("exam_id", examId).order("order_index", { ascending: true });
      if (qs) setQuestions((qs as QuestionRow[]).map(parseQuestionRow));
    } catch (e) {
      setFeedback({ type: 'error', message: "Error al cargar el examen: " + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!courseId || !examId) return;
    // Saca la llamada del cuerpo síncrono del efecto sin cambiar cuándo se
    // dispara en la práctica (sigue siendo inmediato al montar o al cambiar
    // courseId/examId) — mismo patrón usado en el resto de pantallas de examen.
    const t = setTimeout(() => { fetchData(); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, examId]);

  const handleGenerateAI = async () => {
    if (!search) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-exam-ia', {
        body: { prompt: search, currentCount: questions.length }
      });
      if (error) throw error;
      setQuestions([...questions, ...data.questions]);
      setSearch("");
    } catch (err) {
      setFeedback({ type: 'error', message: "Certeza AIA: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddManualQuestion = () => {
    setQuestions([...questions, { type: "multiple_choice", content: "", options: ["", "", "", ""], answer: "", points: 0 }]);
  };

  const updateQuestion = (idx: number, patch: Partial<EditQuestion>) => {
    setQuestions(questions.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };

  const handleRemoveQuestion = (idx: number) => {
    const q = questions[idx];
    const qId = q.id;
    if (qId) setDeletedQuestionIds(prev => [...prev, qId]);
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!examConfig.title) return setFeedback({ type: 'error', message: "Define un título para el examen." });
    if (!unitId) return setFeedback({ type: 'error', message: "Selecciona a qué unidad pertenece este examen." });
    if (!examConfig.startAt || !examConfig.endAt) return setFeedback({ type: 'error', message: "Define la fecha/hora de inicio y de fin." });
    if (new Date(examConfig.endAt) <= new Date(examConfig.startAt)) return setFeedback({ type: 'error', message: "La fecha de fin debe ser posterior a la de inicio." });
    if (total !== 100) return setFeedback({ type: 'error', message: "El total de puntos debe ser exactamente 100." });
    if (questions.length === 0) return setFeedback({ type: 'error', message: "El examen debe tener al menos una pregunta." });
    if (restrictAudience && selectedStudentIds.length === 0) return setFeedback({ type: 'error', message: "Selecciona al menos un alumno, o desactiva la restricción de audiencia." });

    setIsSaving(true);
    try {
      const durationMinutes = Math.round((new Date(examConfig.endAt).getTime() - new Date(examConfig.startAt).getTime()) / 60000);

      const { error: examError } = await supabase
        .from("exams")
        .update({
          unit_id:             unitId,
          title:               examConfig.title,
          start_at:            examConfig.startAt,
          end_at:              examConfig.endAt,
          duration_minutes:    durationMinutes,
          randomize_questions: randomizeQuestions,
          randomize_options:   randomizeOptions,
          show_all_questions: showAllQuestions,
        })
        .eq("id", examId);
      if (examError) throw examError;

      // Audiencia: reemplazar por completo con la selección actual
      const { error: audDelError } = await supabase.from("exam_students").delete().eq("exam_id", examId);
      if (audDelError) throw audDelError;

      if (restrictAudience && selectedStudentIds.length > 0) {
        const { error: audError } = await supabase
          .from("exam_students")
          .insert(selectedStudentIds.map(sid => ({ exam_id: examId, student_id: sid })));
        if (audError) throw audError;
      }

      if (deletedQuestionIds.length > 0) {
        const { error: delError } = await supabase.from("questions").delete().in("id", deletedQuestionIds);
        if (delError) throw delError;
      }

      const toUpdate = questions.filter(q => q.id);
      const toInsert = questions.filter(q => !q.id);

      await Promise.all(
        toUpdate.map(async (q) => {
          const { error } = await supabase.from("questions").update(buildQuestionRow(q, examId, questions.indexOf(q))).eq("id", q.id);
          if (error) throw error;
        })
      );

      if (toInsert.length > 0) {
        const rows = toInsert.map(q => buildQuestionRow(q, examId, questions.indexOf(q)));
        const { error } = await supabase.from("questions").insert(rows);
        if (error) throw error;
      }

      setFeedback({ type: 'success', message: "¡Cambios guardados correctamente!" });
      setTimeout(() => router.push(`/panel/materias/${courseId}/evaluaciones`), 1200);
    } catch (e) {
      setFeedback({ type: 'error', message: `Error al guardar: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishForm = async (force: boolean = false) => {
    setIsPublishingForm(true);
    if (force) setShowRePublishConfirm(false);
    try {
      const { data, error } = await supabase.functions.invoke('publish-exam-form', { body: { examId, force } });
      let payload = data;
      if (error) {
        try {
          const errJson = await (error as any).context?.json?.();
          if (errJson) payload = errJson;
        } catch {}
      }

      if (payload?.already_published) {
        setShowRePublishConfirm(true);
        return;
      }

      if (error || !payload?.success) throw new Error(payload?.error || error?.message || "No se pudo generar el formulario.");
      setGoogleFormUrl(payload.publishedUrl);
      setGoogleFormEditUrl(payload.editUrl);
      setDeploymentMethod("google_forms");
      setFeedback({ type: 'success', message: "¡Google Form generado exitosamente! Ya puedes compartir la liga con tus alumnos." });
      try {
        window.open(payload.publishedUrl, "_blank");
      } catch {}
      setShowRePublishConfirm(false);
    } catch (e) {
      setFeedback({ type: 'error', message: `Certeza AIA: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setIsPublishingForm(false);
    }
  };

  const handleTestRelay = async (forceAction: "full_test" | "notify" | "open" | "close" = "full_test") => {
    setIsTestingRelay(true);
    try {
      const { data, error } = await supabase.functions.invoke('activate-scheduled-exams', {
        body: { testExamId: examId, forceAction }
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Error al ejecutar relay.");
      const detailsMsg = data.details?.length > 0 ? data.details.join(" ") : `Avisos: ${data.notifiedExams}, Abiertos: ${data.openedExams}, Cerrados: ${data.closedExams}`;
      setFeedback({ type: 'success', message: `¡Relay ejecutado! ${detailsMsg}` });
      await fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: `Error en relay: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setIsTestingRelay(false);
    }
  };

  return {
    loading, isSaving, isGenerating, isPublishingForm, isTestingRelay,
    feedback, setFeedback,
    showRePublishConfirm, setShowRePublishConfirm,
    units, unitId, setUnitId,
    status,
    examConfig, setExamConfig,
    questions, setQuestions,
    deploymentMethod,
    googleFormUrl, googleFormEditUrl,
    startNotifiedAt,
    students,
    restrictAudience, setRestrictAudience,
    selectedStudentIds, setSelectedStudentIds,
    randomizeQuestions, setRandomizeQuestions,
    randomizeOptions, setRandomizeOptions,
    showAllQuestions, setShowAllQuestions,
    search, setSearch,
    total,
    fetchData,
    handleGenerateAI,
    handleAddManualQuestion,
    updateQuestion,
    handleRemoveQuestion,
    handleSave,
    handlePublishForm,
    handleTestRelay,
  };
}
