"use client";

import { ArrowLeft, Lock, Unlock, Wand2, Save } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { Unit, Activity, Student, GradesMap } from "./types";
import type { CSSProperties } from "react";

export default function CaptureView({
  selectedUnit, activities, students, grades, setGrades, isSaving,
  setCurrentView, handleMagicAttendance, handleSaveGrades, handleToggleCloseUnit, inputStyle,
}: {
  selectedUnit: Unit;
  activities: Activity[];
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
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <button onClick={() => setCurrentView('units')} style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: 0, marginBottom: "8px" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B396A"} onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}>
            <ArrowLeft size={16} /> Volver a Unidades
          </button>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "10px" }}>
            {selectedUnit.is_closed && <Lock size={24} color="#f59e0b" />} Captura: {selectedUnit.name}
          </h1>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
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

      <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
              <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "left", position: "sticky", left: 0, backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", zIndex: 10 }}>Alumno</th>
              {activities.filter(a => a.unit_id === selectedUnit.id).map(act => (
                <th key={act.id} style={{ padding: "16px 12px", textAlign: "center", color: "#64748b", fontSize: "0.85rem", borderRight: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: "700", color: "#1B396A" }}>{act.name}</div>
                  <div style={{ color: "#10b981", fontSize: "0.75rem" }}>Vale {act.weight_percentage}%</div>
                </th>
              ))}
              <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "center", backgroundColor: "#f8fafc" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => {
              let promedioUnidad = 0;
              const nombreCompleto = `${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim();

              return (
                <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", position: "sticky", left: 0, backgroundColor: "white", borderRight: "1px solid #e2e8f0", zIndex: 5 }}>
                    <div style={{ color: "#1e293b", fontWeight: "600", fontSize: "0.9rem" }}>{nombreCompleto}</div>
                    <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{s.matricula}</div>
                  </td>

                  {activities.filter(a => a.unit_id === selectedUnit.id).map(act => {
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

                  <td style={{ padding: "12px", textAlign: "center", fontWeight: "800", fontSize: "1.1rem", color: promedioUnidad >= 70 ? "#10b981" : "#ef4444", backgroundColor: "#f8fafc" }}>
                    {promedioUnidad.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
