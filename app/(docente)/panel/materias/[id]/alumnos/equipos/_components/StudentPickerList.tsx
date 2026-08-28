"use client";

import { Loader2, Check } from "lucide-react";
import styles from "../../alumnos.module.css";

type Student = { id: string; matricula: string; apellido_paterno: string; apellido_materno: string | null; nombres: string; };

export default function StudentPickerList({
  loading, filteredStudents, selectedStudentIds, toggleStudentSelection,
}: {
  loading: boolean;
  filteredStudents: Student[];
  selectedStudentIds: string[];
  toggleStudentSelection: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: "32px" }}>
      <p style={{ fontSize: "0.8rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "10px" }}>
        Selecciona alumnos para formar un equipo
      </p>
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", maxHeight: "340px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}><Loader2 className="animate-spin" size={28} color="#1B396A" style={{ margin: "0 auto" }} /></div>
        ) : filteredStudents.length === 0 ? (
          <div className={styles.emptyState}>No hay alumnos que coincidan con la búsqueda.</div>
        ) : (
          filteredStudents.map(s => {
            const isSelected = selectedStudentIds.includes(s.id);
            return (
              <label key={s.id} onClick={() => toggleStudentSelection(s.id)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 20px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", backgroundColor: isSelected ? "#eff6ff" : "white" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "6px", border: `2px solid ${isSelected ? "#1B396A" : "#cbd5e1"}`, backgroundColor: isSelected ? "#1B396A" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isSelected && <Check size={13} color="white" strokeWidth={3} />}
                </div>
                <span style={{ fontWeight: "600", color: "#334155", fontSize: "0.9rem" }}>{s.apellido_paterno} {s.nombres}</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginLeft: "auto" }}>{s.matricula}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
