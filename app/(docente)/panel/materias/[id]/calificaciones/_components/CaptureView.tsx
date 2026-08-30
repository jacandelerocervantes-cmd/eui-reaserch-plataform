"use client";

import { ArrowLeft, Lock, Unlock, Wand2, Save, FileText, Award } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { Unit, Activity, Assignment, Exam, Student, GradesMap } from "./types";
import type { CSSProperties } from "react";

export default function CaptureView({
  selectedUnit, activities, assignments = [], exams = [], students, grades, setGrades, isSaving,
  setCurrentView, handleMagicAttendance, handleSaveGrades, handleToggleCloseUnit, inputStyle,
}: {
  selectedUnit: Unit;
  activities: Activity[];
  assignments?: Assignment[];
  exams?: Exam[];
  students: Student[];
  grades: GradesMap;
  setGrades: (g: GradesMap) => void;
  isSaving: boolean;
  setCurrentView: (v: 'units' | 'capture' | 'final' | 'sabana') => void;
  handleMagicAttendance: () => void;
  handleSaveGrades: () => void;
  handleToggleCloseUnit: (unit?: Unit) => void;
  inputStyle: (locked: boolean) => CSSProperties;
}) {
  const unitActs = activities.filter(a => a.unit_id === selectedUnit.id);
  const unitAssignments = assignments.filter(a => a.unit_id === selectedUnit.id);
  const unitExams = exams.filter(e => e.unit_id === selectedUnit.id);

  // Helper para recalcular el criterio de actividades cuando se edita una tarea individual
  const handleAssignmentScoreChange = (studentId: string, asgnId: string, value: string) => {
    const newGrades = { ...grades, [`${studentId}_asgn_${asgnId}`]: value };

    // Buscar criterio de actividades
    let activitiesCrit = unitActs.find(a =>
      a.name.toLowerCase().includes("activ") ||
      a.name.toLowerCase().includes("tarea") ||
      a.name.toLowerCase().includes("práct") ||
      a.name.toLowerCase().includes("pract") ||
      a.name.toLowerCase().includes("trabaj") ||
      a.name.toLowerCase().includes("ensayo") ||
      a.name.toLowerCase().includes("rubric")
    );
    if (!activitiesCrit && unitActs.length === 1) activitiesCrit = unitActs[0];

    if (activitiesCrit && unitAssignments.length > 0) {
      const scores: number[] = [];
      unitAssignments.forEach(asg => {
        const val = asg.id === asgnId ? value : newGrades[`${studentId}_asgn_${asg.id}`];
        if (val !== "" && val !== null && val !== undefined) scores.push(Number(val));
      });
      if (scores.length > 0) {
        newGrades[`${studentId}_${activitiesCrit.id}`] = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      }
    }

    setGrades(newGrades);
  };

  // Helper para recalcular el criterio de examen cuando se edita un examen individual
  const handleExamScoreChange = (studentId: string, examId: string, value: string) => {
    const newGrades = { ...grades, [`${studentId}_exam_${examId}`]: value };

    const examCrit = unitActs.find(a =>
      a.name.toLowerCase().includes("eval") ||
      a.name.toLowerCase().includes("examen") ||
      a.name.toLowerCase().includes("cuest") ||
      a.name.toLowerCase().includes("test")
    );

    if (examCrit && unitExams.length > 0) {
      const scores: number[] = [];
      unitExams.forEach(ex => {
        const val = ex.id === examId ? value : newGrades[`${studentId}_exam_${ex.id}`];
        if (val !== "" && val !== null && val !== undefined) scores.push(Number(val));
      });
      if (scores.length > 0) {
        newGrades[`${studentId}_${examCrit.id}`] = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      }
    }

    setGrades(newGrades);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <button onClick={() => setCurrentView('units')} style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: 0, marginBottom: "8px" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B396A"} onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}>
            <ArrowLeft size={16} /> Volver a Unidades
          </button>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "10px" }}>
            {selectedUnit.is_closed && <Lock size={24} color="#f59e0b" />} Captura: {selectedUnit.name}
          </h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
              <FileText size={15} /> {unitAssignments.length} Actividades vinculadas
            </span>
            <span style={{ fontSize: "0.85rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
              <Award size={15} /> {unitExams.length} Exámenes
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {!selectedUnit.is_closed && (
            <>
              <ExpandingButton icon={Wand2} label="Magia: Asistencia" onClick={handleMagicAttendance} variant="magic" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
              <ExpandingButton icon={Save} label={isSaving ? "Guardando..." : "Guardar"} onClick={handleSaveGrades} variant="success" disabled={isSaving} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
            </>
          )}
          <ExpandingButton
            icon={selectedUnit.is_closed ? Unlock : Lock}
            label={selectedUnit.is_closed ? "Reabrir Unidad" : "Cerrar Unidad"}
            onClick={() => handleToggleCloseUnit(selectedUnit)}
            variant={selectedUnit.is_closed ? "secondary" : "warning"}
            size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover"
            colors={selectedUnit.is_closed ? undefined : { bg: "white", hoverBg: "#f59e0b", text: "#f59e0b", hoverText: "white", border: "#cbd5e1" }}
          />
        </div>
      </div>

      {selectedUnit.is_closed && (
        <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", color: "#b45309", padding: "12px 16px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px", fontWeight: "600" }}>
          <Lock size={20} /> Esta unidad está cerrada. Las calificaciones son de solo lectura.
        </div>
      )}

      {/* 1. Tabla de Criterios de la Unidad (Ponderación Global) */}
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", fontWeight: "800", color: "#1B396A", fontSize: "0.95rem" }}>
          📊 Calificación Ponderada por Criterios
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
              <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "left", position: "sticky", left: 0, backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", zIndex: 10 }}>Alumno</th>
              {unitActs.map(act => (
                <th key={act.id} style={{ padding: "16px 12px", textAlign: "center", color: "#64748b", fontSize: "0.85rem", borderRight: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: "700", color: "#1B396A" }}>{act.name}</div>
                  <div style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: "800" }}>{act.weight_percentage}%</div>
                </th>
              ))}
              <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "center", backgroundColor: "#f8fafc" }}>Total Unidad</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr><td colSpan={unitActs.length + 2} style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>No hay alumnos registrados en esta materia.</td></tr>
            ) : (
              students.map(s => {
                let promedioUnidad = 0;
                const nombreCompleto = `${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim();

                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", position: "sticky", left: 0, backgroundColor: "white", borderRight: "1px solid #e2e8f0", zIndex: 5 }}>
                      <div style={{ color: "#1e293b", fontWeight: "700", fontSize: "0.9rem" }}>{nombreCompleto}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{s.matricula}</div>
                    </td>

                    {unitActs.map(act => {
                      const score = grades[`${s.id}_${act.id}`] || 0;
                      promedioUnidad += (Number(score) * (act.weight_percentage / 100));
                      return (
                        <td key={act.id} style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #f1f5f9", backgroundColor: selectedUnit.is_closed ? "#f8fafc" : "white" }}>
                          <input
                            type="number" min="0" max="100"
                            value={grades[`${s.id}_${act.id}`] || ""}
                            onChange={(e) => setGrades({...grades, [`${s.id}_${act.id}`]: e.target.value})}
                            disabled={selectedUnit.is_closed}
                            style={inputStyle(selectedUnit.is_closed)}
                          />
                        </td>
                      );
                    })}

                    <td style={{ padding: "12px", textAlign: "center", fontWeight: "900", fontSize: "1.1rem", color: promedioUnidad >= 70 ? "#10b981" : "#ef4444", backgroundColor: "#f8fafc" }}>
                      {promedioUnidad.toFixed(1)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 2. Desglose de Actividades Individuales Creadas */}
      {unitAssignments.length > 0 && (
        <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#eff6ff", fontWeight: "800", color: "#1e40af", fontSize: "0.95rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📝 Desglose de Actividades y Tareas de la Unidad ({unitAssignments.length})</span>
            <span style={{ fontSize: "0.8rem", color: "#3b82f6", fontWeight: "600" }}>Al calificar aquí, el promedio alimenta automáticamente el criterio de Actividades</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ padding: "14px 16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "left", position: "sticky", left: 0, backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", zIndex: 10 }}>Alumno</th>
                {unitAssignments.map(asg => (
                  <th key={asg.id} style={{ padding: "14px 12px", textAlign: "center", color: "#1e40af", fontSize: "0.85rem", borderRight: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: "700" }}>{asg.title}</div>
                    <div style={{ color: "#64748b", fontSize: "0.7rem" }}>Tarea / Ensayo</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const nombreCompleto = `${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim();
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", position: "sticky", left: 0, backgroundColor: "white", borderRight: "1px solid #e2e8f0", zIndex: 5 }}>
                      <div style={{ color: "#1e293b", fontWeight: "700", fontSize: "0.9rem" }}>{nombreCompleto}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{s.matricula}</div>
                    </td>
                    {unitAssignments.map(asg => (
                      <td key={asg.id} style={{ padding: "10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                        <input
                          type="number" min="0" max="100" placeholder="-"
                          value={grades[`${s.id}_asgn_${asg.id}`] !== undefined ? grades[`${s.id}_asgn_${asg.id}`] : ""}
                          onChange={(e) => handleAssignmentScoreChange(s.id, asg.id, e.target.value)}
                          disabled={selectedUnit.is_closed}
                          style={inputStyle(selectedUnit.is_closed)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Desglose de Exámenes Individuales Creados */}
      {unitExams.length > 0 && (
        <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#fffbeb", fontWeight: "800", color: "#92400e", fontSize: "0.95rem" }}>
            📋 Desglose de Evaluaciones y Exámenes ({unitExams.length})
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ padding: "14px 16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "left", position: "sticky", left: 0, backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", zIndex: 10 }}>Alumno</th>
                {unitExams.map(ex => (
                  <th key={ex.id} style={{ padding: "14px 12px", textAlign: "center", color: "#92400e", fontSize: "0.85rem", borderRight: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: "700" }}>{ex.title}</div>
                    <div style={{ color: "#64748b", fontSize: "0.7rem" }}>Examen In-Situ</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const nombreCompleto = `${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim();
                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", position: "sticky", left: 0, backgroundColor: "white", borderRight: "1px solid #e2e8f0", zIndex: 5 }}>
                      <div style={{ color: "#1e293b", fontWeight: "700", fontSize: "0.9rem" }}>{nombreCompleto}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{s.matricula}</div>
                    </td>
                    {unitExams.map(ex => (
                      <td key={ex.id} style={{ padding: "10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>
                        <input
                          type="number" min="0" max="100" placeholder="-"
                          value={grades[`${s.id}_exam_${ex.id}`] !== undefined ? grades[`${s.id}_exam_${ex.id}`] : ""}
                          onChange={(e) => handleExamScoreChange(s.id, ex.id, e.target.value)}
                          disabled={selectedUnit.is_closed}
                          style={inputStyle(selectedUnit.is_closed)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
