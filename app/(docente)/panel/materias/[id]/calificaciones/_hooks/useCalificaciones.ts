import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatStudentName } from "@/lib/formatStudentName";
import { sumWeights, isWeightComplete } from "@/lib/weightValidation";
import type { Unit, Activity, Student, Assignment, Exam, GradeRow, GradesMap, AttendanceRow } from "../_components/types";

export function useCalificaciones(courseId: string) {
  // ESTADOS GLOBALES
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Estados de Captura
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [grades, setGrades] = useState<GradesMap>({});
  const [isSaving, setIsSaving] = useState(false);
  const [allGrades, setAllGrades] = useState<GradeRow[]>([]);
  const [assignmentWeights, setAssignmentWeights] = useState<Record<string, number>>({});
  const [examWeights, setExamWeights] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: unitsData, error: unitsErr } = await supabase
        .from("course_units")
        .select("*")
        .eq("course_id", courseId)
        .order("unit_number", { ascending: true });
      if (unitsErr) throw unitsErr;
      if (unitsData) {
        setUnits(
          (unitsData as { id: string; name?: string; title?: string; unit_number: number; is_closed: boolean }[]).map(u => ({
            id: u.id,
            name: u.name || u.title || `Unidad ${u.unit_number}`,
            unit_number: u.unit_number,
            is_closed: u.is_closed,
          }))
        );
      }

      const { data: actsData, error: actsErr } = await supabase
        .from("activities")
        .select("*, course_units!inner(course_id)")
        .eq("course_units.course_id", courseId);
      if (actsErr) throw actsErr;
      if (actsData) setActivities(actsData);

      const { data: asgData, error: asgErr } = await supabase
        .from("assignments")
        .select("id, unit_id, title, submission_type, rubric_data")
        .eq("course_id", courseId);
      if (asgErr) throw asgErr;
      if (asgData) {
        setAssignments(asgData);
        const weights: Record<string, number> = {};
        (asgData as (Assignment & { rubric_data?: { weight_percentage?: number } })[]).forEach(a => {
          if (a.rubric_data && typeof a.rubric_data.weight_percentage === "number") {
            weights[a.id] = a.rubric_data.weight_percentage;
          }
        });
        setAssignmentWeights(weights);
      }

      const { data: exData, error: exErr } = await supabase
        .from("exams")
        .select("id, unit_id, title")
        .eq("course_id", courseId);
      if (exErr) throw exErr;
      if (exData) setExams(exData);

      const { data: stData, error: stErr } = await supabase
        .from("students")
        .select("*")
        .eq("course_id", courseId)
        .order("apellido_paterno", { ascending: true });
      if (stErr) throw stErr;
      if (stData) setStudents(stData);
    } catch (err) {
      console.error("Error al cargar calificaciones:", err);
      setError(err instanceof Error ? err.message : "No se pudo cargar la información de calificaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!courseId) return;
    const t = setTimeout(() => { fetchData(); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const handleUpdateUnitPillars = async (unitId: string, assistWeight: number, activWeight: number, evalWeight: number) => {
    try {
      const unitActs = activities.filter(a => a.unit_id === unitId);
      const assistAct = unitActs.find(a => a.name.toLowerCase().includes("asist"));
      const activAct = unitActs.find(a =>
        a.name.toLowerCase().includes("activ") ||
        a.name.toLowerCase().includes("tarea") ||
        a.name.toLowerCase().includes("práct") ||
        a.name.toLowerCase().includes("pract") ||
        a.name.toLowerCase().includes("trabaj")
      );
      const evalAct = unitActs.find(a =>
        a.name.toLowerCase().includes("eval") ||
        a.name.toLowerCase().includes("examen") ||
        a.name.toLowerCase().includes("cuest")
      );

      const upserts: { id?: string; unit_id: string; name: string; weight_percentage: number }[] = [];

      if (assistAct) upserts.push({ id: assistAct.id, unit_id: unitId, name: "Asistencia", weight_percentage: assistWeight });
      else upserts.push({ unit_id: unitId, name: "Asistencia", weight_percentage: assistWeight });

      if (activAct) upserts.push({ id: activAct.id, unit_id: unitId, name: "Actividades", weight_percentage: activWeight });
      else upserts.push({ unit_id: unitId, name: "Actividades", weight_percentage: activWeight });

      if (evalAct) upserts.push({ id: evalAct.id, unit_id: unitId, name: "Evaluaciones", weight_percentage: evalWeight });
      else upserts.push({ unit_id: unitId, name: "Evaluaciones", weight_percentage: evalWeight });

      // Si había otros criterios legacy, borrarlos para dejar los 3 pilares limpios
      const otherActs = unitActs.filter(a => a.id !== assistAct?.id && a.id !== activAct?.id && a.id !== evalAct?.id);
      if (otherActs.length > 0) {
        const { error: delErr } = await supabase.from("activities").delete().in("id", otherActs.map(a => a.id));
        if (delErr) {
          setFeedback({ type: "error", message: "Error al limpiar criterios anteriores: " + delErr.message });
          return;
        }
      }

      const { error: upsertErr } = await supabase.from("activities").upsert(upserts);
      if (upsertErr) {
        setFeedback({ type: "error", message: "Error al guardar ponderación de la unidad: " + upsertErr.message });
        return;
      }

      await fetchData();
      setFeedback({ type: "success", message: "Ponderación de la unidad guardada exitosamente." });
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Error guardando ponderación de la unidad." });
    }
  };

  const handleUpdateAssignmentWeight = async (asgnId: string, weight: number) => {
    setAssignmentWeights(prev => ({ ...prev, [asgnId]: weight }));
    try {
      const asgn = assignments.find(a => a.id === asgnId);
      const currentRubric = (asgn?.rubric_data as Record<string, unknown>) || {};
      const newRubric = { ...currentRubric, weight_percentage: weight };
      const { error } = await supabase.from("assignments").update({ rubric_data: newRubric }).eq("id", asgnId);
      if (error) {
        setFeedback({ type: "error", message: "Error al guardar peso de actividad: " + error.message });
      } else {
        setFeedback({ type: "success", message: "Peso de actividad guardado exitosamente." });
      }
    } catch (err) {
      console.error("Error guardando peso de actividad:", err);
      setFeedback({ type: "error", message: "Error guardando peso de actividad." });
    }
  };

  const handleUpdateExamWeight = (examId: string, weight: number) => {
    setExamWeights(prev => ({ ...prev, [examId]: weight }));
  };

  // --- RESUMEN Y PRECARGA DE CALIFICACIONES POR UNIDAD ---
  const getUnitGradeSummary = async ({
    unit,
    unitActs,
    gradesMap,
    loadIndividualItems = true,
  }: {
    unit: Unit;
    unitActs: Activity[];
    gradesMap: GradesMap;
    loadIndividualItems?: boolean;
  }) => {
    const attendanceCrit = unitActs.find(a => a.name.toLowerCase().includes("asist"));
    let activitiesCrit = unitActs.find(a =>
      a.name.toLowerCase().includes("activ") ||
      a.name.toLowerCase().includes("tarea") ||
      a.name.toLowerCase().includes("práct") ||
      a.name.toLowerCase().includes("pract") ||
      a.name.toLowerCase().includes("trabaj") ||
      a.name.toLowerCase().includes("ensayo") ||
      a.name.toLowerCase().includes("rubric")
    );
    const examCrit = unitActs.find(a =>
      a.name.toLowerCase().includes("eval") ||
      a.name.toLowerCase().includes("examen") ||
      a.name.toLowerCase().includes("cuest") ||
      a.name.toLowerCase().includes("test") ||
      a.name.toLowerCase().includes("parcial")
    );

    // Fallback: si solo hay 1 criterio en la unidad y no se detectó por nombre, enlazarlo a actividades
    if (!activitiesCrit && unitActs.length === 1 && !attendanceCrit && !examCrit) {
      activitiesCrit = unitActs[0];
    }

    if (attendanceCrit) {
      const { data: att } = await supabase.from("validated_attendances").select("student_id, status").eq("course_id", courseId);
      const sums: Record<string, number> = {}, counts: Record<string, number> = {};
      ((att ?? []) as AttendanceRow[]).forEach((r) => {
        sums[r.student_id] = (sums[r.student_id] || 0) + r.status;
        counts[r.student_id] = (counts[r.student_id] || 0) + 1;
      });
      students.forEach(s => {
        const key = `${s.id}_${attendanceCrit.id}`;
        if ((gradesMap[key] === undefined || gradesMap[key] === null || gradesMap[key] === "") && counts[s.id]) {
          gradesMap[key] = ((sums[s.id] / counts[s.id]) * 100).toFixed(2);
        }
      });
    }

    // Consulta unificada de asignaciones y entregas de la unidad
    const { data: assignmentsData } = await supabase.from("assignments").select("id, title").eq("unit_id", unit.id);
    const assignmentIds = (assignmentsData ?? []).map((a: { id: string }) => a.id);
    if (assignmentIds.length > 0) {
      const { data: subs } = await supabase.from("submissions").select("student_id, assignment_id, final_score, ai_score, status").in("assignment_id", assignmentIds);
      const byStudent: Record<string, number[]> = {};
      (subs ?? []).forEach((s: { student_id: string; assignment_id: string; final_score: number | null; ai_score: number | null; status: string }) => {
        const score = s.final_score ?? (s.status === 'ai_draft' || s.status === 'draft' ? s.ai_score : null);
        if (score != null) {
          if (loadIndividualItems) {
            gradesMap[`${s.student_id}_asgn_${s.assignment_id}`] = Number(score).toFixed(2);
          }
          (byStudent[s.student_id] ??= []).push(Number(score));
        }
      });
      if (activitiesCrit) {
        Object.entries(byStudent).forEach(([studentId, scores]) => {
          const key = `${studentId}_${activitiesCrit.id}`;
          if (gradesMap[key] === undefined || gradesMap[key] === null || gradesMap[key] === "") {
            gradesMap[key] = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
          }
        });
      }
    }

    // Consulta unificada de exámenes y respuestas de la unidad
    const { data: examsData } = await supabase.from("exams").select("id, title").eq("unit_id", unit.id);
    const examIds = (examsData ?? []).map((e: { id: string }) => e.id);
    if (examIds.length > 0) {
      const { data: responses } = await supabase.from("evaluation_responses").select("student_id, exam_id, final_score, score_ia").in("exam_id", examIds);
      const byStudent: Record<string, number[]> = {};
      (responses ?? []).forEach((r: { student_id: string; exam_id: string; final_score: number | null; score_ia: number | null }) => {
        const score = r.final_score ?? r.score_ia;
        if (score != null) {
          if (loadIndividualItems) {
            gradesMap[`${r.student_id}_exam_${r.exam_id}`] = Number(score).toFixed(2);
          }
          (byStudent[r.student_id] ??= []).push(Number(score));
        }
      });
      if (examCrit) {
        Object.entries(byStudent).forEach(([studentId, scores]) => {
          const key = `${studentId}_${examCrit.id}`;
          if (gradesMap[key] === undefined || gradesMap[key] === null || gradesMap[key] === "") {
            gradesMap[key] = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
          }
        });
      }
    }

    return gradesMap;
  };

  // --- LÓGICA DE CAPTURA ---
  const handleOpenCapture = async (unit: Unit) => {
    setSelectedUnit(unit);

    const unitActs = activities.filter(a => a.unit_id === unit.id);
    const unitActIds = unitActs.map(a => a.id);
    const { data: gr } = await supabase.from("grades").select("*").in("activity_id", unitActIds);

    const gradesMap: GradesMap = {};
    (gr as GradeRow[] | null)?.forEach((g) => {
      gradesMap[`${g.student_id}_${g.activity_id}`] = typeof g.score === "number" ? g.score.toFixed(2) : String(g.score);
    });

    await getUnitGradeSummary({ unit, unitActs, gradesMap, loadIndividualItems: true });
    setGrades(gradesMap);
  };

  const handleSaveGrades = async () => {
    setIsSaving(true);
    try {
      const updatesGrades: { student_id: string; activity_id: string; score: number }[] = [];
      const updatesSubs: { student_id: string; assignment_id: string; final_score: number }[] = [];
      const updatesExams: { student_id: string; exam_id: string; final_score: number }[] = [];

      Object.entries(grades).forEach(([key, score]) => {
        if (score === "" || score === null || score === undefined) return;
        if (key.includes("_asgn_")) {
          const parts = key.split("_asgn_");
          if (parts.length === 2) updatesSubs.push({ student_id: parts[0], assignment_id: parts[1], final_score: Number(score) });
        } else if (key.includes("_exam_")) {
          const parts = key.split("_exam_");
          if (parts.length === 2) updatesExams.push({ student_id: parts[0], exam_id: parts[1], final_score: Number(score) });
        } else if (!key.includes("_rec_") && !key.includes("_final_")) {
          const [student_id, activity_id] = key.split("_");
          if (student_id && activity_id) updatesGrades.push({ student_id, activity_id, score: Number(score) });
        }
      });

      if (updatesGrades.length > 0) {
        const { error } = await supabase.from("grades").upsert(updatesGrades, { onConflict: "student_id, activity_id" });
        if (error) throw error;
      }

      if (updatesSubs.length > 0) {
        await Promise.all(
          updatesSubs.map(async (sub) => {
            const { error } = await supabase
              .from("submissions")
              .update({ final_score: sub.final_score, status: "graded" })
              .match({ student_id: sub.student_id, assignment_id: sub.assignment_id });
            if (error) throw error;
          })
        );
      }

      if (updatesExams.length > 0) {
        await Promise.all(
          updatesExams.map(async (ex) => {
            const { error } = await supabase
              .from("evaluation_responses")
              .update({ final_score: ex.final_score })
              .match({ student_id: ex.student_id, exam_id: ex.exam_id });
            if (error) throw error;
          })
        );
      }

      setFeedback({ type: "success", message: "Calificaciones guardadas exitosamente." });
    } catch (err) {
      console.error("Error al guardar calificaciones:", err);
      setFeedback({ type: "error", message: "Error al guardar las calificaciones: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMagicAttendance = async () => {
    if (selectedUnit?.is_closed) return;
    const assistCriterio = activities.find(a => a.unit_id === selectedUnit?.id && a.name.toLowerCase().includes("asist"));
    if (!assistCriterio) {
      setFeedback({ type: "error", message: "Para usar la magia, necesitas un criterio que contenga la palabra 'Asistencia'." });
      return;
    }

    const { data: att, error: attErr } = await supabase.from("validated_attendances").select("student_id, status").eq("course_id", courseId);
    if (attErr) {
      setFeedback({ type: "error", message: "Error al cargar asistencias: " + attErr.message });
      return;
    }
    if (!att || att.length === 0) {
      setFeedback({ type: "error", message: "No hay pases de lista registrados en esta materia." });
      return;
    }

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
    setFeedback({ type: "success", message: "✨ Asistencia sincronizada. Recuerda darle a 'Guardar'." });
  };

  const handleToggleCloseUnit = async (targetUnit?: Unit) => {
    const unitToToggle = targetUnit || selectedUnit;
    if (!unitToToggle) return;
    const newStatus = !unitToToggle.is_closed;

    const { error: closeErr } = await supabase.from("course_units").update({ is_closed: newStatus }).eq("id", unitToToggle.id);
    if (!closeErr) {
      if (!targetUnit) setSelectedUnit({ ...unitToToggle, is_closed: newStatus });
      setUnits(units.map(u => u.id === unitToToggle.id ? { ...u, is_closed: newStatus } : u));
      setFeedback({ type: "success", message: `Unidad ${unitToToggle.unit_number} ${newStatus ? "cerrada" : "reabierta"} correctamente.` });
    } else {
      setFeedback({ type: "error", message: "Error al actualizar estado de la unidad: " + closeErr.message });
    }
  };

  const handleOpenFinalGrades = async () => {
    setLoading(true);
    const unitIds = units.map(u => u.id);
    const actIds = activities.filter(a => unitIds.includes(a.unit_id)).map(a => a.id);
    const { data: gr } = await supabase.from("grades").select("*").in("activity_id", actIds);
    setAllGrades(gr || []);

    const gradesMap: GradesMap = {};
    (gr as GradeRow[] | null)?.forEach((g) => { gradesMap[`${g.student_id}_${g.activity_id}`] = g.score; });

    // Precarga automática en vivo por cada unidad paralelizada usando la función centralizada
    await Promise.all(
      units.map(unit => getUnitGradeSummary({ unit, unitActs: activities.filter(a => a.unit_id === unit.id), gradesMap, loadIndividualItems: false }))
    );

    setGrades(gradesMap);
    setLoading(false);
  };

  // --- LÓGICA DE EXPORTACIÓN CON EDGE FUNCTION ---
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
            nombre: formatStudentName(s),
            unidades: unidadesAlumno,
            promedioFinal: units.length > 0 ? (finalSum / units.length).toFixed(1) : "0.0"
          };
        })
      };

      // 3. Enviamos a Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('sync-grading-matrix', {
        body: { courseId, matrixData }
      });

      if (error || !data?.success) throw new Error(data?.error || "Error de sincronización con el servidor");
      setFeedback({ type: "success", message: "🚀 ¡Sábana de Calificaciones sincronizada en Google Drive!" });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Ocurrió un error al exportar" });
    } finally {
      setIsSaving(false);
    }
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
    loading, error,
    feedback, setFeedback,
    units, activities, assignments, exams, students,
    grades, setGrades,
    isSaving, allGrades,
    fetchData,
    assignmentWeights, examWeights,
    handleUpdateUnitPillars,
    handleUpdateAssignmentWeight,
    handleUpdateExamWeight,
    handleOpenCapture,
    handleSaveGrades,
    handleMagicAttendance,
    handleToggleCloseUnit,
    handleOpenFinalGrades,
    handleExportToSheets,
    inputStyle,
  };
}
