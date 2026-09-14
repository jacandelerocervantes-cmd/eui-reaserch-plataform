import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type UnitOption = { id: string; unit_number: number; title: string };
export type ExamListItem = {
  id: string; unit_id: string; title: string; description: string | null; status: string;
  start_at: string | null; duration_minutes: number | null; questions_count: number | null;
};

export type FetchResult = { ok: true; units: UnitOption[]; evaluaciones: ExamListItem[] } | { ok: false; error: string };

async function fetchEvaluaciones(courseId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    // 1. Obtener Unidades de la materia
    const { data: unitsDataRaw } = await supabase
      .from('course_units')
      .select('*')
      .eq('course_id', courseId)
      .order('unit_number', { ascending: true });
    const unitsData = unitsDataRaw as UnitOption[] | null;

    let evaluaciones: ExamListItem[] = [];
    if (unitsData && unitsData.length > 0) {
      // 2. Obtener Exámenes agrupados por unidad (exams no tiene course_id directo)
      const unitIds = unitsData.map((u) => u.id);
      const { data: examsData } = await supabase
        .from('exams')
        .select('*')
        .in('unit_id', unitIds)
        .order('created_at', { ascending: false });
      evaluaciones = examsData ?? [];
    }

    return { ok: true, units: unitsData ?? [], evaluaciones };
  } catch (err) {
    console.error("Error cargando evaluaciones:", err);
    return { ok: false, error: err instanceof Error ? err.message : "No se pudieron cargar las evaluaciones." };
  }
}

// Hook orquestador: maneja el ciclo de recarga (reloadKey) que dispara el
// refetch en useEvaluacionesContent.
export function useEvaluaciones(courseId: string) {
  const [reloadKey, setReloadKey] = useState(0);

  return {
    reloadKey,
    onReload: () => setReloadKey((k) => k + 1),
  };
}

// Hook de la vista de contenido: carga los datos (con reloadKey para recarga
// manual) y guarda estado local editable.
export function useEvaluacionesContent(courseId: string, reloadKey: number) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FetchResult>({ ok: false, error: "" });
  const [evaluaciones, setEvaluaciones] = useState<ExamListItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchEvaluaciones(courseId, reloadKey).then((r) => {
      if (!isMounted) return;
      setResult(r);
      if (r.ok) setEvaluaciones(r.evaluaciones);
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [courseId, reloadKey]);

  const onStatusChange = (examId: string, status: string) => {
    setEvaluaciones(prev => prev.map(e => e.id === examId ? { ...e, status } : e));
  };

  return {
    loading,
    result,
    evaluaciones,
    onStatusChange,
  };
}

// Hook de la tarjeta de examen: encapsula el cambio de estado (publicar/cerrar) contra Supabase.
export function useExamCard(exam: ExamListItem, onStatusChange: (examId: string, status: string) => void) {
  const [changingStatus, setChangingStatus] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleStatusChange = async (newStatus: string) => {
    setChangingStatus(true);
    try {
      const { error } = await supabase.from('exams').update({ status: newStatus }).eq('id', exam.id);
      if (error) throw error;
      onStatusChange(exam.id, newStatus);
    } catch (err) {
      setFeedback({ type: 'error', message: `Error al cambiar el estado: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setChangingStatus(false);
    }
  };

  return { changingStatus, handleStatusChange, feedback, setFeedback };
}
