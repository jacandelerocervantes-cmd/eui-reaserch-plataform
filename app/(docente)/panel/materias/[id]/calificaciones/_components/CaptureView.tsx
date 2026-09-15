"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Lock, Unlock, Wand2, Save, X } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { formatStudentName } from "@/lib/formatStudentName";
import { formatUnitTitle } from "@/lib/formatUnitName";
import type { Unit, Activity, Assignment, Exam, Student, GradesMap } from "./types";

export default function CaptureView({
  selectedUnit, activities, assignments = [], exams = [],
  assignmentWeights = {},
  students, grades, setGrades, isSaving,
  handleMagicAttendance, handleSaveGrades, handleToggleCloseUnit, inputStyle,
}: {
  selectedUnit: Unit;
  activities: Activity[];
  assignments?: Assignment[];
  exams?: Exam[];
  assignmentWeights?: Record<string, number>;
  students: Student[];
  grades: GradesMap;
  setGrades: (g: GradesMap) => void;
  isSaving: boolean;
  handleMagicAttendance: () => void;
  handleSaveGrades: () => Promise<void>;
  handleToggleCloseUnit: (unit?: Unit) => void;
  inputStyle: (locked: boolean) => CSSProperties;
}) {
  const [showCloseModal, setShowCloseModal] = useState(false);
  const isGradesClosed = Boolean(selectedUnit.grades_closed_at);

  // Filtrar actividades y tareas de la unidad seleccionada
  const unitActs = activities.filter(a => a.unit_id === selectedUnit.id);
  const unitAssignments = assignments.filter(a => a.unit_id === selectedUnit.id);
  const unitExams = exams.filter(e => e.unit_id === selectedUnit.id);

  // Pilares Macro de la BD
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
  const activWeight = activAct?.weight_percentage ?? 40;
  const evalWeight = evalAct?.weight_percentage ?? 50;

  const defaultAsgnW = unitAssignments.length > 0 ? (activWeight / unitAssignments.length) : activWeight;
  const defaultExamW = unitExams.length > 0 ? (evalWeight / unitExams.length) : evalWeight;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Modal de Confirmación: Cerrar / Reabrir Calificaciones */}
      {showCloseModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 200,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "28px",
              borderRadius: "20px",
              width: "450px",
              maxWidth: "90vw",
              boxShadow: "0 25px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div
                style={{
                  backgroundColor: isGradesClosed ? "#eff6ff" : "#fffbeb",
                  color: isGradesClosed ? "#2563eb" : "#d97706",
                  padding: "8px",
                  borderRadius: "10px",
                }}
              >
                {isGradesClosed ? <Unlock size={20} /> : <Lock size={20} />}
              </div>
              <h3
                style={{
                  margin: 0,
                  color: isGradesClosed ? "#1e40af" : "#92400e",
                  fontWeight: "800",
                  fontSize: "1.1rem",
                }}
              >
                {isGradesClosed ? "Reabrir Calificaciones" : "Cerrar Calificaciones"}
              </h3>
            </div>
            <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 22px" }}>
              {isGradesClosed ? (
                <>
                  ¿Deseas reabrir la captura de calificaciones de la{" "}
                  <strong>{formatUnitTitle(selectedUnit.unit_number, selectedUnit.name)}</strong>? Las notas volverán
                  a ser editables.
                </>
              ) : (
                <>
                  ¿Deseas cerrar las calificaciones de la{" "}
                  <strong>{formatUnitTitle(selectedUnit.unit_number, selectedUnit.name)}</strong>? Las calificaciones
                  quedarán en modo de solo lectura. Esta acción es reversible en cualquier momento.
                </>
              )}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <ExpandingButton
                icon={X}
                label="Cancelar"
                onClick={() => setShowCloseModal(false)}
                variant="default"
                size={40}
                radius={10}
                gap={10}
                padding="0 12px"
                fontWeight={600}
                durationMs={300}
                colors={{ hoverText: "#64748b" }}
              />
              <ExpandingButton
                icon={isGradesClosed ? Unlock : Lock}
                label={isGradesClosed ? "Sí, Reabrir" : "Sí, Cerrar"}
                onClick={() => {
                  setShowCloseModal(false);
                  handleToggleCloseUnit(selectedUnit);
                }}
                variant={isGradesClosed ? "primary" : "warning"}
                size={40}
                radius={10}
                gap={10}
                padding="0 12px"
                fontWeight={700}
                durationMs={300}
                colors={
                  isGradesClosed
                    ? undefined
                    : { bg: "#d97706", hoverBg: "#b45309", text: "white", hoverText: "white" }
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Barra de Acciones Limpia */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: "900", color: "#1B396A", backgroundColor: "#f0f7ff", padding: "6px 12px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
            {formatUnitTitle(selectedUnit.unit_number, selectedUnit.name)}
          </span>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "700" }}>
            (100 pts)
          </span>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {!isGradesClosed && (
            <>
              <ExpandingButton icon={Wand2} label="Magia Asistencia" onClick={handleMagicAttendance} variant="magic" size={38} radius={10} gap={6} padding="0 12px" fontWeight={700} fontSize="0.85rem" durationMs={300} shadow="hover" />
              <ExpandingButton icon={Save} label={isSaving ? "Guardando..." : "Guardar Notas"} onClick={handleSaveGrades} variant="success" disabled={isSaving} size={38} radius={10} gap={6} padding="0 12px" fontWeight={700} fontSize="0.85rem" durationMs={300} shadow="hover" />
            </>
          )}
          <ExpandingButton
            icon={isGradesClosed ? Unlock : Lock}
            label={isGradesClosed ? "Reabrir Calificaciones" : "Cerrar Calificaciones"}
            onClick={() => setShowCloseModal(true)}
            variant={isGradesClosed ? "secondary" : "warning"}
            size={38} radius={10} gap={6} padding="0 12px" fontWeight={700} fontSize="0.85rem" durationMs={300} shadow="hover"
            colors={isGradesClosed ? undefined : { bg: "white", hoverBg: "#f59e0b", text: "#f59e0b", hoverText: "white", border: "#cbd5e1" }}
          />
        </div>
      </div>

      {isGradesClosed && (
        <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", color: "#b45309", padding: "10px 14px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "0.85rem" }}>
          <Lock size={16} /> Las calificaciones de esta unidad están cerradas (modo solo lectura).
        </div>
      )}

      {/* TABLA DE CAPTURA COMPACTA CON ENCABEZADOS CORTOS Y TOOLTIPS */}
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "750px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
              <th style={{ padding: "12px 16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "left", position: "sticky", left: 0, backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", zIndex: 10 }}>
                Alumno / Matrícula
              </th>

              {/* Asistencia */}
              <th style={{ padding: "10px 12px", textAlign: "center", color: "#1B396A", backgroundColor: "#f1f5f9", borderRight: "2px solid #cbd5e1", fontSize: "0.8rem", fontWeight: "700", width: "90px" }}>
                <div>Asist.</div>
                <div style={{ color: "#64748b", fontSize: "0.72rem", fontWeight: "700" }}>{assistWeight.toFixed(2)} pts</div>
              </th>

              {/* Actividades: A1, A2, A3... */}
              {unitAssignments.length > 0 ? (
                unitAssignments.map((asg, idx) => {
                  const asgW = assignmentWeights[asg.id] ?? defaultAsgnW;
                  const relP = activWeight > 0 ? ((asgW / activWeight) * 100).toFixed(0) : "0";
                  return (
                    <th
                      key={asg.id}
                      title={`Tarea ${idx + 1}: ${asg.title} (${asgW.toFixed(2)} pts / ${relP}% de actividades)`}
                      style={{ padding: "10px 8px", textAlign: "center", color: "#1e40af", backgroundColor: "#eff6ff", borderRight: "1px solid #dbeafe", fontSize: "0.8rem", width: "85px", cursor: "help" }}
                    >
                      <div style={{ fontWeight: "800" }}>A{idx + 1}</div>
                      <div style={{ color: "#3b82f6", fontSize: "0.72rem", fontWeight: "700" }}>
                        {asgW.toFixed(2)} pts
                      </div>
                    </th>
                  );
                })
              ) : (
                <th style={{ padding: "10px 12px", textAlign: "center", color: "#1e40af", backgroundColor: "#eff6ff", borderRight: "2px solid #cbd5e1", fontSize: "0.8rem", fontWeight: "700", width: "90px" }}>
                  <div>Actividades</div>
                  <div style={{ color: "#3b82f6", fontSize: "0.72rem", fontWeight: "700" }}>{activWeight.toFixed(2)} pts</div>
                </th>
              )}

              {/* Evaluaciones: E1, E2... */}
              {unitExams.length > 0 ? (
                unitExams.map((ex, idx) => {
                  const exW = ex.weight_data?.weight_percentage ?? defaultExamW;
                  const relP = evalWeight > 0 ? ((exW / evalWeight) * 100).toFixed(0) : "0";
                  return (
                    <th
                      key={ex.id}
                      title={`Examen ${idx + 1}: ${ex.title} (${exW.toFixed(2)} pts / ${relP}% de evaluaciones)`}
                      style={{ padding: "10px 8px", textAlign: "center", color: "#92400e", backgroundColor: "#fffbeb", borderRight: "1px solid #fef3c7", fontSize: "0.8rem", width: "85px", cursor: "help" }}
                    >
                      <div style={{ fontWeight: "800" }}>E{idx + 1}</div>
                      <div style={{ color: "#d97706", fontSize: "0.72rem", fontWeight: "700" }}>
                        {exW.toFixed(2)} pts
                      </div>
                    </th>
                  );
                })
              ) : (
                <th style={{ padding: "10px 12px", textAlign: "center", color: "#92400e", backgroundColor: "#fffbeb", borderRight: "2px solid #cbd5e1", fontSize: "0.8rem", fontWeight: "700", width: "90px" }}>
                  <div>Evaluaciones</div>
                  <div style={{ color: "#d97706", fontSize: "0.72rem", fontWeight: "700" }}>{evalWeight.toFixed(2)} pts</div>
                </th>
              )}

              <th style={{ padding: "12px 14px", color: "#1B396A", fontSize: "0.85rem", textAlign: "center", backgroundColor: "#f8fafc", fontWeight: "900", width: "100px" }}>
                Total U{selectedUnit.unit_number}
              </th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>No hay alumnos registrados en esta materia.</td></tr>
            ) : (
              students.map(s => {
                const nombreCompleto = formatStudentName(s);

                // 1. Cálculo Asistencia
                const assistKey = assistAct ? `${s.id}_${assistAct.id}` : `${s.id}_asist_${selectedUnit.id}`;
                const assistScore = Number(grades[assistKey] || 0);
                const assistPoints = (assistScore * (assistWeight / 100));

                // 2. Cálculo Actividades
                let activPoints = 0;
                if (unitAssignments.length > 0) {
                  unitAssignments.forEach(asg => {
                    const score = Number(grades[`${s.id}_asgn_${asg.id}`] || 0);
                    const asgW = assignmentWeights[asg.id] ?? defaultAsgnW;
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
                    const exW = ex.weight_data?.weight_percentage ?? defaultExamW;
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
                    <td style={{ padding: "8px 16px", position: "sticky", left: 0, backgroundColor: "white", borderRight: "1px solid #e2e8f0", zIndex: 5 }}>
                      <div style={{ color: "#1e293b", fontWeight: "700", fontSize: "0.85rem" }}>{nombreCompleto}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.72rem", fontFamily: "monospace" }}>{s.matricula}</div>
                    </td>

                    {/* Input Asistencia */}
                    <td style={{ padding: "6px 8px", textAlign: "center", borderRight: "2px solid #cbd5e1", backgroundColor: "#fafafa" }}>
                      <input
                        type="number" min="0" max="100" step="0.01"
                        value={grades[assistKey] !== undefined ? grades[assistKey] : ""}
                        onChange={(e) => setGrades({ ...grades, [assistKey]: e.target.value })}
                        disabled={isGradesClosed}
                        style={inputStyle(isGradesClosed)}
                      />
                      <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "2px", fontWeight: "700" }}>
                        +{assistPoints.toFixed(2)}
                      </div>
                    </td>

                    {/* Inputs Actividades */}
                    {unitAssignments.length > 0 ? (
                      unitAssignments.map(asg => {
                        const key = `${s.id}_asgn_${asg.id}`;
                        const score = Number(grades[key] || 0);
                        const asgW = assignmentWeights[asg.id] ?? defaultAsgnW;
                        const pts = (score * (asgW / 100));
                        return (
                          <td key={asg.id} style={{ padding: "6px 6px", textAlign: "center", borderRight: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                            <input
                              type="number" min="0" max="100" step="0.01" placeholder="0"
                              value={grades[key] !== undefined ? grades[key] : ""}
                              onChange={(e) => setGrades({ ...grades, [key]: e.target.value })}
                              disabled={isGradesClosed}
                              style={inputStyle(isGradesClosed)}
                            />
                            <div style={{ fontSize: "0.68rem", color: "#2563eb", marginTop: "2px", fontWeight: "700" }}>
                              +{pts.toFixed(2)}
                            </div>
                          </td>
                        );
                      })
                    ) : (
                      <td style={{ padding: "6px 8px", textAlign: "center", borderRight: "2px solid #cbd5e1", backgroundColor: "#f8fafc" }}>
                        <input
                          type="number" min="0" max="100" step="0.01"
                          value={activAct && grades[`${s.id}_${activAct.id}`] !== undefined ? grades[`${s.id}_${activAct.id}`] : ""}
                          onChange={(e) => activAct && setGrades({ ...grades, [`${s.id}_${activAct.id}`]: e.target.value })}
                          disabled={isGradesClosed}
                          style={inputStyle(isGradesClosed)}
                        />
                        <div style={{ fontSize: "0.68rem", color: "#2563eb", marginTop: "2px", fontWeight: "700" }}>
                          +{activPoints.toFixed(2)}
                        </div>
                      </td>
                    )}

                    {/* Inputs Evaluaciones */}
                    {unitExams.length > 0 ? (
                      unitExams.map(ex => {
                        const key = `${s.id}_exam_${ex.id}`;
                        const score = Number(grades[key] || 0);
                        const exW = ex.weight_data?.weight_percentage ?? defaultExamW;
                        const pts = (score * (exW / 100));
                        return (
                          <td key={ex.id} style={{ padding: "6px 6px", textAlign: "center", borderRight: "1px solid #fef3c7", backgroundColor: "#fffdfa" }}>
                            <input
                              type="number" min="0" max="100" step="0.01" placeholder="0"
                              value={grades[key] !== undefined ? grades[key] : ""}
                              onChange={(e) => setGrades({ ...grades, [key]: e.target.value })}
                              disabled={isGradesClosed}
                              style={inputStyle(isGradesClosed)}
                            />
                            <div style={{ fontSize: "0.68rem", color: "#d97706", marginTop: "2px", fontWeight: "700" }}>
                              +{pts.toFixed(2)}
                            </div>
                          </td>
                        );
                      })
                    ) : (
                      <td style={{ padding: "6px 8px", textAlign: "center", borderRight: "2px solid #cbd5e1", backgroundColor: "#fffdfa" }}>
                        <input
                          type="number" min="0" max="100" step="0.01"
                          value={evalAct && grades[`${s.id}_${evalAct.id}`] !== undefined ? grades[`${s.id}_${evalAct.id}`] : ""}
                          onChange={(e) => evalAct && setGrades({ ...grades, [`${s.id}_${evalAct.id}`]: e.target.value })}
                          disabled={isGradesClosed}
                          style={inputStyle(isGradesClosed)}
                        />
                        <div style={{ fontSize: "0.68rem", color: "#d97706", marginTop: "2px", fontWeight: "700" }}>
                          +{evalPoints.toFixed(2)}
                        </div>
                      </td>
                    )}

                    {/* Total de la Unidad */}
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: "900", fontSize: "0.95rem", color: totalUnidad >= 70 ? "#1B396A" : "#ef4444", backgroundColor: totalUnidad < 70 ? "#fef2f2" : "#f8fafc" }}>
                      {totalUnidad.toFixed(2)}
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
