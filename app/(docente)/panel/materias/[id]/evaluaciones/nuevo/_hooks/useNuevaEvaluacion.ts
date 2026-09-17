"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildQuestionRow, type EditQuestion } from "../../_components/questionMapping";

export type UnitOption = { id: string; unit_number: number; title: string };
export type StudentOption = { id: string; matricula: string; nombres: string; apellido_paterno: string; apellido_materno?: string | null };

export function useNuevaEvaluacion(courseId: string) {
  const router = useRouter();

  // Estados de navegación y carga — estrictamente useEffect + useState (cero use(resource)/Suspense)
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"chat" | "resultado">("chat");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState("");
  const [questions, setQuestions] = useState<EditQuestion[]>([]);

  // Audiencia de alumnos
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [restrictAudience, setRestrictAudience] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Opciones de aleatorización y seguridad
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  // Estados de generación y publicación
  const [search, setSearch] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [deployment, setDeployment] = useState("interno"); // "interno" | "google_forms"
  const [examConfig, setExamConfig] = useState({ title: "", startAt: "", endAt: "" });
  const [extractFile, setExtractFile] = useState<File | null>(null);

  // Carga inicial de unidades y alumnos
  useEffect(() => {
    if (!courseId) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: unitsData } = await supabase
          .from("course_units")
          .select("id, unit_number, title")
          .eq("course_id", courseId)
          .order("unit_number", { ascending: true });

        if (unitsData) {
          setUnits(unitsData);
          if (unitsData.length > 0 && !unitId) {
            setUnitId(unitsData[0].id);
          }
        }

        const { data: studentsData } = await supabase
          .from("students")
          .select("id, matricula, nombres, apellido_paterno, apellido_materno")
          .eq("course_id", courseId)
          .order("apellido_paterno", { ascending: true });

        if (studentsData) setStudents(studentsData);
      } catch (err) {
        console.error("Error cargando dependencias de evaluación:", err);
        setFeedback({ type: "error", message: "No se pudieron cargar las unidades de la materia." });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [courseId]);

  const toggleStudentAudience = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Cálculo total de puntos derivados en cada render
  const total = Number(questions.reduce((acc, q) => acc + (parseFloat(String(q.points)) || 0), 0).toFixed(1));

  // ── GENERACIÓN INICIAL DESDE EL CHAT ASISTENTE (4 PASOS) ───────────────────
  const handleChatGenerate = async (params: {
    topic: string;
    file: File | null;
    count: number;
    difficulty: string;
    questionTypes: string[];
  }): Promise<{ success: boolean; unreadable_file?: boolean; error?: string }> => {
    setIsGenerating(true);
    try {
      let body: FormData | Record<string, unknown>;

      if (params.file) {
        const fd = new FormData();
        fd.append("prompt", params.topic);
        fd.append("instruction", params.topic);
        fd.append("count", String(params.count));
        fd.append("difficulty", params.difficulty);
        fd.append("question_types", JSON.stringify(params.questionTypes));
        fd.append("archivo", params.file);
        body = fd;
      } else {
        body = {
          prompt: params.topic,
          instruction: params.topic,
          count: params.count,
          difficulty: params.difficulty,
          question_types: params.questionTypes,
        };
      }

      const { data, error } = await supabase.functions.invoke("generate-exam-ia", { body });

      if (error) {
        throw new Error(error.message || "Error al invocar generación con IA.");
      }

      if (!data?.success && data?.unreadable_file) {
        return { success: false, unreadable_file: true, error: data.error };
      }

      if (!data?.success && data?.error) {
        throw new Error(data.error);
      }

      const incomingQuestions = Array.isArray(data.questions) ? data.questions : [];
      setQuestions(incomingQuestions);

      // Si el examen no tiene título aún, sugerir uno derivado del tema
      if (!examConfig.title.trim()) {
        const cleanTitle = params.topic.split("\n")[0].slice(0, 50).trim();
        setExamConfig(prev => ({
          ...prev,
          title: cleanTitle ? `Evaluación: ${cleanTitle}` : "Evaluación de la Unidad",
        }));
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    } finally {
      setIsGenerating(false);
    }
  };

  // ── TURNO MULTI-TURNO EN EL CHAT ("agrega una de opción múltiple...", etc.) ─
  const handleChatTurn = async (instruction: string, file?: File | null): Promise<string> => {
    setIsGenerating(true);
    try {
      let body: FormData | Record<string, unknown>;

      if (file) {
        const fd = new FormData();
        fd.append("instruction", instruction);
        fd.append("current_questions", JSON.stringify(questions));
        fd.append("archivo", file);
        body = fd;
      } else {
        body = {
          instruction,
          current_questions: questions,
        };
      }

      const { data, error } = await supabase.functions.invoke("generate-exam-ia", { body });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Error al ajustar reactivos.");
      }

      const updatedQuestions = Array.isArray(data.questions) ? data.questions : questions;
      setQuestions(updatedQuestions);

      const updatedTotal = Number(updatedQuestions.reduce((acc: number, q: EditQuestion) => acc + (parseFloat(String(q.points)) || 0), 0).toFixed(1));
      return `Listo. Examen actualizado: ahora contiene ${updatedQuestions.length} reactivos (${updatedTotal} puntos). Puedes seguir pidiendo cambios o presionar "Guardar y Revisar Resultado".`;
    } finally {
      setIsGenerating(false);
    }
  };

  // ── REGENERACIÓN AISLADA DE UN REACTIVO ESPECÍFICO (1-a-1) ─────────────────
  const handleRegenerateSingleQuestion = async (
    idx: number,
    instruction?: string,
    difficulty?: string
  ): Promise<void> => {
    if (!questions[idx]) return;

    try {
      const { data, error } = await supabase.functions.invoke("generate-exam-ia", {
        body: {
          mode: "regenerate_single",
          question: questions[idx],
          instruction: instruction || undefined,
          difficulty: difficulty || undefined,
        },
      });

      if (error || !data?.success || !data?.question) {
        throw new Error(data?.error || error?.message || "No se pudo regenerar el reactivo.");
      }

      setQuestions(prev => prev.map((q, i) => (i === idx ? data.question : q)));
      setFeedback({ type: "success", message: `Reactivo #${idx + 1} regenerado exitosamente.` });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: `Error al regenerar reactivo #${idx + 1}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  // ── GENERACIÓN HEREDADA / COMPATIBILIDAD ──────────────────────────────────
  const handleGenerateAI = async () => {
    if (!search.trim()) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-exam-ia", {
        body: { prompt: search, currentCount: questions.length },
      });
      if (error) throw error;
      const incoming = Array.isArray(data.questions) ? data.questions : [];
      setQuestions([...questions, ...incoming]);
      setSearch("");
      setFeedback({ type: "success", message: `Se agregaron ${incoming.length} reactivos con IA.` });
    } catch (err) {
      setFeedback({ type: "error", message: `Error IA: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExtractFromFile = async () => {
    if (!extractFile) return;
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("archivo", extractFile);
      const { data, error } = await supabase.functions.invoke("extract-exam-questions-ia", { body: formData });
      if (error) throw new Error(error.message || "Error de conexión con el servidor.");
      if (!data?.success) throw new Error(data?.error || "No se pudieron extraer reactivos del archivo.");

      const extracted = Array.isArray(data.questions) ? data.questions : [];
      setQuestions([...questions, ...extracted]);
      setExtractFile(null);
      setFeedback({ type: "success", message: `Se extrajeron ${extracted.length} reactivos del archivo.` });
    } catch (err) {
      setFeedback({ type: "error", message: `Error al extraer: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddManualQuestion = () => {
    setQuestions([
      ...questions,
      { type: "multiple_choice", content: "", options: ["", "", "", ""], answer: "", points: 10 },
    ]);
  };

  const updateQuestion = (idx: number, patch: Partial<EditQuestion>) => {
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  // ── GUARDADO Y PUBLICACIÓN (SIN ALERT NATIVOS) ────────────────────────────
  const handlePublish = async () => {
    if (!examConfig.title.trim()) {
      return setFeedback({ type: "error", message: "Define un título para la evaluación." });
    }
    if (!unitId) {
      return setFeedback({ type: "error", message: "Selecciona a qué unidad pertenece este examen." });
    }
    if (!examConfig.startAt || !examConfig.endAt) {
      return setFeedback({ type: "error", message: "Define la fecha y hora de inicio y de fin." });
    }
    if (new Date(examConfig.endAt) <= new Date(examConfig.startAt)) {
      return setFeedback({ type: "error", message: "La fecha de fin debe ser posterior a la fecha de inicio." });
    }
    if (total !== 100) {
      return setFeedback({ type: "error", message: `El total de puntos debe ser exactamente 100. Actualmente suma ${total} pts.` });
    }
    if (questions.length === 0) {
      return setFeedback({ type: "error", message: "El examen debe tener al menos una pregunta." });
    }
    if (restrictAudience && selectedStudentIds.length === 0) {
      return setFeedback({ type: "error", message: "Selecciona al menos un alumno o desactiva la restricción de audiencia." });
    }

    setIsPublishing(true);
    try {
      const durationMinutes = Math.round(
        (new Date(examConfig.endAt).getTime() - new Date(examConfig.startAt).getTime()) / 60000
      );

      // 1. Crear el examen en `exams` (en estado draft hasta que el docente decida publicarlo)
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .insert([{
          unit_id:             unitId,
          title:               examConfig.title,
          status:              "draft",
          start_at:            examConfig.startAt ? new Date(examConfig.startAt).toISOString() : null,
          end_at:              examConfig.endAt ? new Date(examConfig.endAt).toISOString() : null,
          duration_minutes:    durationMinutes,
          randomize_questions: randomizeQuestions,
          randomize_options:   randomizeOptions,
          show_all_questions:  showAllQuestions,
          deployment_method:   deployment,
        }])
        .select("id")
        .single();

      if (examError) throw examError;

      // 1b. Audiencia restringida
      if (restrictAudience && selectedStudentIds.length > 0) {
        const { error: audError } = await supabase
          .from("exam_students")
          .insert(selectedStudentIds.map(sid => ({ exam_id: exam.id, student_id: sid })));
        if (audError) throw audError;
      }

      // 2. Insertar reactivos en `questions`
      const questionsRows = questions.map((q, idx: number) => buildQuestionRow(q, exam.id, idx));
      const { error: qError } = await supabase.from("questions").insert(questionsRows);
      if (qError) throw qError;

      // 3. Google Forms si aplica
      if (deployment === "google_forms") {
        const { data: formData, error: formError } = await supabase.functions.invoke("publish-exam-form", {
          body: { examId: exam.id },
        });

        if (formError || !formData?.success) {
          setFeedback({
            type: "error",
            message: `El examen se guardó, pero hubo un detalle con Google Forms: ${formData?.error || formError?.message}. Puedes reintentarlo desde "Configuración".`,
          });
        } else {
          window.open(formData.publishedUrl, "_blank");
          setFeedback({ type: "success", message: "¡Examen guardado y Google Form generado en pestaña nueva!" });
        }
      } else {
        setFeedback({ type: "success", message: "¡Examen guardado correctamente como borrador!" });
      }

      // Breve pausa para que el docente alcance a ver el toast de éxito
      setTimeout(() => {
        router.push(`/panel/materias/${courseId}/evaluaciones`);
      }, 1200);
    } catch (e) {
      setFeedback({ type: "error", message: `Error al guardar examen: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setIsPublishing(false);
    }
  };

  return {
    loading,
    viewMode,
    setViewMode,
    feedback,
    setFeedback,
    units,
    unitId,
    setUnitId,
    questions,
    setQuestions,
    students,
    restrictAudience,
    setRestrictAudience,
    selectedStudentIds,
    setSelectedStudentIds,
    randomizeQuestions,
    setRandomizeQuestions,
    randomizeOptions,
    setRandomizeOptions,
    showAllQuestions,
    setShowAllQuestions,
    search,
    setSearch,
    isSimulating,
    setIsSimulating,
    isGenerating,
    isExtracting,
    isPublishing,
    deployment,
    setDeployment,
    examConfig,
    setExamConfig,
    extractFile,
    setExtractFile,
    toggleStudentAudience,
    total,
    handleChatGenerate,
    handleChatTurn,
    handleRegenerateSingleQuestion,
    handleGenerateAI,
    handleExtractFromFile,
    handleAddManualQuestion,
    updateQuestion,
    handlePublish,
  };
}
