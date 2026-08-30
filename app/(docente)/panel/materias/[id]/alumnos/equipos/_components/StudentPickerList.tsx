"use client";

import { useState } from "react";
import { Loader2, Check, ChevronDown, ChevronUp, UserCheck } from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ marginBottom: "24px", backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
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
          <div style={{ backgroundColor: selectedStudentIds.length > 0 ? "#eff6ff" : "#f1f5f9", color: selectedStudentIds.length > 0 ? "#2563eb" : "#64748b", padding: "6px", borderRadius: "8px" }}>
            <UserCheck size={18} />
          </div>
          <div>
            <div style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.95rem" }}>
              Seleccionar Alumnos para Formar Equipo
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              {selectedStudentIds.length > 0
                ? `${selectedStudentIds.length} alumno(s) seleccionado(s) de ${filteredStudents.length}`
                : `${filteredStudents.length} alumnos disponibles en la materia`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {selectedStudentIds.length > 0 && (
            <span style={{ fontSize: "0.75rem", fontWeight: "700", backgroundColor: "#2563eb", color: "white", padding: "3px 8px", borderRadius: "6px" }}>
              {selectedStudentIds.length} seleccionados
            </span>
          )}
          {isOpen ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
        </div>
      </button>

      {/* Contenido desplegable */}
      {isOpen && (
        <div style={{ maxHeight: "340px", overflowY: "auto" }}>
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
      )}
    </div>
  );
}
