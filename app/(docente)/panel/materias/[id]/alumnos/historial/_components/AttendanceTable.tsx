"use client";

import { Check, X, AlertTriangle } from "lucide-react";
import type { Student, AttendanceRecord, SelectedRecord } from "./types";

export default function AttendanceTable({
  uniqueDates, filteredStudents, getRecord, setSelectedRecord, setShowEditModal,
}: {
  uniqueDates: { date: string; session: number }[];
  filteredStudents: Student[];
  getRecord: (sid: string, date: string, session: number) => AttendanceRecord | undefined;
  setSelectedRecord: (r: SelectedRecord) => void;
  setShowEditModal: (v: boolean) => void;
}) {
  if (uniqueDates.length === 0) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "#94a3b8" }}>
        <p style={{ fontSize: "1rem", fontWeight: "600", margin: "0 0 4px" }}>Sin registros para esta unidad</p>
        <p style={{ fontSize: "0.85rem", margin: 0 }}>Realiza pases de lista y quedarán reflejados aquí.</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "auto", maxHeight: "70vh" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
          <tr style={{ backgroundColor: "#f8fafc" }}>
            <th style={{ padding: "12px 20px", textAlign: "left", borderBottom: "2px solid #e2e8f0", position: "sticky", left: 0, backgroundColor: "#f8fafc" }}>Alumno</th>
            {uniqueDates.map((d, i) => (
              <th key={i} style={{ padding: "12px 10px", textAlign: "center", borderBottom: "2px solid #e2e8f0", fontSize: "0.7rem" }}>
                {d.date.split('-').reverse().slice(0,2).join('/')}<br/>S{d.session}
              </th>
            ))}
            <th style={{ padding: "12px 20px", borderBottom: "2px solid #e2e8f0" }}>%</th>
            <th style={{ padding: "12px 20px", borderBottom: "2px solid #e2e8f0" }}>Examen</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.map(al => {
            let total = 0;
            uniqueDates.forEach(d => { const r = getRecord(al.id, d.date, d.session); if (r) total += r.status; });
            const pct = uniqueDates.length > 0 ? (total / uniqueDates.length) * 100 : 0;
            return (
              <tr key={al.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 20px", fontWeight: "600", fontSize: "0.85rem", position: "sticky", left: 0, backgroundColor: "white" }}>
                  {al.apellido_paterno} {al.nombres}<br/><span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{al.matricula}</span>
                </td>
                {uniqueDates.map((d, i) => {
                  const r = getRecord(al.id, d.date, d.session);
                  const openModal = () => {
                    setSelectedRecord({
                      student_id:     al.id,
                      student_name:   `${al.apellido_paterno} ${al.nombres}`,
                      session_date:   d.date,
                      session_number: d.session,
                      new_status:     r?.status ?? 0,
                      justification:  r?.justification_text || "",
                      file_url:       r?.file_url || null,
                      exists:         !!r,
                    });
                    setShowEditModal(true);
                  };
                  return (
                    <td key={i} style={{ textAlign: "center", padding: "5px" }}>
                      <button onClick={openModal} title={r ? "Editar asistencia" : "Agregar asistencia"} style={{ background: "none", border: "none", cursor: "pointer", opacity: r ? 1 : 0.25 }}>
                        {!r
                          ? <X size={16} color="#ef4444"/>
                          : r.status === 1 ? <Check size={16} color="#10b981"/>
                          : r.status === 0.5 ? <AlertTriangle size={16} color="#f59e0b"/>
                          : <X size={16} color="#ef4444"/>
                        }
                      </button>
                    </td>
                  );
                })}
                <td style={{ textAlign: "center", fontWeight: "bold", color: pct < 80 ? "#ef4444" : "#10b981" }}>{Math.round(pct)}%</td>
                <td style={{ textAlign: "center" }}>
                  <span style={{ padding: "3px 8px", borderRadius: "10px", fontSize: "0.7rem", backgroundColor: pct >= 80 ? "#dcfce7" : "#fee2e2", color: pct >= 80 ? "#166534" : "#991b1b" }}>
                    {pct >= 80 ? "SÍ" : "NO"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
