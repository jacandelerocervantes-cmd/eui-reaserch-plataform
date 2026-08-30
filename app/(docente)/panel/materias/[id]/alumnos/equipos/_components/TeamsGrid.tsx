"use client";

import { useState } from "react";
import { UsersRound, Edit2, Trash2, UserMinus, ChevronDown, ChevronUp } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import styles from "../../alumnos.module.css";

type Student = { id: string; matricula: string; apellido_paterno: string; apellido_materno: string | null; nombres: string; };
type Team = { id: string; name: string; members: Student[] };

export default function TeamsGrid({
  teams, openEditModal, handleDeleteTeam, handleRemoveMember,
}: {
  teams: Team[];
  openEditModal: (team: Team) => void;
  handleDeleteTeam: (teamId: string) => void;
  handleRemoveMember: (teamId: string, studentId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
      {/* Botón desplegable / Accordion Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
          backgroundColor: isOpen ? "#f8fafc" : "white", border: "none", cursor: "pointer", textAlign: "left",
          borderBottom: isOpen ? "1px solid #e2e8f0" : "none", transition: "background-color 0.2s"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "6px", borderRadius: "8px" }}>
            <UsersRound size={18} />
          </div>
          <div>
            <div style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.95rem" }}>
              Equipos de Trabajo Conformados
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              {teams.length === 0 ? "Sin equipos creados todavía" : `${teams.length} equipo(s) activo(s)`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "700", backgroundColor: "#f1f5f9", color: "#475569", padding: "3px 8px", borderRadius: "6px" }}>
            {teams.length} equipos
          </span>
          {isOpen ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
        </div>
      </button>

      {/* Contenido desplegable */}
      {isOpen && (
        <div style={{ padding: "20px" }}>
          {teams.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
              No hay equipos creados todavía. Selecciona alumnos arriba o impórtalos con IA para formar equipos.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
              {teams.map(team => (
                <div key={team.id} style={{ backgroundColor: "white", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "6px", borderRadius: "8px" }}>
                        <UsersRound size={16} />
                      </div>
                      <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "800", fontSize: "0.95rem" }}>{team.name}</h3>
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <ExpandingButton small smallSize={32} icon={Edit2} label="Editar" variant="secondary" onClick={() => openEditModal(team)} radius={8} gap={6} padding="0 10px" fontWeight={600} durationMs={300} expandedLabelMaxWidth="150px" />
                      <ExpandingButton small smallSize={32} icon={Trash2} label="Eliminar" variant="danger" onClick={() => handleDeleteTeam(team.id)} radius={8} gap={6} padding="0 10px" fontWeight={600} durationMs={300} expandedLabelMaxWidth="150px" colors={{ bg: "#fee2e2", hoverBg: "#ef4444", text: "#ef4444", hoverText: "white" }} />
                    </div>
                  </div>

                  {team.members.length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: 0 }}>Sin integrantes.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {team.members.map((m) => (
                        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                          <span style={{ fontSize: "0.82rem", color: "#334155", fontWeight: "600" }}>{m.apellido_paterno} {m.nombres}</span>
                          <button onClick={() => handleRemoveMember(team.id, m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: "2px" }} title="Quitar del equipo">
                            <UserMinus size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
