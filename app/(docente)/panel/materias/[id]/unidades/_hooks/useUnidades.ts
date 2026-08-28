import { use, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type CourseUnit = {
  id: string;
  unit_number: number;
  title: string;
  total_sessions: number;
  is_closed: boolean;
  closed_at: string | null;
};

export type UnitFormValues = { title: string; total_sessions: number };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary.
async function fetchUnits(courseId: string, _reloadKey: number): Promise<CourseUnit[]> {
  const { data } = await supabase
    .from("course_units")
    .select("*")
    .eq("course_id", courseId)
    .order("unit_number");
  return data ?? [];
}

/**
 * Maneja el ciclo de recarga (reloadKey) y crea el `resource` (promesa) que
 * el componente de contenido consume con `use()` dentro de un Suspense.
 */
export function useUnidades(courseId: string) {
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchUnits(courseId, reloadKey), [courseId, reloadKey]);
  const onReload = () => setReloadKey((k) => k + 1);
  return { resource, onReload };
}

/**
 * Consume el `resource` (dentro del árbol de Suspense) y expone el estado y
 * los handlers de mutación (agregar, editar, eliminar unidad) para la lista.
 */
export function useUnidadesLista(resource: Promise<CourseUnit[]>, courseId: string, onReload: () => void) {
  const units = use(resource);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<UnitFormValues>({ title: "", total_sessions: 8 });
  const [isAdding, setIsAdding] = useState(false);
  const [newUnit, setNewUnit] = useState<UnitFormValues>({ title: "", total_sessions: 8 });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newUnit.title.trim()) return;
    setSaving(true);
    const nextNumber = units.length > 0 ? Math.max(...units.map((u: CourseUnit) => u.unit_number)) + 1 : 1;
    const { error } = await supabase.from("course_units").insert({
      course_id: courseId,
      unit_number: nextNumber,
      title: newUnit.title.trim(),
      total_sessions: newUnit.total_sessions,
    });
    if (!error) { setNewUnit({ title: "", total_sessions: 8 }); setIsAdding(false); onReload(); }
    else alert("Error al agregar: " + error.message);
    setSaving(false);
  };

  const handleEdit = async (id: string) => {
    if (!editValues.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("course_units")
      .update({ title: editValues.title.trim(), total_sessions: editValues.total_sessions })
      .eq("id", id);
    if (!error) { setEditingId(null); onReload(); }
    else alert("Error al guardar: " + error.message);
    setSaving(false);
  };

  const handleDelete = async (id: string, unit_number: number) => {
    if (!confirm(`¿Eliminar Unidad ${unit_number}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("course_units").delete().eq("id", id);
    if (!error) onReload();
    else alert("Error al eliminar: " + error.message);
  };

  const activeUnit = units.find((u: CourseUnit) => !u.is_closed);

  return {
    units,
    activeUnit,
    editingId, setEditingId,
    editValues, setEditValues,
    isAdding, setIsAdding,
    newUnit, setNewUnit,
    saving,
    handleAdd,
    handleEdit,
    handleDelete,
  };
}
