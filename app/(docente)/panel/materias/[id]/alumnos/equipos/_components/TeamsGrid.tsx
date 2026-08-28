"use client";

import { UsersRound, Edit2, Trash2, UserMinus } from "lucide-react";
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
  return (
    <>
      <p style={{ fontSize: "0.8rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "10px" }}>
        Equipos existentes
      </p>
      {teams.length === 0 ? (
        <div className={styles.tableContainer}>
          <div className={styles.emptyState}>No hay equipos creados todavía.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
          {teams.map(team => (
            <div key={team.id} style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "8px", borderRadius: "10px" }}>
                    <UsersRound size={18} />
                  </div>
                  <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "800", fontSize: "1.05rem" }}>{team.name}</h3>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <ExpandingButton small smallSize={36} icon={Edit2} label="Editar" variant="secondary" onClick={() => openEditModal(team)} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} expandedLabelMaxWidth="150px" />
                  <ExpandingButton small smallSize={36} icon={Trash2} label="Eliminar" variant="danger" onClick={() => handleDeleteTeam(team.id)} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} expandedLabelMaxWidth="150px" colors={{ bg: "#fee2e2", hoverBg: "#ef4444", text: "#ef4444", hoverText: "white" }} />
                </div>
              </div>

              {team.members.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>Sin integrantes.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {team.members.map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                      <span style={{ fontSize: "0.85rem", color: "#334155", fontWeight: "600" }}>{m.apellido_paterno} {m.nombres}</span>
                      <button onClick={() => handleRemoveMember(team.id, m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }} title="Quitar del equipo">
                        <UserMinus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
