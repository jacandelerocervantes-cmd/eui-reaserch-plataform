"use client";

import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { Unit, Activity, Student, GradeRow, GradesMap } from "./types";

export default function FinalGradesView({
  loading, units, activities, students, allGrades, grades, setCurrentView, handleExportToSheets,
}: {
  loading: boolean;
  units: Unit[];
  activities: Activity[];
  students: Student[];
  allGrades: GradeRow[];
  grades?: GradesMap;
  setCurrentView: (v: 'units' | 'capture' | 'final' | 'sabana') => void;
  handleExportToSheets: () => void;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <button onClick={() => setCurrentView('units')} style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: 0, marginBottom: "8px" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B396A"} onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}>
            <ArrowLeft size={16} /> Volver a Unidades
          </button>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0" }}>Acta Final Semestral</h1>
          <p style={{ color: "#64748b", margin: 0, fontWeight: "500", display: "flex", alignItems: "center", gap: "8px" }}>
            Resumen de promedios por unidad
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={FileSpreadsheet} label="Exportar a Sheets" onClick={handleExportToSheets} variant="success" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
        </div>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
              <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "left", borderRight: "1px solid #e2e8f0", position: "sticky", left: 0, zIndex: 10, backgroundColor: "#f8fafc" }}>Alumno</th>
              {units.map(u => (
                <th key={u.id} style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "0.85rem", borderRight: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: "700", color: "#1B396A" }}>U{u.unit_number}</div>
                  <div style={{ fontSize: "0.7rem" }}>{u.name}</div>
                </th>
              ))}
              <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "center", borderRight: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>Promedio Final</th>
              <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "center", backgroundColor: "#f8fafc" }}>Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={units.length + 3} style={{ textAlign: "center", padding: "40px" }}>Calculando acta final...</td></tr> :
              students.map(s => {
                let sumAverages = 0;
                const nombreCompleto = `${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim();

                return (
                  <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", borderRight: "1px solid #e2e8f0", position: "sticky", left: 0, backgroundColor: "white", zIndex: 5 }}>
                      <div style={{ color: "#1e293b", fontWeight: "600", fontSize: "0.9rem" }}>{nombreCompleto}</div>
                      <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{s.matricula}</div>
                    </td>

                    {units.map(u => {
                      let uAvg = 0;
                      activities.filter(a => a.unit_id === u.id).forEach(act => {
                        const gradeRec = allGrades.find(g => g.student_id === s.id && g.activity_id === act.id);
                        const score = (grades && grades[`${s.id}_${act.id}`] !== undefined)
                          ? Number(grades[`${s.id}_${act.id}`])
                          : (gradeRec?.score || 0);
                        uAvg += (score * (act.weight_percentage / 100));
                      });
                      sumAverages += uAvg;
                      return (
                        <td key={u.id} style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #f1f5f9", fontWeight: "600", color: uAvg >= 70 ? "#1e293b" : "#ef4444" }}>
                          {uAvg.toFixed(1)}
                        </td>
                      );
                    })}

                    {(() => {
                      const finalAvg = units.length > 0 ? (sumAverages / units.length) : 0;
                      const isApproved = finalAvg >= 70;
                      return (
                        <>
                          <td style={{ padding: "12px", textAlign: "center", fontWeight: "800", fontSize: "1.1rem", borderRight: "1px solid #e2e8f0", color: isApproved ? "#10b981" : "#ef4444", backgroundColor: "#f8fafc" }}>
                            {finalAvg.toFixed(1)}
                          </td>
                          <td style={{ padding: "12px", textAlign: "center", backgroundColor: "#f8fafc" }}>
                            <span style={{ padding: "4px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "700", backgroundColor: isApproved ? "#ecfdf5" : "#fef2f2", color: isApproved ? "#10b981" : "#ef4444" }}>
                              {isApproved ? "APROBADO" : "REPROBADO"}
                            </span>
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </>
  );
}
