"use client";

import { Fragment } from "react";
import { ArrowLeft, FileSpreadsheet, Save, GraduationCap } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { Unit, Activity, Student, GradeRow, GradesMap } from "./types";

export default function FinalGradesView({
  loading, units, activities, students, allGrades, grades, setGrades, isSaving, handleSaveGrades, setCurrentView, handleExportToSheets,
}: {
  loading: boolean;
  units: Unit[];
  activities: Activity[];
  students: Student[];
  allGrades: GradeRow[];
  grades?: GradesMap;
  setGrades?: (g: GradesMap) => void;
  isSaving?: boolean;
  handleSaveGrades?: () => void;
  setCurrentView: (v: 'units' | 'capture' | 'final' | 'sabana') => void;
  handleExportToSheets: () => void;
}) {
  const localGrades = grades || {};

  const inputStyle = {
    width: "55px",
    padding: "6px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    backgroundColor: "white",
    textAlign: "center" as const,
    fontWeight: "700",
    color: "#1B396A",
    outline: "none",
    fontSize: "0.85rem",
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <button onClick={() => setCurrentView('units')} style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: 0, marginBottom: "8px" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B396A"} onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}>
            <ArrowLeft size={16} /> Volver a Unidades
          </button>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "10px" }}>
            <GraduationCap size={28} /> Acta Final y Recuperaciones
          </h1>
          <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>
            Ponderación dinámica de unidades (U1 + U2 + ... + UX), Examen Ordinario Único y Recuperación de Segunda Oportunidad.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {handleSaveGrades && (
            <ExpandingButton icon={Save} label={isSaving ? "Guardando..." : "Guardar Cambios"} onClick={handleSaveGrades} variant="primary" disabled={isSaving} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
          )}
          <ExpandingButton icon={FileSpreadsheet} label="Exportar a Sheets" onClick={handleExportToSheets} variant="success" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
        </div>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
          <thead>
            <tr style={{ backgroundColor: "#1B396A", color: "white" }}>
              <th style={{ padding: "16px 20px", textAlign: "left", position: "sticky", left: 0, zIndex: 10, backgroundColor: "#1B396A", borderRight: "1px solid #2a4a7d" }} rowSpan={2}>
                ALUMNO / MATRÍCULA
              </th>
              {units.map(u => (
                <th key={u.id} style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #2a4a7d" }} colSpan={2}>
                  U{u.unit_number}: {u.name}
                </th>
              ))}
              <th style={{ padding: "12px 16px", textAlign: "center", borderRight: "1px solid #2a4a7d", backgroundColor: "#1e3a5f" }} rowSpan={2}>
                PROM. ORDINARIO
              </th>
              <th style={{ padding: "12px 16px", textAlign: "center", borderRight: "1px solid #2a4a7d", backgroundColor: "#1e3a5f" }} rowSpan={2} title="Examen global final opcional">
                EXAMEN GLOBAL
              </th>
              <th style={{ padding: "12px 16px", textAlign: "center", borderRight: "1px solid #2a4a7d", backgroundColor: "#1e3a5f" }} rowSpan={2} title="Recuperación semestral si reprobó ordinario">
                RECUPERACIÓN
              </th>
              <th style={{ padding: "16px 20px", textAlign: "center", borderRight: "1px solid #2a4a7d", backgroundColor: "#0f172a" }} rowSpan={2}>
                CALIF. FINAL
              </th>
              <th style={{ padding: "16px 20px", textAlign: "center", backgroundColor: "#0f172a" }} rowSpan={2}>
                ESTATUS
              </th>
            </tr>

            <tr style={{ backgroundColor: "#f1f5f9", color: "#475569", fontSize: "0.75rem", fontWeight: "800" }}>
              {units.map(u => (
                <Fragment key={u.id}>
                  <th style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>Ord.</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #e2e8f0", color: "#b45309" }}>Rec.</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={units.length * 2 + 6} style={{ textAlign: "center", padding: "40px" }}>Calculando acta final y recuperaciones...</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={units.length * 2 + 6} style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>No hay alumnos inscritos en este curso.</td></tr>
            ) : (
              students.map(s => {
                let sumEffectiveUnits = 0;
                let usedUnitRecovery = false;
                const nombreCompleto = `${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim();

                const unitGradesData = units.map(u => {
                  let uOrd = 0;
                  activities.filter(a => a.unit_id === u.id).forEach(act => {
                    const gradeRec = allGrades.find(g => g.student_id === s.id && g.activity_id === act.id);
                    const score = localGrades[`${s.id}_${act.id}`] !== undefined
                      ? Number(localGrades[`${s.id}_${act.id}`])
                      : (gradeRec?.score || 0);
                    uOrd += (score * (act.weight_percentage / 100));
                  });

                  const recKey = `${s.id}_rec_u_${u.id}`;
                  const recVal = localGrades[recKey] !== undefined ? String(localGrades[recKey]) : "";
                  const recScore = recVal !== "" ? Number(recVal) : null;

                  // Si el alumno tiene nota de recuperación aprobatoria en la unidad
                  let uEffective = uOrd;
                  if (recScore !== null && recScore >= 70 && uOrd < 70) {
                    uEffective = recScore;
                    usedUnitRecovery = true;
                  } else if (recScore !== null && recScore > uOrd) {
                    uEffective = recScore;
                  }

                  sumEffectiveUnits += uEffective;
                  return { uOrd, recKey, recVal, uEffective };
                });

                const promOrdinario = units.length > 0 ? (sumEffectiveUnits / units.length) : 0;

                // Examen Global / Único
                const globalExamKey = `${s.id}_final_exam`;
                const globalExamVal = localGrades[globalExamKey] !== undefined ? String(localGrades[globalExamKey]) : "";
                const globalExamScore = globalExamVal !== "" ? Number(globalExamVal) : null;

                // Recuperación Global / Final
                const finalRecKey = `${s.id}_final_rec`;
                const finalRecVal = localGrades[finalRecKey] !== undefined ? String(localGrades[finalRecKey]) : "";
                const finalRecScore = finalRecVal !== "" ? Number(finalRecVal) : null;

                // Cálculo de Calificación Final Definitiva
                let finalScore = globalExamScore !== null ? globalExamScore : promOrdinario;
                let isRecoveryPass = usedUnitRecovery;

                if (finalScore < 70 && finalRecScore !== null) {
                  if (finalRecScore >= 70) {
                    finalScore = finalRecScore;
                    isRecoveryPass = true;
                  } else {
                    finalScore = Math.max(finalScore, finalRecScore);
                  }
                }

                const isApproved = finalScore >= 70;

                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", borderRight: "1px solid #e2e8f0", position: "sticky", left: 0, backgroundColor: "white", zIndex: 5 }}>
                      <div style={{ color: "#1e293b", fontWeight: "700", fontSize: "0.9rem" }}>{nombreCompleto}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{s.matricula}</div>
                    </td>

                    {unitGradesData.map((ug, idx) => (
                      <Fragment key={units[idx].id}>
                        <td style={{ padding: "10px", textAlign: "center", borderRight: "1px solid #f1f5f9", fontWeight: "600", color: ug.uOrd >= 70 ? "#1e293b" : "#ef4444", backgroundColor: ug.uOrd < 70 ? "#fef2f2" : "transparent" }}>
                          {ug.uOrd.toFixed(1)}
                        </td>
                        <td style={{ padding: "6px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number" min="0" max="100" placeholder="-"
                            value={ug.recVal}
                            onChange={(e) => setGrades && setGrades({ ...localGrades, [ug.recKey]: e.target.value })}
                            style={{ ...inputStyle, borderColor: ug.recVal ? "#f59e0b" : "#cbd5e1", backgroundColor: ug.recVal ? "#fffbeb" : "white" }}
                          />
                        </td>
                      </Fragment>
                    ))}

                    <td style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #e2e8f0", fontWeight: "700", color: promOrdinario >= 70 ? "#1e293b" : "#ef4444", backgroundColor: "#f8fafc" }}>
                      {promOrdinario.toFixed(1)}
                    </td>

                    <td style={{ padding: "6px", textAlign: "center", borderRight: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                      <input
                        type="number" min="0" max="100" placeholder="-"
                        value={globalExamVal}
                        onChange={(e) => setGrades && setGrades({ ...localGrades, [globalExamKey]: e.target.value })}
                        style={{ ...inputStyle, borderColor: globalExamVal ? "#3b82f6" : "#cbd5e1", backgroundColor: globalExamVal ? "#eff6ff" : "white" }}
                      />
                    </td>

                    <td style={{ padding: "6px", textAlign: "center", borderRight: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                      <input
                        type="number" min="0" max="100" placeholder="-"
                        value={finalRecVal}
                        onChange={(e) => setGrades && setGrades({ ...localGrades, [finalRecKey]: e.target.value })}
                        style={{ ...inputStyle, borderColor: finalRecVal ? "#b45309" : "#cbd5e1", backgroundColor: finalRecVal ? "#fffbeb" : "white" }}
                      />
                    </td>

                    <td style={{ padding: "12px", textAlign: "center", fontWeight: "900", fontSize: "1.15rem", borderRight: "1px solid #e2e8f0", color: isApproved ? "#10b981" : "#ef4444", backgroundColor: "#f8fafc" }}>
                      {finalScore.toFixed(1)}
                    </td>

                    <td style={{ padding: "12px", textAlign: "center", backgroundColor: "#f8fafc" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "800",
                        backgroundColor: isApproved ? (isRecoveryPass ? "#eff6ff" : "#ecfdf5") : "#fef2f2",
                        color: isApproved ? (isRecoveryPass ? "#2563eb" : "#10b981") : "#ef4444",
                        border: `1px solid ${isApproved ? (isRecoveryPass ? "#bfdbfe" : "#a7f3d0") : "#fecaca"}`,
                      }}>
                        {isApproved ? (isRecoveryPass ? "APROBADO (REC)" : "APROBADO") : "REPROBADO"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
