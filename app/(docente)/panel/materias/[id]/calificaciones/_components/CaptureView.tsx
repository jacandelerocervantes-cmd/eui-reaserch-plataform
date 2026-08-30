"use client";

import { useState } from "react";
import { ArrowLeft, Lock, Unlock, Wand2, Save } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { Unit, Activity, Assignment, Exam, Student, GradesMap } from "./types";
import type { CSSProperties } from "react";

export default function CaptureView({
  selectedUnit, activities, assignments = [], exams = [], assignmentWeights = {}, examWeights = {},
  students, grades, setGrades, isSaving,
  setCurrentView, handleMagicAttendance, handleSaveGrades, handleToggleCloseUnit, inputStyle,
}: {
  selectedUnit: Unit;
  activities: Activity[];
  assignments?: Assignment[];
  exams?: Exam[];
  assignmentWeights?: Record<string, number>;
  examWeights?: Record<string, number>;
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
  const [viewMode, setViewMode] = useState<'percent' | 'points'>('percent');
  const unitActs = activities.filter(a => a.unit_id === selectedUnit.id);
  const unitAssignments = assignments.filter(a => a.unit_id === selectedUnit.id);
  const unitExams = exams.filter(e => e.unit_id === selectedUnit.id);

  // Pilares Macro
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

  const assistWeight = assistAct?.weight_percentage ?? 10;
  const activWeight = activAct?.weight_percentage ?? 50;
  const evalWeight = evalAct?.weight_percentage ?? 40;

  // Pesos micro por defecto
  const defaultAsgnWeight = unitAssignments.length > 0 ? (activWeight / unitAssignments.length) : activWeight;
  const defaultExamWeight = unitExams.length > 0 ? (evalWeight / unitExams.length) : evalWeight;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <button onClick={() => setCurrentView('units')} style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: 0, marginBottom: "8px" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B396A"} onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}>
            <ArrowLeft size={16} /> Volver a Configuración de Unidades
          </button>
          <h1 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "800", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "10px" }}>
            {selectedUnit.is_closed && <Lock size={22} color="#f59e0b" />} Captura de Calificaciones: {selectedUnit.name}
          </h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", color: "#1e40af", backgroundColor: "#eff6ff", padding: "4px 8px", borderRadius: "6px", fontWeight: "700" }}>
              Asistencia: {assistWeight}%
            </span>
            <span style={{ fontSize: "0.8rem", color: "#166534", backgroundColor: "#f0fdf4", padding: "4px 8px", borderRadius: "6px", fontWeight: "700" }}>
              Actividades: {activWeight}% ({unitAssignments.length} tareas)
            </span>
            <span style={{ fontSize: "0.8rem", color: "#92400e", backgroundColor: "#fffbeb", padding: "4px 8px", borderRadius: "6px", fontWeight: "700" }}>
              Evaluaciones: {evalWeight}% ({unitExams.length} exámenes)
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Switch de modo de vista */}
          <div style={{ display: "flex", alignItems: "center", gap: "2px", backgroundColor: "#e2e8f0", padding: "3px", borderRadius: "8px" }}>
            <button
              onClick={() => setViewMode('percent')}
              style={{
                padding: "5px 10px",
                fontSize: "0.75rem",
                fontWeight: "700",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                backgroundColor: viewMode === 'percent' ? "#ffffff" : "transparent",
                color: viewMode === 'percent' ? "#1B396A" : "#64748b",
                boxShadow: viewMode === 'percent' ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
              }}
            >
              Ver %
            </button>
            <button
              onClick={() => setViewMode('points')}
              style={{
                padding: "5px 10px",
                fontSize: "0.75rem",
                fontWeight: "700",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                backgroundColor: viewMode === 'points' ? "#ffffff" : "transparent",
                color: viewMode === 'points' ? "#1B396A" : "#64748b",
                boxShadow: viewMode === 'points' ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
              }}
            >
              Ver Puntos
            </button>
          </div>

          {!selectedUnit.is_closed && (
            <>
              <ExpandingButton icon={Wand2} label="Magia: Asistencia" onClick={handleMagicAttendance} variant="magic" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
              <ExpandingButton icon={Save} label={isSaving ? "Guardando..." : "Guardar Calificaciones"} onClick={handleSaveGrades} variant="success" disabled={isSaving} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
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
        <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", color: "#b45309", padding: "10px 14px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", fontSize: "0.85rem" }}>
          <Lock size={16} /> Esta unidad está cerrada. Las calificaciones son de solo lectura.
        </div>
      )}

      {/* Matriz Completa de Captura */}
      <div style={{ backgroundColor: "white", borderRadius: "14px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "850px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
              <th style={{ padding: "14px 16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "left", position: "sticky", left: 0, backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", zIndex: 10 }}>
                Alumno / Matrícula
              </th>
              <th style={{ padding: "12px 14px", textAlign: "center", color: "#1B396A", backgroundColor: "#f1f5f9", borderRight: "2px solid #cbd5e1", fontSize: "0.8rem", fontWeight: "700" }}>
                <div>Asistencia</div>
                <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{assistWeight} {viewMode === 'percent' ? '%' : 'pts'}</div>
              </th>

              {/* Encabezado Grupo Actividades */}
              {unitAssignments.length > 0 ? (
                unitAssignments.map(asg => {
                  const asgW = assignmentWeights[asg.id] ?? defaultAsgnWeight;
                  const percentOfPillar = activWeight > 0 ? ((asgW / activWeight) * 100).toFixed(0) : "0";
                  return (
                    <th key={asg.id} style={{ padding: "12px 12px", textAlign: "center", color: "#1e40af", backgroundColor: "#eff6ff", borderRight: "1px solid #dbeafe", fontSize: "0.8rem" }}>
                      <div style={{ fontWeight: "700" }}>{asg.title}</div>
                      <div style={{ color: "#3b82f6", fontSize: "0.75rem", fontWeight: "700" }}>
                        {asgW.toFixed(1)} {viewMode === 'percent' ? '%' : 'pts'}
                        <span style={{ fontWeight: "500", color: "#64748b", marginLeft: "4px" }}>({percentOfPillar}% de act.)</span>
                      </div>
                    </th>
                  );
                })
              ) : (
                <th style={{ padding: "12px 14px", textAlign: "center", color: "#1e40af", backgroundColor: "#eff6ff", borderRight: "2px solid #cbd5e1", fontSize: "0.8rem", fontWeight: "700" }}>
                  <div>Actividades</div>
                  <div style={{ color: "#3b82f6", fontSize: "0.75rem" }}>{activWeight} {viewMode === 'percent' ? '%' : 'pts'}</div>
                </th>
              )}

              {/* Encabezado Grupo Evaluaciones */}
              {unitExams.length > 0 ? (
                unitExams.map(ex => {
                  const exW = examWeights[ex.id] ?? defaultExamWeight;
                  return (
                    <th key={ex.id} style={{ padding: "12px 12px", textAlign: "center", color: "#92400e", backgroundColor: "#fffbeb", borderRight: "1px solid #fef3c7", fontSize: "0.8rem" }}>
                      <div style={{ fontWeight: "700" }}>{ex.title}</div>
                      <div style={{ color: "#d97706", fontSize: "0.75rem", fontWeight: "700" }}>{exW.toFixed(1)} {viewMode === 'percent' ? '%' : 'pts'}</div>
                    </th>
                  );
                })
              ) : (
                <th style={{ padding: "12px 14px", textAlign: "center", color: "#92400e", backgroundColor: "#fffbeb", borderRight: "2px solid #cbd5e1", fontSize: "0.8rem", fontWeight: "700" }}>
                  <div>Evaluaciones</div>
                  <div style={{ color: "#d97706", fontSize: "0.75rem" }}>{evalWeight} {viewMode === 'percent' ? '%' : 'pts'}</div>
                </th>
              )}

              <th style={{ padding: "14px 16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "center", backgroundColor: "#f8fafc", fontWeight: "800" }}>
                Total ({viewMode === 'percent' ? '100%' : '100 pts'})
              </th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>No hay alumnos registrados en esta materia.</td></tr>
            ) : (
              students.map(s => {
                const nombreCompleto = `${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim();

                // 1. Cálculo Asistencia
                const assistKey = assistAct ? `${s.id}_${assistAct.id}` : `${s.id}_asist_${selectedUnit.id}`;
                const assistScore = Number(grades[assistKey] || 0);
                const assistPoints = (assistScore * (assistWeight / 100));

                // 2. Cálculo Actividades
                let activPoints = 0;
                if (unitAssignments.length > 0) {
                  unitAssignments.forEach(asg => {
                    const score = Number(grades[`${s.id}_asgn_${asg.id}`] || 0);
                    const asgW = assignmentWeights[asg.id] ?? defaultAsgnWeight;
                    activPoints += (score * (asgW / 100));
                  });
                } else if (activAct) {
                  const score = Number(grades[`${s.id}_${activAct.id}`] || 0);
                  activPoints = (score * (activWeight / 100));
                }

                // 3. Cálculo Evaluaciones
                let evalPoints = 0;
                if (unitExams.length > 0) {
                  unitExams.forEach(ex => {
                    const score = Number(grades[`${s.id}_exam_${ex.id}`] || 0);
                    const exW = examWeights[ex.id] ?? defaultExamWeight;
                    evalPoints += (score * (exW / 100));
                  });
                } else if (evalAct) {
                  const score = Number(grades[`${s.id}_${evalAct.id}`] || 0);
                  evalPoints = (score * (evalWeight / 100));
                }

                const totalUnidad = assistPoints + activPoints + evalPoints;

                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {/* Alumno */}
                    <td style={{ padding: "10px 16px", position: "sticky", left: 0, backgroundColor: "white", borderRight: "1px solid #e2e8f0", zIndex: 5 }}>
                      <div style={{ color: "#1e293b", fontWeight: "700", fontSize: "0.85rem" }}>{nombreCompleto}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{s.matricula}</div>
                    </td>

                    {/* Input Asistencia */}
                    <td style={{ padding: "8px 12px", textAlign: "center", borderRight: "2px solid #cbd5e1", backgroundColor: "#fafafa" }}>
                      <input
                        type="number" min="0" max="100"
                        value={grades[assistKey] !== undefined ? grades[assistKey] : ""}
                        onChange={(e) => setGrades({ ...grades, [assistKey]: e.target.value })}
                        disabled={selectedUnit.is_closed}
                        style={inputStyle(selectedUnit.is_closed)}
                      />
                      <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "2px", fontWeight: "600" }}>
                        {assistPoints.toFixed(1)} {viewMode === 'percent' ? '%' : 'pts'}
                      </div>
                    </td>

                    {/* Inputs Actividades */}
                    {unitAssignments.length > 0 ? (
                      unitAssignments.map(asg => {
                        const key = `${s.id}_asgn_${asg.id}`;
                        const score = Number(grades[key] || 0);
                        const asgW = assignmentWeights[asg.id] ?? defaultAsgnWeight;
                        const pts = (score * (asgW / 100));
                        return (
                          <td key={asg.id} style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                            <input
                              type="number" min="0" max="100" placeholder="0"
                              value={grades[key] !== undefined ? grades[key] : ""}
                              onChange={(e) => setGrades({ ...grades, [key]: e.target.value })}
                              disabled={selectedUnit.is_closed}
                              style={inputStyle(selectedUnit.is_closed)}
                            />
                            <div style={{ fontSize: "0.7rem", color: "#2563eb", marginTop: "2px", fontWeight: "600" }}>
                              {pts.toFixed(1)} {viewMode === 'percent' ? '%' : 'pts'}
                            </div>
                          </td>
                        );
                      })
                    ) : (
                      <td style={{ padding: "8px 12px", textAlign: "center", borderRight: "2px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                        <input
                          type="number" min="0" max="100"
                          value={activAct && grades[`${s.id}_${activAct.id}`] !== undefined ? grades[`${s.id}_${activAct.id}`] : ""}
                          onChange={(e) => activAct && setGrades({ ...grades, [`${s.id}_${activAct.id}`]: e.target.value })}
                          disabled={selectedUnit.is_closed}
                          style={inputStyle(selectedUnit.is_closed)}
                        />
                      </td>
                    )}

                    {/* Inputs Evaluaciones */}
                    {unitExams.length > 0 ? (
                      unitExams.map(ex => {
                        const key = `${s.id}_exam_${ex.id}`;
                        const score = Number(grades[key] || 0);
                        const exW = examWeights[ex.id] ?? defaultExamWeight;
                        const pts = (score * (exW / 100));
                        return (
                          <td key={ex.id} style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #e2e8f0", backgroundColor: "#fffdfa" }}>
                            <input
                              type="number" min="0" max="100" placeholder="0"
                              value={grades[key] !== undefined ? grades[key] : ""}
                              onChange={(e) => setGrades({ ...grades, [key]: e.target.value })}
                              disabled={selectedUnit.is_closed}
                              style={inputStyle(selectedUnit.is_closed)}
                            />
                            <div style={{ fontSize: "0.7rem", color: "#b45309", marginTop: "2px", fontWeight: "600" }}>
                              {pts.toFixed(1)} {viewMode === 'percent' ? '%' : 'pts'}
                            </div>
                          </td>
                        );
                      })
                    ) : (
                      <td style={{ padding: "8px 12px", textAlign: "center", borderRight: "2px solid #cbd5e1", backgroundColor: "#fffdfa" }}>
                        <input
                          type="number" min="0" max="100"
                          value={evalAct && grades[`${s.id}_${evalAct.id}`] !== undefined ? grades[`${s.id}_${evalAct.id}`] : ""}
                          onChange={(e) => evalAct && setGrades({ ...grades, [`${s.id}_${evalAct.id}`]: e.target.value })}
                          disabled={selectedUnit.is_closed}
                          style={inputStyle(selectedUnit.is_closed)}
                        />
                      </td>
                    )}

                    {/* Total Unidad */}
                    <td style={{ padding: "10px 16px", textAlign: "center", backgroundColor: totalUnidad >= 70 ? "#f0fdf4" : "#fef2f2" }}>
                      <span style={{ fontWeight: "800", fontSize: "1.05rem", color: totalUnidad >= 70 ? "#166534" : "#b91c1c" }}>
                        {totalUnidad.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
