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

export type UnitActivity = {
  id: string;
  unit_id: string;
  name: string;
  weight_percentage: number;
};

export type UnitAssignment = {
  id: string;
  title: string;
  unit_id: string | null;
  rubric_data: { weight_percentage?: number } | null;
};

export type UnitExam = {
  id: string;
  title: string;
  unit_id: string | null;
};

export type UnitFormValues = { title: string; total_sessions: number };

export type UnitsResourceData = {
  units: CourseUnit[];
  activities: UnitActivity[];
  assignments: UnitAssignment[];
  exams: UnitExam[];
};

async function fetchUnitsData(courseId: string, _reloadKey: number): Promise<UnitsResourceData> {
  const { data: units } = await supabase
    .from("course_units")
    .select("*")
    .eq("course_id", courseId)
    .order("unit_number");

  const unitList = units ?? [];
  const unitIds = unitList.map((u: CourseUnit) => u.id);

  let activities: UnitActivity[] = [];
  let assignments: UnitAssignment[] = [];
  let exams: UnitExam[] = [];

  if (unitIds.length > 0) {
    const { data: actData } = await supabase
      .from("activities")
      .select("*")
      .in("unit_id", unitIds);
    activities = actData ?? [];

    const { data: asgData } = await supabase
      .from("assignments")
      .select("id, title, unit_id, rubric_data")
      .in("unit_id", unitIds);
    assignments = asgData ?? [];

    const { data: exData } = await supabase
      .from("exams")
      .select("id, title, unit_id")
      .in("unit_id", unitIds);
    exams = exData ?? [];
  }

  return { units: unitList, activities, assignments, exams };
}

export function useUnidades(courseId: string) {
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchUnitsData(courseId, reloadKey), [courseId, reloadKey]);
  const onReload = () => setReloadKey((k) => k + 1);
  return { resource, onReload };
}

export function useUnidadesLista(resource: Promise<UnitsResourceData>, courseId: string, onReload: () => void) {
  const data = use(resource);
  const { units, activities, assignments, exams } = data;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<UnitFormValues>({ title: "", total_sessions: 8 });
  const [isAdding, setIsAdding] = useState(false);
  const [newUnit, setNewUnit] = useState<UnitFormValues>({ title: "", total_sessions: 8 });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newUnit.title.trim()) return;
    setSaving(true);
    const nextNumber = units.length > 0 ? Math.max(...units.map((u: CourseUnit) => u.unit_number)) + 1 : 1;
    const { data: created, error } = await supabase.from("course_units").insert({
      course_id: courseId,
      unit_number: nextNumber,
      title: newUnit.title.trim(),
      total_sessions: newUnit.total_sessions,
    }).select().single();

    if (!error && created) {
      // Crear los 3 pilares estándar de evaluación para la nueva unidad (10% asist, 40% activ, 50% eval)
      await supabase.from("activities").insert([
        { unit_id: created.id, name: "Asistencia", weight_percentage: 10 },
        { unit_id: created.id, name: "Actividades", weight_percentage: 40 },
        { unit_id: created.id, name: "Evaluaciones", weight_percentage: 50 },
      ]);
      setNewUnit({ title: "", total_sessions: 8 });
      setIsAdding(false);
      onReload();
    } else if (error) {
      alert("Error al agregar: " + error.message);
    }
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
    if (!confirm(`¿Eliminar Unidad ${unit_number}? Se borrarán también las actividades y calificaciones asociadas.`)) return;
    const { error } = await supabase.from("course_units").delete().eq("id", id);
    if (!error) onReload();
    else alert("Error al eliminar: " + error.message);
  };

  const handleUpdateUnitPillars = async (unitId: string, assist: number, activ: number, evalw: number) => {
    const unitActs = activities.filter(a => a.unit_id === unitId);
    const assistAct = unitActs.find(a => a.name.toLowerCase().includes("asist"));
    const activAct = unitActs.find(a => a.name.toLowerCase().includes("activ") || a.name.toLowerCase().includes("tarea"));
    const evalAct = unitActs.find(a => a.name.toLowerCase().includes("eval") || a.name.toLowerCase().includes("examen"));

    const upserts = [
      { id: assistAct?.id, unit_id: unitId, name: "Asistencia", weight_percentage: assist },
      { id: activAct?.id, unit_id: unitId, name: "Actividades", weight_percentage: activ },
      { id: evalAct?.id, unit_id: unitId, name: "Evaluaciones", weight_percentage: evalw },
    ];

    await supabase.from("activities").upsert(upserts);
    onReload();
  };

  const handleUpdateAssignmentWeight = async (asgnId: string, weight: number) => {
    const asg = assignments.find(a => a.id === asgnId);
    const currentRubric = asg?.rubric_data || {};
    await supabase.from("assignments").update({
      rubric_data: { ...currentRubric, weight_percentage: weight }
    }).eq("id", asgnId);
    onReload();
  };

  const activeUnit = units.find((u: CourseUnit) => !u.is_closed);

  return {
    units,
    activities,
    assignments,
    exams,
    activeUnit,
    editingId, setEditingId,
    editValues, setEditValues,
    isAdding, setIsAdding,
    newUnit, setNewUnit,
    saving,
    handleAdd,
    handleEdit,
    handleDelete,
    handleUpdateUnitPillars,
    handleUpdateAssignmentWeight,
  };
}
