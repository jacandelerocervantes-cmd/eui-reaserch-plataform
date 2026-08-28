import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { buildQuestionRow, type EditQuestion } from "../../_components/questionMapping";

export type UnitOption = { id: string; unit_number: number; title: string };
export type StudentOption = { id: string; matricula: string; nombres: string; apellido_paterno: string };

export function useNuevaEvaluacion(courseId: string) {
  const router = useRouter();

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState("");
  const [questions, setQuestions] = useState<EditQuestion[]>([]);

  // Audiencia: por defecto todos los alumnos del curso; se puede restringir
  // (ej. examen extraordinario para solo algunos alumnos).
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [restrictAudience, setRestrictAudience] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Orden aleatorio: columnas ya existentes en exams, nunca expuestas en UI.
  // Randomizar por alumno es más fuerte que crear "versiones" fijas — nadie
  // comparte el mismo orden, no solo 2 grupos predecibles.
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  // Decisión del docente: una pregunta a la vez (default, anti-copia) o todas
  // juntas (útil para examen a libro abierto / práctica de baja exigencia).
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [search, setSearch] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [deployment, setDeployment] = useState("interno"); // "interno" | "google_forms"
  const [examConfig, setExamConfig] = useState({ title: "", startAt: "", endAt: "" });
  const [extractFile, setExtractFile] = useState<File | null>(null);

  useEffect(() => {
    if (!courseId) return;
    const loadData = async () => {
      const { data: unitsData } = await supabase.from("course_units").select("id, unit_number, title").eq("course_id", courseId).order("unit_number", { ascending: true });
      if (unitsData) setUnits(unitsData);
      const { data: studentsData } = await supabase.from("students").select("id, matricula, nombres, apellido_paterno").eq("course_id", courseId).order("apellido_paterno", { ascending: true });
      if (studentsData) setStudents(studentsData);
    };
    loadData();
  }, [courseId]);

  const toggleStudentAudience = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Lógica de Puntaje: $$Total = \sum_{i=1}^{n} Reactivo_i$$ — derivado en cada
  // render, no necesita ser estado propio.
  const total = Number(questions.reduce((acc, q) => acc + (parseFloat(String(q.points)) || 0), 0).toFixed(1));

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
      alert("Certeza AIA: " + (err instanceof Error ? err.message : String(err)));
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
      const { data, error } = await supabase.functions.invoke('extract-exam-questions-ia', { body: formData });
      if (error) throw new Error(error.message || "Error de conexión con el servidor.");
      if (!data?.success) throw new Error(data?.error || "No se pudieron extraer reactivos del archivo.");

      setQuestions([...questions, ...data.questions]);
      setExtractFile(null);
    } catch (err) {
      alert("Certeza AIA: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddManualQuestion = () => {
    setQuestions([...questions, { type: "multiple_choice", content: "", options: ["", "", "", ""], answer: "", points: 0 }]);
  };

  const updateQuestion = (idx: number, patch: Partial<EditQuestion>) => {
    setQuestions(questions.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };

  const handlePublish = async () => {
    if (!examConfig.title) return alert("Define un título para el examen.");
    if (!unitId) return alert("Selecciona a qué unidad pertenece este examen.");
    if (!examConfig.startAt || !examConfig.endAt) return alert("Define la fecha/hora de inicio y de fin.");
    if (new Date(examConfig.endAt) <= new Date(examConfig.startAt)) return alert("La fecha de fin debe ser posterior a la de inicio.");
    if (total !== 100) return alert("El total de puntos debe ser exactamente 100.");
    if (questions.length === 0) return alert("El examen debe tener al menos una pregunta.");
    if (restrictAudience && selectedStudentIds.length === 0) return alert("Selecciona al menos un alumno, o desactiva la restricción de audiencia.");

    setIsPublishing(true);
    try {
      const durationMinutes = Math.round((new Date(examConfig.endAt).getTime() - new Date(examConfig.startAt).getTime()) / 60000);

      // 1. Crear el examen en `exams` — esta tabla solo tiene unit_id, no course_id
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .insert([{
          unit_id:             unitId,
          title:               examConfig.title,
          status:              "draft",
          start_at:            examConfig.startAt,
          end_at:              examConfig.endAt,
          duration_minutes:    durationMinutes,
          randomize_questions: randomizeQuestions,
          randomize_options:   randomizeOptions,
          show_all_questions:  showAllQuestions,
        }])
        .select("id")
        .single();
      if (examError) throw examError;

      // 1b. Audiencia restringida (ej. examen extraordinario) — sin filas = todos los alumnos
      if (restrictAudience && selectedStudentIds.length > 0) {
        const { error: audError } = await supabase
          .from("exam_students")
          .insert(selectedStudentIds.map(sid => ({ exam_id: exam.id, student_id: sid })));
        if (audError) throw audError;
      }

      // 2. Insertar reactivos en `questions` — q_type (no "type"), correct_answer (no "answer")
      const questionsRows = questions.map((q, idx: number) => buildQuestionRow(q, exam.id, idx));
      const { error: qError } = await supabase.from("questions").insert(questionsRows);
      if (qError) throw qError;

      // 3. Si el docente eligió Google Forms, generar el formulario real ahora
      // que el examen ya quedó guardado (la fuente de verdad sigue siendo
      // `exams`/`questions`; el Form es solo el medio de aplicación).
      if (deployment === "google_forms") {
        const { data: formData, error: formError } = await supabase.functions.invoke('publish-exam-form', { body: { examId: exam.id } });
        if (formError || !formData?.success) {
          alert(`El examen se guardó, pero no se pudo generar el Google Form: ${formData?.error || formError?.message}. Puedes reintentarlo desde "Configuración".`);
        } else {
          window.open(formData.publishedUrl, "_blank");
          alert("¡Examen guardado y Google Form generado! Se abrió en una pestaña nueva.");
        }
      } else {
        alert("¡Examen guardado correctamente!");
      }

      router.push(`/panel/materias/${courseId}/evaluaciones`);
    } catch (e) {
      alert(`Error al publicar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return {
    units,
    unitId, setUnitId,
    questions, setQuestions,
    students,
    restrictAudience, setRestrictAudience,
    selectedStudentIds, setSelectedStudentIds,
    randomizeQuestions, setRandomizeQuestions,
    randomizeOptions, setRandomizeOptions,
    showAllQuestions, setShowAllQuestions,
    search, setSearch,
    isSimulating, setIsSimulating,
    isGenerating,
    isExtracting,
    isPublishing,
    deployment, setDeployment,
    examConfig, setExamConfig,
    extractFile, setExtractFile,
    toggleStudentAudience,
    total,
    handleGenerateAI,
    handleExtractFromFile,
    handleAddManualQuestion,
    updateQuestion,
    handlePublish,
  };
}
