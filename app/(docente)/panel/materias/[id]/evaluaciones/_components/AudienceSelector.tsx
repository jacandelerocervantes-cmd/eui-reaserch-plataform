"use client";

import { Check } from "lucide-react";

type StudentOption = { id: string; matricula: string; nombres: string; apellido_paterno: string };

// Selector de audiencia (restringir examen a alumnos específicos, ej.
// extraordinario) — antes duplicado en nuevo/page.tsx y configuracion/page.tsx.
export const AudienceSelector = ({ students, restrictAudience, setRestrictAudience, selectedStudentIds, toggleStudent }: {
  students: StudentOption[];
  restrictAudience: boolean;
  setRestrictAudience: (v: boolean) => void;
  selectedStudentIds: string[];
  toggleStudent: (id: string) => void;
}) => (
  <div>
    <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Audiencia</label>
    <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0", cursor: "pointer", fontSize: "0.9rem", color: "#334155", fontWeight: "600" }}>
      <input type="checkbox" checked={restrictAudience} onChange={(e) => setRestrictAudience(e.target.checked)} />
      Restringir a alumnos específicos (ej. extraordinario)
    </label>
    {restrictAudience && (
      <div style={{ marginTop: "10px", padding: "14px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
        <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600", display: "block", marginBottom: "8px" }}>{selectedStudentIds.length} de {students.length} seleccionados</span>
        <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
          {students.map((s) => {
            const isSel = selectedStudentIds.includes(s.id);
            return (
              <label key={s.id} onClick={() => toggleStudent(s.id)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", backgroundColor: isSel ? "#eff6ff" : "transparent" }}>
                <div style={{ width: "18px", height: "18px", borderRadius: "5px", border: `2px solid ${isSel ? "#1B396A" : "#cbd5e1"}`, backgroundColor: isSel ? "#1B396A" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isSel && <Check size={11} color="white" strokeWidth={3} />}
                </div>
                <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#334155" }}>{s.apellido_paterno} {s.nombres}</span>
              </label>
            );
          })}
        </div>
      </div>
    )}
  </div>
);
