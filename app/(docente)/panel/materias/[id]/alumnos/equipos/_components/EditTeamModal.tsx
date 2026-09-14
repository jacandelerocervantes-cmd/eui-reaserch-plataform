"use client";

import { X, Save, Loader2 } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import styles from "../../alumnos.module.css";

type Student = { id: string; matricula: string; apellido_paterno: string; apellido_materno: string | null; nombres: string; };

export default function EditTeamModal({
  editTeamName, setEditTeamName, students, editMemberIds, toggleEditMember,
  handleSaveEdit, isSubmitting, setShowEditModal,
}: {
  editTeamName: string;
  setEditTeamName: (v: string) => void;
  students: Student[];
  editMemberIds: string[];
  toggleEditMember: (id: string) => void;
  handleSaveEdit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  setShowEditModal: (v: boolean) => void;
}) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: "480px" }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Editar Equipo</h2>
          <button onClick={() => setShowEditModal(false)} className={styles.closeButton}><X size={24} /></button>
        </div>

        <form onSubmit={handleSaveEdit} className={styles.formGrid}>
          <input required placeholder="Nombre del equipo" className={styles.inputField} value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} />

          <div>
            <p style={{ fontSize: "0.8rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>
              Integrantes ({editMemberIds.length})
            </p>
            <div style={{ maxHeight: "260px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "8px" }}>
              {students.map(s => (
                <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", backgroundColor: editMemberIds.includes(s.id) ? "#eff6ff" : "transparent" }}>
                  <input type="checkbox" checked={editMemberIds.includes(s.id)} onChange={() => toggleEditMember(s.id)} />
                  <span style={{ fontSize: "0.88rem", color: "#334155", fontWeight: "600" }}>{s.apellido_paterno} {s.nombres}</span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginLeft: "auto" }}>{s.matricula}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formFooter}>
            <ExpandingButton icon={isSubmitting ? Loader2 : Save} label={isSubmitting ? "Guardando..." : "Guardar Cambios"} type="submit" variant="primary" disabled={isSubmitting} size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px" />
          </div>
        </form>
      </div>
    </div>
  );
}
