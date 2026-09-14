import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getPendingCount } from "@/lib/campoDb";
import type { Mision, MisionPayload } from "../_components/types";

export function useCampo() {
  const [misiones, setMisiones] = useState<Mision[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await supabase.from('misiones_campo').select('*').eq('docente_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setMisiones(data ?? []);
    } catch (e) {
      console.error("Error cargando misiones:", e);
      setLoadError(e instanceof Error ? e.message : "No se pudieron cargar las misiones de campo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchAll(); }, 0);
    getPendingCount().then(setPendingSync).catch((e) => console.error("Error contando pendientes de sync:", e));
    return () => clearTimeout(t);
  }, []);

  const handleCreate = async (formData: MisionPayload) => {
    if (!userId) return;
    setCreateError(null);
    const { data, error } = await supabase.from('misiones_campo').insert({ ...formData, docente_id: userId }).select().single();
    if (!error && data) {
      setMisiones(prev => [data, ...prev]);
      setShowModal(false);
    } else {
      setCreateError(error?.message ?? "No se pudo crear la misión.");
    }
  };

  const filtered = activeFilter ? misiones.filter(m => m.status === activeFilter) : misiones;
  const activas = misiones.filter(m => m.status === 'activa').length;

  return {
    misiones, loading, loadError, fetchAll,
    pendingSync,
    showModal, setShowModal,
    userId,
    activeFilter, setActiveFilter,
    createError, handleCreate,
    filtered, activas,
  };
}
