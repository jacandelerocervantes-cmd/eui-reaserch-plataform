"use client";

import { Loader2, Lock, FileSpreadsheet } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { CourseUnit } from "./types";

export default function AttendanceToolbar({
  selectedUnitData, units, selectedUnitNumber, setSelectedUnitNumber,
  isSelectedUnitActive, activeUnit, isClosingUnit, isUpdating,
  cerrarUnidad, syncWithSheets, searchTerm, setSearchTerm,
}: {
  selectedUnitData: CourseUnit | null;
  units: CourseUnit[];
  selectedUnitNumber: number | null;
  setSelectedUnitNumber: (n: number) => void;
  isSelectedUnitActive: boolean;
  activeUnit: CourseUnit | null;
  isClosingUnit: boolean;
  isUpdating: boolean;
  cerrarUnidad: () => void;
  syncWithSheets: () => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "800", margin: "0" }}>Historial de Asistencia</h1>
          <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "4px 0 0" }}>
            {selectedUnitData
              ? `Unidad ${selectedUnitData.unit_number} — ${selectedUnitData.title}${selectedUnitData.is_closed ? " (cerrada)" : " · activa"}`
              : "Control detallado y justificantes"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {isSelectedUnitActive && activeUnit && (
            <ExpandingButton
              icon={isClosingUnit ? Loader2 : Lock}
              label={isClosingUnit ? "Sellando..." : `Sellar Asistencia U${activeUnit.unit_number}`}
              onClick={cerrarUnidad}
              variant="primary"
              disabled={isClosingUnit || isUpdating}
              size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300}
            />
          )}
          <ExpandingButton
            icon={isUpdating ? Loader2 : FileSpreadsheet}
            label="Sincronizar Historial"
            onClick={() => syncWithSheets()}
            variant="success"
            disabled={isUpdating || isClosingUnit}
            size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300}
            colors={{ bg: "white", hoverBg: "#10b981", text: "#10b981", hoverText: "white", border: "#cbd5e1" }}
          />
        </div>
      </div>

      {units.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <select
            value={selectedUnitNumber ?? ""}
            onChange={(e) => setSelectedUnitNumber(Number(e.target.value))}
            style={{
              padding: "9px 14px", borderRadius: "10px", border: "1px solid #cbd5e1",
              fontSize: "0.9rem", fontWeight: "600", color: "#1B396A",
              backgroundColor: "white", cursor: "pointer", minWidth: "260px",
              appearance: "auto",
            }}
          >
            {units.map(u => (
              <option key={u.id} value={u.unit_number}>
                {u.is_closed ? "🔒" : "▶"} Unidad {u.unit_number} — {u.title}{u.is_closed ? "" : " (activa)"}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Buscar alumno..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: "10px 15px", borderRadius: "10px", border: "1px solid #cbd5e1", width: "300px" }}
        />
      </div>
    </>
  );
}
