import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export type SimQuestion = {
  id: string;
  type: string;
  content: string;
  points: number;
  options?: string[];
  left?: string[];
  right?: string[];
};

export type SimAnswer = string | string[] | Record<number, string> | undefined;

export type AiResult = { plan?: string; fortaleza?: string; repaso?: string } | null;

/**
 * Toda la lógica de datos (carga del examen, timer, envío a la Edge
 * Function de análisis IA) y el estado que la acompaña para la pantalla de
 * simulación de examen (vista previa del docente).
 */
export function useSimulacionExamen(examId: string | string[] | undefined) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [questions, setQuestions] = useState<SimQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, SimAnswer>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const [aiResult, setAiResult] = useState<AiResult>(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  // Esto es solo la vista previa del docente: las "incidencias" detectadas
  // aquí únicamente ilustran lo que vería el sistema real con un alumno.
  const [copyAttempts, setCopyAttempts] = useState(0);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const warningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flagCheatAttempt = () => {
    setCopyAttempts((c) => c + 1);
    setShowCheatWarning(true);
    if (warningTimeout.current) clearTimeout(warningTimeout.current);
    warningTimeout.current = setTimeout(() => setShowCheatWarning(false), 2500);
  };

  // 1. Cargar preguntas reales del examen (tabla correcta: exams + questions)
  useEffect(() => {
    async function loadExam() {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: exam } = await supabase.from('exams').select('show_all_questions').eq('id', examId).single();
        if (exam) setShowAllQuestions(exam.show_all_questions ?? false);

        const { data: qs } = await supabase
          .from('questions')
          .select('id, q_type, content, options, correct_answer, points')
          .eq('exam_id', examId)
          .order('order_index', { ascending: true });

        if (qs) {
          setQuestions((qs as { id: string; q_type: string; content: string; points: number; options: string[] | { left?: string[]; right?: string[] } | null }[]).map((q) => {
            const isMatching = q.q_type === 'matching';
            const opts = !Array.isArray(q.options) ? q.options : null;
            return {
              id: q.id,
              type: q.q_type,
              content: q.content,
              points: q.points,
              options: isMatching ? undefined : (q.options as string[] | undefined),
              left: isMatching ? opts?.left : undefined,
              right: isMatching ? opts?.right : undefined,
            };
          }));
        }
      } catch (e) {
        console.error("Error cargando examen para simulación:", e);
        setLoadError(e instanceof Error ? e.message : "No se pudo cargar el examen para simular.");
      } finally {
        setLoading(false);
      }
    }
    if (examId) loadExam();
  }, [examId]);

  // 2. Timer
  useEffect(() => {
    if (isFinished) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isFinished]);

  // 3. Procesar resultados con la Edge Function
  const handleFinish = async () => {
    setIsFinished(true);
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-simulation', {
        body: {
          questions,
          answers,
          studentName: "Estudiante de Prueba"
        }
      });
      if (error) throw error;
      setAiResult(data);
    } catch (e) {
      console.error("Error en análisis IA:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    loading,
    loadError,
    isAnalyzing,
    questions,
    currentIdx, setCurrentIdx,
    answers, setAnswers,
    isFinished,
    timeLeft,
    aiResult,
    showAllQuestions,
    copyAttempts,
    showCheatWarning,
    flagCheatAttempt,
    handleFinish,
  };
}
