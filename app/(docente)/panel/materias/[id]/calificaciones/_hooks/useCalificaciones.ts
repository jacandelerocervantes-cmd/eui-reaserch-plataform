import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Unit, Activity, Student, GradeRow, GradesMap, AttendanceRow } from "../_components/types";

export function useCalificaciones(courseId: string) {
  // ESTADOS GLOBALES
  const [currentView, setCurrentView] = useState<'units' | 'capture' | 'final' | 'sabana'>('units');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // NUEVO ESTADO: Controlar qué tarjetas están colapsadas (por defecto todas abiertas: false)
  const [collapsedUnits, setCollapsedUnits] = useState<{ [key: string]: boolean }>({});

  // Estados para Modales
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [activeUnitId, setActiveUnitId] = useState("");
  const [newActivity, setNewActivity] = useState({ name: "", weight: "" });

  // LÓGICA DINÁMICA DE CRITERIOS DE UNIDAD
  const [unitCriteria, setUnitCriteria] = useState([
    { id: 1, name: "Asistencia", weight: 10 },
    { id: 2, name: "Actividades", weight: 50 },
    { id: 3, name: "Evaluación", weight: 40 }
  ]);
  const totalWeight = unitCriteria.reduce((sum, c) => sum + Number(c.weight), 0);
  const isWeightValid = totalWeight === 100 && unitCriteria.length > 0;

  const handleAddUnitCriterion = () => setUnitCriteria([...unitCriteria, { id: Date.now(), name: "", weight: 0 }]);
  const handleRemoveUnitCriterion = (id: number) => setUnitCriteria(unitCriteria.filter(c => c.id !== id));
  const handleUpdateUnitCriterion = (id: number, field: string, value: string | number) => setUnitCriteria(unitCriteria.map(c => c.id === id ? { ...c, [field]: value } : c));

  // Estados de Captura y Sabana
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [grades, setGrades] = useState<GradesMap>({});
  const [isSaving, setIsSaving] = useState(false);
  const [allGrades, setAllGrades] = useState<GradeRow[]>([]);
  const [lockedUnits, setLockedUnits] = useState<{ [key: string]: boolean }>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: unitsData } = await supabase.from("course_units").select("*").eq("course_id", courseId).order("unit_number", { ascending: true });
      if (unitsData) setUnits(unitsData);

      const { data: actsData } = await supabase.from("activities").select("*, course_units!inner(course_id)").eq("course_units.course_id", courseId);
      if (actsData) setActivities(actsData);

      const { data: stData } = await supabase.from("students").select("*").eq("course_id", courseId).order("apellido_paterno", { ascending: true });
      if (stData) setStudents(stData);

    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "No se pudo cargar la información de calificaciones.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!courseId) return;
    const t = setTimeout(() => { fetchData(); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const getUnitTotalWeight = (unitId: string) => activities.filter(a => a.unit_id === unitId).reduce((sum, act) => sum + act.weight_percentage, 0);

  const openNewUnitModal = () => {
    setNewUnitName("");
    setUnitCriteria([
      { id: Date.now(), name: "Asistencia", weight: 10 },
      { id: Date.now() + 1, name: "Actividades", weight: 50 },
      { id: Date.now() + 2, name: "Evaluación", weight: 40 }
    ]);
    setShowUnitModal(true);
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !isWeightValid) return;
    try {
      const nextNumber = units.length + 1;
      const { data: unit, error } = await supabase.from("course_units").insert([{ course_id: courseId, name: newUnitName.trim(), unit_number: nextNumber }]).select().single();
      if (error) throw error;

      if (unit && unitCriteria.length > 0) {
        const autoActs = unitCriteria.filter(c => c.name.trim() !== "").map(c => ({
          unit_id: unit.id,
          name: c.name.trim(),
          weight_percentage: Number(c.weight)
        }));
        if (autoActs.length > 0) await supabase.from("activities").insert(autoActs);
      }
      setShowUnitModal(false);
      fetchData();
    } catch { alert("Error creando unidad"); }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.name.trim() || !newActivity.weight) return;
    try {
      const { error } = await supabase.from("activities").insert([{ unit_id: activeUnitId, name: newActivity.name.trim(), weight_percentage: parseInt(newActivity.weight) }]);
      if (error) throw error;
      setNewActivity({ name: "", weight: "" });
      setShowActivityModal(false);
      fetchData();
    } catch { alert("Error agregando criterio"); }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("¿Eliminar este criterio? Se borrarán las calificaciones asociadas.")) return;
    try {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar el criterio.");
    }
  };

  // --- PRECARGA AUTOMÁTICA DE LOS 3 CRITERIOS ESTÁNDAR ---
  // Asistencia/Actividades/Evaluación ya se sugieren como criterios al crear
  // la unidad; esto rellena su VALOR real desde los datos de la materia (no
  // solo el nombre) para que el docente no tenga que volver a teclear lo que
  // ya existe en otras secciones — solo define el peso (%) de cada uno.
  // Nunca pisa una nota que el docente ya guardó a mano para ese alumno.
  const autoFillStandardCriteria = async (unit: Unit, unitActs: Activity[], gradesMap: GradesMap) => {
    const attendanceCrit = unitActs.find(a => a.name.toLowerCase().includes("asist"));
    const activitiesCrit = unitActs.find(a =>
      a.name.toLowerCase().includes("activ") ||
      a.name.toLowerCase().includes("tarea") ||
      a.name.toLowerCase().includes("práct") ||
      a.name.toLowerCase().includes("pract") ||
      a.name.toLowerCase().includes("trabaj")
    );
    const examCrit = unitActs.find(a =>
      a.name.toLowerCase().includes("eval") ||
      a.name.toLowerCase().includes("examen") ||
      a.name.toLowerCase().includes("cuest") ||
      a.name.toLowerCase().includes("test")
    );

    if (attendanceCrit) {
      const { data: att } = await supabase.from("validated_attendances").select("student_id, status").eq("course_id", courseId);
      const sums: Record<string, number> = {}, counts: Record<string, number> = {};
      ((att ?? []) as AttendanceRow[]).forEach((r) => { sums[r.student_id] = (sums[r.student_id] || 0) + r.status; counts[r.student_id] = (counts[r.student_id] || 0) + 1; });
      students.forEach(s => {
        const key = `${s.id}_${attendanceCrit.id}`;
        if ((gradesMap[key] === undefined || gradesMap[key] === null || gradesMap[key] === "") && counts[s.id]) {
          gradesMap[key] = ((sums[s.id] / counts[s.id]) * 100).toFixed(0);
        }
      });
    }

    if (activitiesCrit) {
      const { data: assignmentsData } = await supabase.from("assignments").select("id").eq("unit_id", unit.id);
      const assignmentIds = (assignmentsData ?? []).map((a: { id: string }) => a.id);
      if (assignmentIds.length > 0) {
        const { data: subs } = await supabase.from("submissions").select("student_id, final_score, ai_score, status").in("assignment_id", assignmentIds);
        const byStudent: Record<string, number[]> = {};
        (subs ?? []).forEach((s: { student_id: string; final_score: number | null; ai_score: number | null; status: string }) => {
          const score = s.final_score ?? (s.status === 'ai_draft' ? s.ai_score : null);
          if (score != null) (byStudent[s.student_id] ??= []).push(Number(score));
        });
        Object.entries(byStudent).forEach(([studentId, scores]) => {
          const key = `${studentId}_${activitiesCrit.id}`;
          if (gradesMap[key] === undefined || gradesMap[key] === null || gradesMap[key] === "") {
            gradesMap[key] = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
          }
        });
      }
    }

    if (examCrit) {
      const { data: examsData } = await supabase.from("exams").select("id").eq("unit_id", unit.id);
      const examIds = (examsData ?? []).map((e: { id: string }) => e.id);
      if (examIds.length > 0) {
        const { data: responses } = await supabase.from("evaluation_responses").select("student_id, final_score, score_ia").in("exam_id", examIds);
        const byStudent: Record<string, number[]> = {};
        (responses ?? []).forEach((r: { student_id: string; final_score: number | null; score_ia: number | null }) => {
          const score = r.final_score ?? r.score_ia;
          if (score != null) (byStudent[r.student_id] ??= []).push(Number(score));
        });
        Object.entries(byStudent).forEach(([studentId, scores]) => {
          const key = `${studentId}_${examCrit.id}`;
          if (gradesMap[key] === undefined || gradesMap[key] === null || gradesMap[key] === "") {
            gradesMap[key] = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
          }
        });
      }
    }
  };

  // --- LÓGICA DE CAPTURA ---
  const handleOpenCapture = async (unit: Unit) => {
    setSelectedUnit(unit);
    setCurrentView('capture');

    const unitActs = activities.filter(a => a.unit_id === unit.id);
    const unitActIds = unitActs.map(a => a.id);
    const { data: gr } = await supabase.from("grades").select("*").in("activity_id", unitActIds);

    const gradesMap: GradesMap = {};
    (gr as GradeRow[] | null)?.forEach((g) => { gradesMap[`${g.student_id}_${g.activity_id}`] = g.score; });
    await autoFillStandardCriteria(unit, unitActs, gradesMap);
    setGrades(gradesMap);
  };

  const handleSaveGrades = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(grades).map(([key, score]) => {
        const [student_id, activity_id] = key.split("_");
        return { student_id, activity_id, score: Number(score) };
      });
      if (updates.length > 0) {
        const { error } = await supabase.from("grades").upsert(updates, { onConflict: "student_id, activity_id" });
        if (error) throw error;
      }
      alert("Calificaciones guardadas exitosamente.");
    } catch { alert("Error al guardar las calificaciones."); } finally { setIsSaving(false); }
  };

  const handleMagicAttendance = async () => {
    if (selectedUnit?.is_closed) return;
    const assistCriterio = activities.find(a => a.unit_id === selectedUnit?.id && a.name.toLowerCase().includes("asist"));
    if (!assistCriterio) return alert("Para usar la magia, necesitas un criterio que contenga la palabra 'Asistencia'.");

    alert("Calculando asistencia global desde el inicio del curso...");
    const { data: att } = await supabase.from("validated_attendances").select("student_id, status").eq("course_id", courseId);
    if (!att || att.length === 0) return alert("No hay pases de lista registrados en esta materia.");

    const studentAtt: Record<string, number> = {};
    const totalSessions: Record<string, number> = {};

    (att as AttendanceRow[]).forEach((r) => {
      studentAtt[r.student_id] = (studentAtt[r.student_id] || 0) + r.status;
      totalSessions[r.student_id] = (totalSessions[r.student_id] || 0) + 1;
    });

    const newGrades = { ...grades };
    students.forEach(s => {
      if (totalSessions[s.id]) {
        const pct = (studentAtt[s.id] / totalSessions[s.id]) * 100;
        newGrades[`${s.id}_${assistCriterio.id}`] = pct.toFixed(0);
      } else {
        newGrades[`${s.id}_${assistCriterio.id}`] = 0;
      }
    });

    setGrades(newGrades);
    alert("✨ Asistencia sincronizada. Recuerda darle a 'Guardar'.");
  };

  const handleToggleCloseUnit = async (targetUnit?: Unit) => {
    const unitToToggle = targetUnit || selectedUnit;
    if (!unitToToggle) return;
    const newStatus = !unitToToggle.is_closed;
    const confirmMsg = newStatus
      ? `¿Estás seguro de cerrar ${unitToToggle.name}? Ya no podrás editar las calificaciones.`
      : `¿Deseas reabrir ${unitToToggle.name} para edición?`;

    if (!confirm(confirmMsg)) return;

    const { error } = await supabase.from("course_units").update({ is_closed: newStatus }).eq("id", unitToToggle.id);
    if (!error) {
      if (!targetUnit) setSelectedUnit({ ...unitToToggle, is_closed: newStatus });
      setUnits(units.map(u => u.id === unitToToggle.id ? { ...u, is_closed: newStatus } : u));
    }
  };

  const handleOpenFinalGrades = async () => {
    setCurrentView('final');
    setLoading(true);
    const unitIds = units.map(u => u.id);
    const actIds = activities.filter(a => unitIds.includes(a.unit_id)).map(a => a.id);
    const { data: gr } = await supabase.from("grades").select("*").in("activity_id", actIds);
    setAllGrades(gr || []);

    const gradesMap: GradesMap = {};
    (gr as GradeRow[] | null)?.forEach((g) => { gradesMap[`${g.student_id}_${g.activity_id}`] = g.score; });

    // Precarga automática en vivo por cada unidad
    for (const unit of units) {
      await autoFillStandardCriteria(unit, activities.filter(a => a.unit_id === unit.id), gradesMap);
    }
    setGrades(gradesMap);
    setLoading(false);
  };

  // --- LÓGICA DE EXPORTACIÓN ACTUALIZADA CON EDGE FUNCTION ---
  const handleExportToSheets = async () => {
    setIsSaving(true);
    try {
      // 1. Obtenemos todas las calificaciones para armar la sábana completa
      const unitIds = units.map(u => u.id);
      const actIds = activities.filter(a => unitIds.includes(a.unit_id)).map(a => a.id);
      const { data: fullGrades } = await supabase.from("grades").select("*").in("activity_id", actIds);

      // 2. Preparamos el Payload estructurado
      const matrixData = {
        unidades: units.map(u => ({
          numero: u.unit_number,
          nombre: u.name,
          criterios: activities.filter(a => a.unit_id === u.id).map(a => ({ nombre: a.name, valor: a.weight_percentage }))
        })),
        alumnos: students.map(s => {
          let finalSum = 0;
          const unidadesAlumno = units.map(u => {
            let uSum = 0;
            const notasCriterios = activities.filter(a => a.unit_id === u.id).map(act => {
              // Buscar en estados locales primero, si no en fullGrades
              const scoreStr = grades[`${s.id}_${act.id}`];
              const score = scoreStr !== undefined ? Number(scoreStr) : ((fullGrades as GradeRow[] | null)?.find((g) => g.student_id === s.id && g.activity_id === act.id)?.score || 0);
              uSum += (score * (act.weight_percentage / 100));
              return score;
            });
            finalSum += uSum;
            return { promedioUnidad: uSum.toFixed(1), notas: notasCriterios };
          });

          return {
            matricula: s.matricula,
            nombre: `${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim(),
            unidades: unidadesAlumno,
            promedioFinal: units.length > 0 ? (finalSum / units.length).toFixed(1) : "0.0"
          };
        })
      };

      // 3. Enviamos a Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('sync-grading-matrix', {
        body: { courseId, matrixData }
      });

      if (error || !data.success) throw new Error(data?.error || "Error de sincronización con el servidor");
      alert("🚀 ¡Sábana de Calificaciones sincronizada en Google Drive!");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ocurrió un error al exportar");
    } finally {
      setIsSaving(false);
    }
  };

  // --- NUEVA LÓGICA DE SÁBANA ---
  const handleOpenSabana = async () => {
    setCurrentView('sabana');
    setLoading(true);
    const unitIds = units.map(u => u.id);
    const actIds = activities.filter(a => unitIds.includes(a.unit_id)).map(a => a.id);
    const { data: gr } = await supabase.from("grades").select("*").in("activity_id", actIds);

    const gradesMap: GradesMap = {};
    (gr as GradeRow[] | null)?.forEach((g) => { gradesMap[`${g.student_id}_${g.activity_id}`] = g.score; });

    // Precarga automática por unidad (mismo criterio que en Captura).
    for (const unit of units) {
      await autoFillStandardCriteria(unit, activities.filter(a => a.unit_id === unit.id), gradesMap);
    }
    setGrades(gradesMap);

    // Sincronizar bloqueos locales con estado de BD
    const initialLocks: Record<string, boolean> = {};
    units.forEach(u => initialLocks[u.id] = u.is_closed);
    setLockedUnits(initialLocks);

    setLoading(false);
  };

  const toggleLockSabana = async (unit: Unit) => {
    const isLocking = !lockedUnits[unit.id];
    if (isLocking) {
      if (!confirm(`¿Seguro que deseas cerrar la Unidad ${unit.unit_number}? Ya no se podrán editar calificaciones.`)) return;
    }
    // Actualizamos en BD para mantener sincronía
    await handleToggleCloseUnit(unit);
    setLockedUnits(prev => ({ ...prev, [unit.id]: isLocking }));
  };

  const inputStyle = (locked: boolean) => ({
    width: "55px", padding: "8px", borderRadius: "8px",
    border: locked ? "none" : "1px solid #cbd5e1",
    backgroundColor: locked ? "transparent" : "white",
    textAlign: "center" as const, fontWeight: "700",
    color: locked ? "#94a3b8" : "#1B396A",
    outline: "none", cursor: locked ? "not-allowed" : "text"
  });

  return {
    currentView, setCurrentView,
    loading, error,
    units, activities, students,
    collapsedUnits, setCollapsedUnits,
    showUnitModal, setShowUnitModal,
    showActivityModal, setShowActivityModal,
    newUnitName, setNewUnitName,
    activeUnitId, setActiveUnitId,
    newActivity, setNewActivity,
    unitCriteria, totalWeight, isWeightValid,
    handleAddUnitCriterion, handleRemoveUnitCriterion, handleUpdateUnitCriterion,
    selectedUnit, grades, setGrades,
    isSaving, allGrades, lockedUnits,
    fetchData,
    getUnitTotalWeight,
    openNewUnitModal,
    handleAddUnit,
    handleAddActivity,
    handleDeleteActivity,
    handleOpenCapture,
    handleSaveGrades,
    handleMagicAttendance,
    handleToggleCloseUnit,
    handleOpenFinalGrades,
    handleExportToSheets,
    handleOpenSabana,
    toggleLockSabana,
    inputStyle,
  };
}
