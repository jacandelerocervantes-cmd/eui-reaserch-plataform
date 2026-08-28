"use client";

import { User, Users, UsersRound, FileUp, Cloud, FileText, Table, Presentation } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import OptionCard from "./OptionCard";

type ActivityFormData = {
  title: string; description: string; unit_id: string; criteria_id: string;
  format: string; submission_type: string; soft_deadline: string; hard_deadline: string;
  late_penalty_percent: number;
};
type TeamOption = { id: string; name: string; memberCount: number };

export default function ActivityFormLeftColumn({
  formData, setFormData, selectedTeamIds, teams, setShowTeamPicker,
}: {
  formData: ActivityFormData;
  setFormData: (v: ActivityFormData) => void;
  selectedTeamIds: string[];
  teams: TeamOption[];
  setShowTeamPicker: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Información General</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input required type="text" placeholder="Título de la actividad" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "1.05rem", fontWeight: "600", color: "#334155", outline: "none", transition: "border 0.2s" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
          <textarea rows={5} placeholder="Instrucciones detalladas" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "1rem", color: "#334155", outline: "none", resize: "none", transition: "border 0.2s" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
        </div>
      </div>

      <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Modalidad y Entorno de Entrega</h3>

        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "0.85rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "10px" }}>Modalidad de Trabajo</p>
          <div style={{ display: "flex", gap: "12px" }}>
            <OptionCard icon={User} label="Individual" selected={formData.format === 'individual'} onClick={() => setFormData({...formData, format: 'individual'})} />
            <OptionCard icon={Users} label="Por Equipos" selected={formData.format === 'equipo'} onClick={() => setFormData({...formData, format: 'equipo'})} />
          </div>

          {formData.format === 'equipo' && (
            <div style={{ marginTop: "14px", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "0.85rem", color: "#334155", fontWeight: "600" }}>
                  {selectedTeamIds.length === 0
                    ? "Ningún equipo seleccionado"
                    : `${selectedTeamIds.length} equipo(s) seleccionado(s)`}
                </span>
                <ExpandingButton icon={UsersRound} label="Seleccionar Equipos" onClick={() => setShowTeamPicker(true)} variant="default" size={42} radius={10} gap={10} padding="0 16px" fontWeight={600} fontSize="0.9rem" durationMs={300} />
              </div>
              {selectedTeamIds.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                  {teams.filter(t => selectedTeamIds.includes(t.id)).map(t => (
                    <span key={t.id} style={{ fontSize: "0.75rem", fontWeight: "700", color: "#1B396A", backgroundColor: "#eff6ff", padding: "4px 10px", borderRadius: "20px" }}>
                      {t.name} ({t.memberCount})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <p style={{ fontSize: "0.85rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "10px" }}>Tipo de Entrega</p>
          <div style={{ display: "flex", gap: "12px", marginBottom: formData.submission_type !== 'file' ? "12px" : "0" }}>
            <OptionCard icon={FileUp} label="Subida de Archivo" selected={formData.submission_type === 'file'} onClick={() => setFormData({...formData, submission_type: 'file'})} />
            <OptionCard icon={Cloud} label="Google Workspace" selected={formData.submission_type !== 'file'} onClick={() => setFormData({...formData, submission_type: 'doc'})} />
          </div>

          {formData.submission_type !== 'file' && (
            <div style={{ display: "flex", gap: "12px", animation: "fadeIn 0.3s ease-out", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
              <OptionCard icon={FileText} label="Doc" selected={formData.submission_type === 'doc'} onClick={() => setFormData({...formData, submission_type: 'doc'})} />
              <OptionCard icon={Table} label="Sheet" selected={formData.submission_type === 'sheet'} onClick={() => setFormData({...formData, submission_type: 'sheet'})} />
              <OptionCard icon={Presentation} label="Slide" selected={formData.submission_type === 'slide'} onClick={() => setFormData({...formData, submission_type: 'slide'})} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
