"use client";

import { X, Save, Loader2, UsersRound } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import styles from "../../alumnos.module.css";

export function FloatingCreatePill({
  selectedStudentIds, setSelectedStudentIds, setShowNameModal,
}: {
  selectedStudentIds: string[];
  setSelectedStudentIds: (ids: string[]) => void;
  setShowNameModal: (v: boolean) => void;
}) {
  return (
    <div style={{ position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B396A", padding: "10px 10px 10px 22px", borderRadius: "100px", display: "flex", alignItems: "center", gap: "20px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)", zIndex: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ backgroundColor: "#D4AF37", color: "#1B396A", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "0.85rem" }}>{selectedStudentIds.length}</div>
        <span style={{ color: "white", fontWeight: "700", fontSize: "0.9rem" }}>seleccionados</span>
      </div>
      <ExpandingButton icon={UsersRound} label="Crear Equipo" onClick={() => setShowNameModal(true)} variant="ai" size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px" />
      <button onClick={() => setSelectedStudentIds([])} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={16} />
      </button>
    </div>
  );
}

export default function NameTeamModal({
  selectedStudentIds, newTeamName, setNewTeamName, handleCreateTeamFromSelection, isSubmitting, setShowNameModal,
}: {
  selectedStudentIds: string[];
  newTeamName: string;
  setNewTeamName: (v: string) => void;
  handleCreateTeamFromSelection: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  setShowNameModal: (v: boolean) => void;
}) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: "420px" }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Nombrar Equipo</h2>
          <button onClick={() => setShowNameModal(false)} className={styles.closeButton}><X size={24} /></button>
        </div>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "-12px", marginBottom: "16px" }}>
          {selectedStudentIds.length} alumno(s) seleccionados.
        </p>
        <form onSubmit={handleCreateTeamFromSelection} className={styles.formGrid}>
          <input required autoFocus placeholder="Nombre del equipo" className={styles.inputField} value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
          <div className={styles.formFooter}>
            <ExpandingButton icon={isSubmitting ? Loader2 : Save} label={isSubmitting ? "Guardando..." : "Guardar Equipo"} type="submit" variant="primary" disabled={isSubmitting} size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px" />
          </div>
        </form>
      </div>
    </div>
  );
}
