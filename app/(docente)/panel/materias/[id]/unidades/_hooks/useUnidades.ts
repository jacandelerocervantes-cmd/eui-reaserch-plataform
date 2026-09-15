import { useEffect, useState } from "react";
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

export function useUnidadesLista(courseId: string, reloadKey: number, onReload: () => void) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UnitsResourceData>({ units: [], activities: [], assignments: [], exams: [] });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchUnitsData(courseId, reloadKey).then((r) => {
      if (!isMounted) return;
      setData(r);
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [courseId, reloadKey]);

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

    const pillars = [
      { act: assistAct, name: "Asistencia", weight: assist },
      { act: activAct, name: "Actividades", weight: activ },
      { act: evalAct, name: "Evaluaciones", weight: evalw },
    ];

    const toUpdate: { id: string; unit_id: string; name: string; weight_percentage: number }[] = [];
    const toInsert: { unit_id: string; name: string; weight_percentage: number }[] = [];

    for (const p of pillars) {
      if (p.act?.id) {
        toUpdate.push({ id: p.act.id, unit_id: unitId, name: p.name, weight_percentage: p.weight });
      } else {
        toInsert.push({ unit_id: unitId, name: p.name, weight_percentage: p.weight });
      }
    }

    if (toUpdate.length > 0) {
      const { error } = await supabase.from("activities").upsert(toUpdate);
      if (error) {
        alert("Error al guardar ponderaciones: " + error.message);
        return;
      }
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from("activities").insert(toInsert);
      if (error) {
        alert("Error al guardar ponderaciones: " + error.message);
        return;
      }
    }
    onReload();
  };

  const handleUpdateAssignmentWeight = async (asgnId: string, weight: number) => {
    const asg = assignments.find(a => a.id === asgnId);
    const currentRubric = asg?.rubric_data || {};
    const { error } = await supabase.from("assignments").update({
      rubric_data: { ...currentRubric, weight_percentage: weight }
    }).eq("id", asgnId);
    if (!error) onReload();
    else alert("Error al guardar peso de actividad: " + error.message);
  };

  const handleUpdateUnitFull = async (
    unitId: string,
    title: string,
    totalSessions: number,
    assistWeight: number,
    activWeight: number,
    evalWeight: number,
    asgnWeights: Record<string, number>
  ) => {
    setSaving(true);
    try {
      const { error: unitErr } = await supabase.from("course_units")
        .update({ title: title.trim(), total_sessions: totalSessions })
        .eq("id", unitId);
      if (unitErr) throw unitErr;

      const unitActs = activities.filter(a => a.unit_id === unitId);
      const assistAct = unitActs.find(a => a.name.toLowerCase().includes("asist"));
      const activAct = unitActs.find(a => a.name.toLowerCase().includes("activ") || a.name.toLowerCase().includes("tarea"));
      const evalAct = unitActs.find(a => a.name.toLowerCase().includes("eval") || a.name.toLowerCase().includes("examen"));

      const pillars = [
        { act: assistAct, name: "Asistencia", weight: assistWeight },
        { act: activAct, name: "Actividades", weight: activWeight },
        { act: evalAct, name: "Evaluaciones", weight: evalWeight },
      ];

      const toUpdate: { id: string; unit_id: string; name: string; weight_percentage: number }[] = [];
      const toInsert: { unit_id: string; name: string; weight_percentage: number }[] = [];

      for (const p of pillars) {
        if (p.act?.id) {
          toUpdate.push({ id: p.act.id, unit_id: unitId, name: p.name, weight_percentage: p.weight });
        } else {
          toInsert.push({ unit_id: unitId, name: p.name, weight_percentage: p.weight });
        }
      }

      if (toUpdate.length > 0) {
        const { error: actsErr } = await supabase.from("activities").upsert(toUpdate);
        if (actsErr) throw actsErr;
      }
      if (toInsert.length > 0) {
        const { error: actsErr } = await supabase.from("activities").insert(toInsert);
        if (actsErr) throw actsErr;
      }

      await Promise.all(
        Object.entries(asgnWeights).map(async ([asgnId, weight]) => {
          const asg = assignments.find(a => a.id === asgnId);
          const currentRubric = asg?.rubric_data || {};
          const { error } = await supabase.from("assignments").update({
            rubric_data: { ...currentRubric, weight_percentage: weight }
          }).eq("id", asgnId);
          if (error) throw error;
        })
      );

      onReload();
    } catch (err: unknown) {
      alert("Error al guardar unidad: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const activeUnit = units.find((u: CourseUnit) => !u.is_closed);

  return {
    loading,
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
    handleUpdateUnitFull,
  };
}
