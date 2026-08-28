import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type Proyecto = {
  id: string;
  titulo: string;
  descripcion: string | null;
  presupuesto: number | null;
  fecha_inicio: string | null;
  status: string;
  es_publico: boolean;
  con_financiamiento: boolean;
  avance: number | null;
  proximo_hito: string | null;
  fecha_hito: string | null;
};

export type NewProjectForm = { titulo: string; descripcion: string; presupuesto: string; fecha_inicio: string; es_publico: boolean; con_financiamiento: boolean };
export type NewProjectPayload = Omit<NewProjectForm, 'presupuesto'> & { presupuesto: number | null; status: string; avance: number };

export function useProyectosInvestigacion() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await supabase.from('proyectos_investigacion').select('*').eq('docente_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setProyectos(data ?? []);
    } catch (e) {
      console.error("Error cargando proyectos:", e);
      setLoadError(e instanceof Error ? e.message : "No se pudieron cargar los proyectos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchAll(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const prevStatus = proyectos.find(p => p.id === id)?.status;
    setProyectos(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    const { error } = await supabase.from('proyectos_investigacion').update({ status: newStatus }).eq('id', id);
    if (error) {
      console.error("Error actualizando estado del proyecto:", error);
      // Revierte el cambio optimista si el update falló de verdad en el servidor.
      if (prevStatus) setProyectos(prev => prev.map(p => p.id === id ? { ...p, status: prevStatus } : p));
    }
  };

  const handleCreate = async (formData: NewProjectPayload) => {
    if (!userId) return;
    setCreateError(null);
    const { data, error } = await supabase.from('proyectos_investigacion').insert({ ...formData, docente_id: userId }).select().single();
    if (!error && data) {
      setProyectos(prev => [data, ...prev]);
      setShowModal(false);
    } else {
      setCreateError(error?.message ?? "No se pudo crear el proyecto.");
    }
  };

  const filtered = proyectos.filter(p => {
    const matchSearch = p.titulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilter = !activeFilter || (activeFilter === 'En curso' && p.status === 'En Ejecución') || (activeFilter === 'Publicados' && p.es_publico) || (activeFilter === 'Con Fondos' && p.con_financiamiento);
    return matchSearch && matchFilter;
  });

  return {
    proyectos,
    loading,
    loadError,
    searchTerm, setSearchTerm,
    activeFilter, setActiveFilter,
    showModal, setShowModal,
    createError,
    filtered,
    fetchAll,
    handleUpdateStatus,
    handleCreate,
  };
}
