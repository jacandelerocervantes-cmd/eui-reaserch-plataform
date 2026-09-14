import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type Tesista = { id: string; nombre: string; email: string; titulo_tesis: string; etapa: string; avance: number; fecha_defensa: string | null; notas: string | null };
export type Feedback = { fortalezas: string[]; areas_mejora: string[]; preguntas_defensa: string[]; siguiente_paso: string; tiempo_estimado_siguiente_etapa: string };

export type TesistaForm = { nombre: string; email: string; titulo_tesis: string; etapa: string; avance: number; fecha_defensa: string; notas: string };
export type TesistaPayload = Omit<TesistaForm, 'avance' | 'fecha_defensa'> & { avance: number; fecha_defensa: string | null };

export function useTesistas() {
  const [tesistas, setTesistas] = useState<Tesista[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await supabase.from('tesistas').select('*').eq('docente_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setTesistas(data ?? []);
    } catch (e) {
      console.error("Error cargando tesistas:", e);
      setLoadError(e instanceof Error ? e.message : "No se pudieron cargar los tesistas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchAll(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleCreate = async (formData: TesistaPayload) => {
    if (!userId) return;
    setCreateError(null);
    const { data, error } = await supabase.from('tesistas').insert({ ...formData, docente_id: userId }).select().single();
    if (!error && data) {
      setTesistas(prev => [data, ...prev]);
      setShowModal(false);
    } else {
      setCreateError(error?.message ?? "No se pudo registrar al tesista.");
    }
  };

  const handleEtapaChange = async (id: string, newEtapa: string) => {
    const prevEtapa = tesistas.find(t => t.id === id)?.etapa;
    setTesistas(prev => prev.map(t => t.id === id ? { ...t, etapa: newEtapa } : t));
    const { error } = await supabase.from('tesistas').update({ etapa: newEtapa }).eq('id', id);
    if (error) {
      console.error("Error actualizando etapa del tesista:", error);
      setTesistas(prev => prev.map(t => t.id === id ? { ...t, etapa: prevEtapa ?? t.etapa } : t));
    }
  };

  const handleAvanceChange = async (id: string, newAvance: number) => {
    const prevAvance = tesistas.find(t => t.id === id)?.avance;
    setTesistas(prev => prev.map(t => t.id === id ? { ...t, avance: newAvance } : t));
    const { error } = await supabase.from('tesistas').update({ avance: newAvance }).eq('id', id);
    if (error) {
      console.error("Error actualizando avance del tesista:", error);
      setTesistas(prev => prev.map(t => t.id === id ? { ...t, avance: prevAvance ?? t.avance } : t));
    }
  };

  const handleGetFeedback = async (tesistaId: string) => {
    setFeedbackLoading(tesistaId);
    setFeedbackError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-tesis-feedback', { body: { tesista_id: tesistaId } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "La retroalimentación no se pudo generar.");
      setFeedback(data.data);
    } catch (e) {
      console.error("Error generando retroalimentación de tesis:", e);
      setFeedbackError(e instanceof Error ? e.message : "No se pudo generar la retroalimentación.");
    } finally {
      setFeedbackLoading(null);
    }
  };

  const activos = tesistas.filter(t => t.etapa !== 'graduado');
  const graduados = tesistas.filter(t => t.etapa === 'graduado');

  return {
    tesistas, loading, loadError, fetchAll,
    showModal, setShowModal,
    createError,
    feedback, setFeedback,
    feedbackLoading, feedbackError,
    handleCreate,
    handleEtapaChange,
    handleAvanceChange,
    handleGetFeedback,
    activos, graduados,
  };
}
