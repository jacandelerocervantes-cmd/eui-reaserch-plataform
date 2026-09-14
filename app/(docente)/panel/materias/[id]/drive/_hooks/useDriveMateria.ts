import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type UnitOption = { id: string; unit_number: number; title: string };
export type Archivo = {
  id: string;
  unit_id: string;
  nombre: string;
  tipo: string;
  url: string;
  size: string | null;
  ai: boolean;
  es_visible: boolean;
};

export type FetchResult = { ok: true; units: UnitOption[]; archivos: Archivo[] } | { ok: false; error: string };

async function fetchDrive(courseId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: unitsData } = await supabase
      .from('course_units')
      .select('id, unit_number, title')
      .eq('course_id', courseId)
      .order('unit_number', { ascending: true });

    const { data: materialsData } = await supabase
      .from('materiales_boveda')
      .select('*')
      .eq('materia_id', courseId)
      .order('created_at', { ascending: false });

    return { ok: true, units: unitsData ?? [], archivos: materialsData ?? [] };
  } catch (err) {
    console.error("Error al cargar material didáctico:", err);
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo cargar el material didáctico." };
  }
}

// Hook orquestador: expone reloadKey/onReload para recarga manual.
export function useDriveMateria(courseId: string) {
  const [reloadKey, setReloadKey] = useState(0);

  return {
    courseId,
    reloadKey,
    onReload: () => setReloadKey((k) => k + 1),
  };
}

// Hook de la vista de contenido: carga los datos, guarda estado local y expone
// los handlers que hacen llamadas a Supabase (alternar visibilidad / subir material).
export function useDriveMateriaContent(courseId: string, reloadKey: number) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FetchResult>({ ok: false, error: "" });

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState("");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchDrive(courseId, reloadKey).then((r) => {
      if (!isMounted) return;
      setResult(r);
      if (r.ok) {
        setUnits(r.units);
        setArchivos(r.archivos);
      }
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [courseId, reloadKey]);

  const toggleVisibility = async (fileId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setArchivos(prev => prev.map(f => f.id === fileId ? { ...f, es_visible: newStatus } : f));
    try {
      const { error } = await supabase.from('materiales_boveda').update({ es_visible: newStatus }).eq('id', fileId);
      if (error) throw error;
    } catch {
      alert("Error al actualizar la visibilidad en el servidor.");
      setArchivos(prev => prev.map(f => f.id === fileId ? { ...f, es_visible: currentStatus } : f));
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedUnitId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("course_id", courseId);
      formData.append("unit_id", selectedUnitId);
      formData.append("file", file);
      const { data, error } = await supabase.functions.invoke('upload-course-material', { body: formData });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Error al subir el material.");
      setArchivos(prev => [data.material, ...prev]);
    } catch (err) {
      alert(`Error al subir: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("¿Deseas eliminar este material de la bóveda?")) return;
    try {
      const { error } = await supabase.from('materiales_boveda').delete().eq('id', fileId);
      if (error) throw error;
      setArchivos(prev => prev.filter(f => f.id !== fileId));
    } catch {
      alert("Error al eliminar el material.");
    }
  };

  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const unitFiles = selectedUnitId ? archivos.filter(a => a.unit_id === selectedUnitId) : [];

  return {
    loading,
    result,
    units,
    archivos,
    uploading,
    selectedUnitId, setSelectedUnitId,
    selectedUnit,
    unitFiles,
    toggleVisibility,
    handleFileSelected,
    handleDelete,
  };
}
