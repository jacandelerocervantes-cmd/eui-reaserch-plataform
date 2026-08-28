import { use, useMemo, useState } from "react";
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

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
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

// Hook orquestador: resuelve el recurso de datos (patrón use()+Suspense con recarga manual).
export function useDriveMateria(courseId: string) {
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchDrive(courseId, reloadKey), [courseId, reloadKey]);

  return {
    resource,
    reloadKey,
    onReload: () => setReloadKey((k) => k + 1),
  };
}

// Hook de la vista de contenido: consume el recurso, guarda estado local y expone
// los handlers que hacen llamadas a Supabase (alternar visibilidad / subir material).
export function useDriveMateriaContent(resource: Promise<FetchResult>, courseId: string) {
  const result = use(resource);

  const [units] = useState<UnitOption[]>(result.ok ? result.units : []);
  const [archivos, setArchivos] = useState<Archivo[]>(result.ok ? result.archivos : []);
  const [uploading, setUploading] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState("");

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

  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const unitFiles = selectedUnitId ? archivos.filter(a => a.unit_id === selectedUnitId) : [];

  return {
    result,
    units,
    archivos,
    uploading,
    selectedUnitId, setSelectedUnitId,
    selectedUnit,
    unitFiles,
    toggleVisibility,
    handleFileSelected,
  };
}
