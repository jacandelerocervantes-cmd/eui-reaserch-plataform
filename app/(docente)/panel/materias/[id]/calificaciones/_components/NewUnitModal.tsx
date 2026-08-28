"use client";

import { X, CheckCircle2, AlertTriangle, PlusCircle, Trash2, Save } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

export default function NewUnitModal({
  newUnitName, setNewUnitName, unitCriteria, isWeightValid, totalWeight,
  handleUpdateUnitCriterion, handleRemoveUnitCriterion, handleAddUnitCriterion,
  handleAddUnit, setShowUnitModal,
}: {
  newUnitName: string;
  setNewUnitName: (v: string) => void;
  unitCriteria: { id: number; name: string; weight: number }[];
  isWeightValid: boolean;
  totalWeight: number;
  handleUpdateUnitCriterion: (id: number, field: string, value: string | number) => void;
  handleRemoveUnitCriterion: (id: number) => void;
  handleAddUnitCriterion: () => void;
  handleAddUnit: (e: React.FormEvent) => void;
  setShowUnitModal: (v: boolean) => void;
}) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(8px)" }}>
      <div style={{ backgroundColor: "white", borderRadius: "24px", width: "100%", maxWidth: "550px", padding: "32px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h2 style={{ color: "#1B396A", margin: 0, fontSize: "1.4rem", fontWeight: "800" }}>Nueva Unidad</h2>
          <button onClick={() => setShowUnitModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={24} /></button>
        </div>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>Define el nombre de la unidad y los criterios generales con los que evaluarás (ej. Proyecto 100%, o Asistencia 10% y Tareas 90%).</p>

        <form onSubmit={handleAddUnit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", color: "#64748b", fontSize: "0.85rem", fontWeight: "700", marginBottom: "8px" }}>Nombre del Tema / Unidad</label>
            <input required autoFocus type="text" placeholder="Ej. Fundamentos de Redes" value={newUnitName} onChange={e => setNewUnitName(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "1rem", backgroundColor: "#f8fafc" }} />
          </div>

          <div style={{ backgroundColor: "#f8fafc", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Criterios de Evaluación</p>
              <div style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700", backgroundColor: isWeightValid ? "#dcfce7" : "#fee2e2", color: isWeightValid ? "#166534" : "#991b1b", display: "flex", alignItems: "center", gap: "4px" }}>
                {isWeightValid ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} Total: {totalWeight}%
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {unitCriteria.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input type="text" required placeholder="Ej. Proyecto Final" value={c.name} onChange={e => handleUpdateUnitCriterion(c.id, "name", e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.9rem" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input type="number" required min="1" max="100" value={c.weight} onChange={e => handleUpdateUnitCriterion(c.id, "weight", e.target.value)} style={{ width: "70px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center", outline: "none", fontSize: "0.9rem", fontWeight: "bold", color: "#1B396A" }} />
                    <span style={{ fontWeight: "bold", color: "#64748b" }}>%</span>
                  </div>
                  <button type="button" onClick={() => handleRemoveUnitCriterion(c.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "8px", transition: "all 0.2s" }} title="Eliminar Criterio">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={handleAddUnitCriterion} style={{ marginTop: "10px", padding: "10px", backgroundColor: "white", color: "#1B396A", border: "1px dashed #cbd5e1", borderRadius: "8px", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.backgroundColor = "#f1f5f9"} onMouseOut={e => e.currentTarget.style.backgroundColor = "white"}>
              <PlusCircle size={16} /> Agregar otro criterio
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <ExpandingButton icon={X} label="Cancelar" onClick={() => setShowUnitModal(false)} variant="cancel" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} />
            <ExpandingButton icon={Save} label="Guardar Unidad" type="submit" disabled={!isWeightValid || !newUnitName.trim()} variant="primary" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
          </div>
        </form>
      </div>
    </div>
  );
}
