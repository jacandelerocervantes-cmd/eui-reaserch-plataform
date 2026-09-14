"use client";

import { X, Search, Check } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

type TeamOption = { id: string; name: string; memberCount: number };

export default function TeamPickerModal({
  teams, selectedTeamIds, setSelectedTeamIds, teamSearchTerm, setTeamSearchTerm, setShowTeamPicker,
}: {
  teams: TeamOption[];
  selectedTeamIds: string[];
  setSelectedTeamIds: (fn: (prev: string[]) => string[]) => void;
  teamSearchTerm: string;
  setTeamSearchTerm: (v: string) => void;
  setShowTeamPicker: (v: boolean) => void;
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) setShowTeamPicker(false); }}
    >
      <div style={{ backgroundColor: "white", borderRadius: "20px", width: "100%", maxWidth: "460px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 24px 16px" }}>
          <h2 style={{ margin: 0, color: "#1B396A", fontWeight: "800", fontSize: "1.2rem" }}>Seleccionar Equipos</h2>
          <button onClick={() => setShowTeamPicker(false)} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "#94a3b8", lineHeight: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "0 24px 16px", position: "relative" }}>
          <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "36px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            autoFocus
            placeholder="Buscar equipo..."
            value={teamSearchTerm}
            onChange={(e) => setTeamSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.9rem", outline: "none" }}
          />
        </div>

        <div style={{ overflowY: "auto", padding: "0 16px 16px", flex: 1 }}>
          {teams.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", padding: "30px 10px" }}>
              No hay equipos creados en esta materia. Crea equipos primero en Alumnos &gt; Equipos.
            </p>
          ) : (
            teams
              .filter(t => t.name.toLowerCase().includes(teamSearchTerm.toLowerCase()))
              .map(t => {
                const isSelected = selectedTeamIds.includes(t.id);
                return (
                  <label key={t.id} onClick={() => setSelectedTeamIds(prev => isSelected ? prev.filter(id => id !== t.id) : [...prev, t.id])} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", cursor: "pointer", backgroundColor: isSelected ? "#eff6ff" : "transparent" }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "6px", border: `2px solid ${isSelected ? "#1B396A" : "#cbd5e1"}`, backgroundColor: isSelected ? "#1B396A" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isSelected && <Check size={13} color="white" strokeWidth={3} />}
                    </div>
                    <span style={{ fontWeight: "700", color: "#1B396A", fontSize: "0.9rem" }}>{t.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginLeft: "auto" }}>{t.memberCount} integrante(s)</span>
                  </label>
                );
              })
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
          <ExpandingButton icon={Check} label={`Confirmar (${selectedTeamIds.length})`} onClick={() => setShowTeamPicker(false)} variant="primary" size={42} radius={10} gap={10} padding="0 16px" fontWeight={600} fontSize="0.9rem" durationMs={300} shadow="hover" />
        </div>
      </div>
    </div>
  );
}
