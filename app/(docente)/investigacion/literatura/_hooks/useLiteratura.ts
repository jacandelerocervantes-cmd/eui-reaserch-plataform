import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export type Ref = { id: string; titulo: string; autores: string[] | null; año: number | null; doi: string | null; url: string | null; abstract: string | null; journal: string | null; created_at: string };
export type Gap = { vacios: string[]; tendencias_emergentes: string[]; autores_clave_no_citados: string[]; decadas_sin_cobertura: number[]; sugerencias_busqueda: string[] };

export function useLiteratura() {
  const [refs, setRefs] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [gap, setGap] = useState<Gap | null>(null);
  const [gapLoading, setGapLoading] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);
  const [doiInput, setDoiInput] = useState('');
  const [doiLoading, setDoiLoading] = useState(false);
  const [doiError, setDoiError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const doiRef = useRef<HTMLInputElement>(null);

  const fetchRefs = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.from('literatura_referencias').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setRefs(data ?? []);
    } catch (e) {
      console.error("Error cargando literatura:", e);
      setLoadError(e instanceof Error ? e.message : "No se pudo cargar tu biblioteca.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchRefs(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleImportDOI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doiInput.trim()) return;
    setDoiLoading(true); setDoiError('');
    const { data, error } = await supabase.functions.invoke('import-doi-metadata', { body: { doi: doiInput.trim() } });
    if (error || !data?.success) {
      setDoiError(data?.error ?? error?.message ?? 'Error importando DOI');
    } else {
      setDoiInput('');
      await fetchRefs();
    }
    setDoiLoading(false);
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    const { error } = await supabase.from('literatura_referencias').delete().eq('id', id);
    if (error) {
      console.error("Error eliminando referencia:", error);
      setDeleteError(error.message ?? "No se pudo eliminar la referencia.");
      return;
    }
    setRefs(prev => prev.filter(r => r.id !== id));
    setDeleteId(null);
  };

  const handleGapAnalysis = async () => {
    setGapLoading(true); setGap(null); setGapError(null);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-literature-gaps');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "El análisis de brechas no respondió correctamente.");
      setGap(data.data);
    } catch (e) {
      console.error("Error en análisis de brechas:", e);
      setGapError(e instanceof Error ? e.message : "No se pudo analizar la bibliografía.");
    } finally {
      setGapLoading(false);
    }
  };

  const filtered = refs.filter(r => {
    const q = search.toLowerCase();
    return !q || r.titulo.toLowerCase().includes(q) || (r.autores ?? []).some(a => a.toLowerCase().includes(q)) || r.journal?.toLowerCase().includes(q) || String(r.año ?? '').includes(q);
  });

  return {
    refs,
    loading,
    loadError,
    search, setSearch,
    gap,
    gapLoading,
    gapError,
    doiInput, setDoiInput,
    doiLoading,
    doiError,
    deleteId, setDeleteId,
    deleteError,
    doiRef,
    filtered,
    fetchRefs,
    handleImportDOI,
    handleDelete,
    handleGapAnalysis,
  };
}
