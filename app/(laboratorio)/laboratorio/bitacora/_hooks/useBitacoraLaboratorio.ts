import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { uploadValidated } from "@/lib/uploadValidated";

export type EntidadItem = string | { nombre: string; valor: string | number; unidad?: string };
export type Entidades = Partial<Record<'muestras' | 'reactivos' | 'parametros' | 'observaciones' | 'proximos_pasos' | 'posibles_errores', EntidadItem[]>>;
export type Entrada = { id: string; titulo: string; contenido: string; autor_id: string; foto_url: string | null; created_at: string; entidades?: Entidades };

export function useBitacoraLaboratorio() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: '', contenido: '' });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await supabase.from('entradas_bitacora').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setEntradas(data ?? []);
    } catch (e) {
      console.error("Error cargando bitácora:", e);
      setLoadError(e instanceof Error ? e.message : "No se pudo cargar la bitácora.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchAll(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !form.titulo.trim() || !form.contenido.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      let foto_url: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const path = `bitacora/${userId}/${Date.now()}.${ext}`;
        const { publicUrl } = await uploadValidated({ bucket: 'campo-capturas', path, file: photoFile });
        foto_url = publicUrl;
      }

      const { data, error } = await supabase.from('entradas_bitacora').insert({
        titulo: form.titulo,
        contenido: form.contenido,
        autor_id: userId,
        foto_url,
      }).select().single();

      if (error) throw error;

      setEntradas(prev => [data, ...prev]);
      setForm({ titulo: '', contenido: '' });
      setPhotoFile(null);
      setShowForm(false);
    } catch (e) {
      console.error("Error guardando entrada:", e);
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar la entrada.");
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyze = async (id: string, contenido: string) => {
    setAnalyzing(id);
    setAnalyzeError(null);
    try {
      const { data, error } = await supabase.functions.invoke('extract-eln-entities', { body: { contenido } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "El análisis no se pudo completar.");
      setEntradas(prev => prev.map(e => e.id === id ? { ...e, entidades: data.data } : e));
    } catch (e) {
      console.error("Error analizando entrada:", e);
      setAnalyzeError(e instanceof Error ? e.message : "No se pudo analizar la entrada.");
    } finally {
      setAnalyzing(null);
    }
  };

  const toggleExpand = (id: string) => setExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return {
    entradas,
    loading,
    loadError,
    showForm, setShowForm,
    form, setForm,
    photoFile, setPhotoFile,
    saving,
    saveError,
    analyzing,
    analyzeError,
    expanded,
    photoRef,
    fetchAll,
    handleSave,
    handleAnalyze,
    toggleExpand,
  };
}
