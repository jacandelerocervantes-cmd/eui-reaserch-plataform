"use client";

// Selector de Unidad para flujos de examen (nuevo/page.tsx y configuracion/page.tsx).
// El botón canónico 'Volver' reside en el Master Sidebar para mantener consistencia.
import type { CSSProperties } from "react";

type UnitOption = { id: string; unit_number: number; title: string };

export const ExamHeaderNav = ({
  unitId, setUnitId, units, style,
}: {
  unitId: string;
  setUnitId: (v: string) => void;
  units: UnitOption[];
  style?: CSSProperties;
}) => {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "20px", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px", backgroundColor: "#1B396A10", borderRadius: "12px", border: "1px solid #1B396A25" }}>
        <span style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.75rem", textTransform: "uppercase" }}>Unidad</span>
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #1B396A25", outline: "none", fontSize: "0.85rem", fontWeight: "700", color: "#1B396A", backgroundColor: "white", cursor: "pointer" }}>
          <option value="">Selecciona una unidad...</option>
          {units.map((u) => <option key={u.id} value={u.id}>U{u.unit_number}: {u.title}</option>)}
        </select>
      </div>
    </div>
  );
};
