"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

// Botón "Volver" + selector de Unidad — antes duplicado en nuevo/page.tsx y
// configuracion/page.tsx. exams solo tiene unit_id (no course_id), por eso
// el selector es obligatorio en ambos flujos.
type UnitOption = { id: string; unit_number: number; title: string };

export const ExamHeaderNav = ({ unitId, setUnitId, units }: { unitId: string; setUnitId: (v: string) => void; units: UnitOption[] }) => {
  const router = useRouter();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
      <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#64748b", fontWeight: "700", cursor: "pointer" }}>
        <ArrowLeft size={18} /> Volver a Evaluaciones
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px", backgroundColor: "#f0f7ff", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
        <span style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.75rem", textTransform: "uppercase" }}>Unidad</span>
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #bfdbfe", outline: "none", fontSize: "0.85rem", fontWeight: "700", color: "#1B396A", backgroundColor: "white", cursor: "pointer" }}>
          <option value="">Selecciona...</option>
          {units.map((u) => <option key={u.id} value={u.id}>U{u.unit_number}: {u.title}</option>)}
        </select>
      </div>
    </div>
  );
};
