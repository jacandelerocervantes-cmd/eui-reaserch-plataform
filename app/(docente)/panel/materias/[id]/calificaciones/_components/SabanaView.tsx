"use client";

import { Fragment } from "react";
import { ArrowLeft, Lock, Unlock, Save, FileSpreadsheet } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { Unit, Activity, Student, GradesMap } from "./types";
import type { CSSProperties } from "react";

export default function SabanaView({
  loading, units, activities, students, grades, setGrades, lockedUnits, toggleLockSabana,
  isSaving, setCurrentView, handleSaveGrades, handleExportToSheets, inputStyle,
}: {
  loading: boolean;
  units: Unit[];
  activities: Activity[];
  students: Student[];
  grades: GradesMap;
  setGrades: (g: GradesMap) => void;
  lockedUnits: { [key: string]: boolean };
  toggleLockSabana: (unit: Unit) => void;
  isSaving: boolean;
  setCurrentView: (v: 'units' | 'capture' | 'final' | 'sabana') => void;
  handleSaveGrades: () => void;
  handleExportToSheets: () => void;
  inputStyle: (locked: boolean) => CSSProperties;
}) {
  return (
    <div style={{ backgroundColor: "#F8FAFC", borderRadius: "20px", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px" }}>
        <div>
          <button onClick={() => setCurrentView('units')} style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: 0, marginBottom: "8px" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B396A"} onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}>
            <ArrowLeft size={16} /> Volver a Unidades
          </button>
          <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "900", margin: 0 }}>Sábana de Calificaciones</h1>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <ExpandingButton icon={Save} label={isSaving ? "Guardando..." : "Guardar Cambios"} onClick={handleSaveGrades} variant="primary" disabled={isSaving} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
          <ExpandingButton icon={FileSpreadsheet} label="Exportar a Sheets" onClick={handleExportToSheets} variant="success" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
        </div>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
          <thead>
            <tr style={{ backgroundColor: "#1B396A", color: "white" }}>
              <th style={{ padding: "20px 25px", textAlign: "left", position: "sticky", left: 0, backgroundColor: "#1B396A", zIndex: 10, borderRight: "1px solid #2a4a7d" }} rowSpan={2}>ALUMNO / MATRÍCULA</th>

              {units.map((u) => {
                const unitActs = activities.filter(a => a.unit_id === u.id);
                return (
                  <th key={u.id} style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #2a4a7d" }} colSpan={unitActs.length + 1}>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                      UNIDAD {u.unit_number}
                      <button onClick={() => toggleLockSabana(u)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", display: "flex" }} title={lockedUnits[u.id] ? "Desbloquear Unidad" : "Cerrar Unidad"}>
                        {lockedUnits[u.id] ? <Lock size={16} color="#f87171"/> : <Unlock size={16} />}
                      </button>
                    </div>
                  </th>
                );
              })}
              <th style={{ padding: "20px 25px", textAlign: "center", borderLeft: "1px solid #2a4a7d" }} rowSpan={2}>PROMEDIO FINAL</th>
            </tr>

            <tr style={{ backgroundColor: "#F1F5F9", color: "#64748b", fontSize: "0.75rem", fontWeight: "900" }}>
              {units.map((u) => {
                const unitActs = activities.filter(a => a.unit_id === u.id);
                return (
                  <Fragment key={u.id}>
                    {unitActs.map(act => (
                      <th key={act.id} style={{ padding: "12px", textAlign: "center", borderLeft: "1px solid #e2e8f0" }}>
                        {act.name.substring(0, 5).toUpperCase()}. <span style={{ color: "#10b981", marginLeft: "4px" }}>{act.weight_percentage}%</span>
                      </th>
                    ))}
                    <th style={{ padding: "12px", textAlign: "center", backgroundColor: "#E2E8F0", color: "#1B396A" }}>SUMA</th>
                  </Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={100} style={{ textAlign: "center", padding: "40px" }}>Cargando Sábana...</td></tr> :
             students.map((s) => {
              let finalSum = 0;
              const unitsCount = units.length;

              return (
                <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "15px 25px", position: "sticky", left: 0, backgroundColor: "white", zIndex: 5, borderRight: "1px solid #e2e8f0" }}>
                    <div style={{ color: "#1B396A", fontWeight: "700", fontSize: "0.95rem" }}>{`${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim()}</div>
                    <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: "600", fontFamily: "monospace" }}>{s.matricula}</div>
                  </td>

                  {units.map((u) => {
                    const unitActs = activities.filter(a => a.unit_id === u.id);
                    let uSum = 0;

                    return (
                      <Fragment key={u.id}>
                        {unitActs.map(act => {
                          const score = grades[`${s.id}_${act.id}`] || 0;
                          uSum += (Number(score) * (act.weight_percentage / 100));
                          return (
                            <td key={act.id} style={{ padding: "10px", textAlign: "center", borderLeft: "1px solid #f1f5f9" }}>
                              <input
                                type="number" min="0" max="100"
                                disabled={lockedUnits[u.id]}
                                value={grades[`${s.id}_${act.id}`] || ""}
                                onChange={(e) => setGrades({...grades, [`${s.id}_${act.id}`]: e.target.value})}
                                style={inputStyle(lockedUnits[u.id])}
                              />
                            </td>
                          );
                        })}
                        <td style={{ padding: "10px", textAlign: "center", backgroundColor: "#F8FAFC", fontWeight: "900", color: "#1B396A", borderRight: "1px solid #e2e8f0" }}>
                          {(() => { finalSum += uSum; return uSum.toFixed(1); })()}
                        </td>
                      </Fragment>
                    );
                  })}

                  <td style={{ padding: "15px 25px", textAlign: "center", fontWeight: "900", color: "#2563eb", fontSize: "1.1rem" }}>
                    {(unitsCount > 0 ? (finalSum / unitsCount) : 0).toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
