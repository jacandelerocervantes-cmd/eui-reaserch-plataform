"use client";

import { Lock, ShieldCheck, AlertCircle } from "lucide-react";

type ActivityFormData = {
  title: string; description: string; unit_id: string; criteria_id: string;
  format: string; submission_type: string; soft_deadline: string; hard_deadline: string;
  late_penalty_percent: number;
};
type SessionOption = { id: string; created_at: string; session_number: number };

export default function ActivityFormRightColumn({
  formData, setFormData, requireAttendance, setRequireAttendance,
  selectedSessionId, setSelectedSessionId, pastSessions,
}: {
  formData: ActivityFormData;
  setFormData: (v: ActivityFormData) => void;
  requireAttendance: boolean;
  setRequireAttendance: (v: boolean) => void;
  selectedSessionId: string;
  setSelectedSessionId: (v: string) => void;
  pastSessions: SessionOption[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <label style={{ display: "block", fontSize: "0.9rem", color: "#1B396A", fontWeight: "800", marginBottom: "12px", textTransform: "uppercase" }}>Fecha de Entrega (Deadline)</label>
        <input required type="datetime-local" value={formData.soft_deadline} onChange={e => setFormData({...formData, soft_deadline: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1.05rem", fontWeight: "600", color: "#334155", transition: "border 0.2s" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
      </div>

      <div style={{ backgroundColor: requireAttendance ? "#f0fdf4" : "white", padding: "32px", borderRadius: "24px", border: `1px solid ${requireAttendance ? '#bbf7d0' : '#e2e8f0'}`, transition: "all 0.3s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: requireAttendance ? "20px" : "0" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", color: requireAttendance ? "#166534" : "#1B396A", fontSize: "1.2rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
              {requireAttendance ? <ShieldCheck size={24} /> : <Lock size={20} />}
              Candado de Asistencia In-Situ
            </h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: requireAttendance ? "#15803d" : "#64748b", fontWeight: "500", maxWidth: "85%" }}>
              Si se activa, solo los alumnos que validaron su ubicación presencialmente podrán entregar.
            </p>
          </div>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <div style={{ position: "relative" }}>
              <input type="checkbox" checked={requireAttendance} onChange={(e) => { setRequireAttendance(e.target.checked); if(!e.target.checked) setSelectedSessionId(""); }} style={{ opacity: 0, width: 0, height: 0 }} />
              <div style={{ width: "50px", height: "26px", backgroundColor: requireAttendance ? "#10b981" : "#cbd5e1", borderRadius: "50px", transition: "background-color 0.3s" }}></div>
              <div style={{ position: "absolute", top: "2px", left: requireAttendance ? "26px" : "2px", width: "22px", height: "22px", backgroundColor: "white", borderRadius: "50%", transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}></div>
            </div>
          </label>
        </div>

        {requireAttendance && (
          <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#15803d", fontSize: "0.85rem", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase" }}>
              <AlertCircle size={14} /> Vincular a la clase de:
            </div>
            <select required={requireAttendance} value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #bbf7d0", outline: "none", fontSize: "1rem", color: "#166534", backgroundColor: "white", cursor: "pointer", fontWeight: "600" }}>
              <option value="">Selecciona una clase anterior registrada...</option>
              {pastSessions.map(s => (
                <option key={s.id} value={s.id}>
                  Sesión {s.session_number} — {new Date(s.created_at).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </option>
              ))}
              {pastSessions.length === 0 && <option disabled>No hay sesiones In-Situ registradas aún.</option>}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
