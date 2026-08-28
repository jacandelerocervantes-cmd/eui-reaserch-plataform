"use client";

import { X, Save } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

export default function NewActivityModal({
  newActivity, setNewActivity, handleAddActivity, setShowActivityModal,
}: {
  newActivity: { name: string; weight: string };
  setNewActivity: (v: { name: string; weight: string }) => void;
  handleAddActivity: (e: React.FormEvent) => void;
  setShowActivityModal: (v: boolean) => void;
}) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(8px)" }}>
      <div style={{ backgroundColor: "white", borderRadius: "24px", width: "100%", maxWidth: "400px", padding: "32px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
        <h2 style={{ color: "#1B396A", margin: "0 0 24px 0", fontSize: "1.4rem", fontWeight: "800" }}>Añadir Criterio Adicional</h2>
        <form onSubmit={handleAddActivity} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", color: "#64748b", fontSize: "0.85rem", fontWeight: "700", marginBottom: "8px" }}>Nombre del Criterio</label>
            <input required autoFocus type="text" placeholder="Ej. Puntos Extra" value={newActivity.name} onChange={(e) => setNewActivity({...newActivity, name: e.target.value})} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "1rem", backgroundColor: "#f8fafc" }} />
          </div>
          <div>
            <label style={{ display: "block", color: "#64748b", fontSize: "0.85rem", fontWeight: "700", marginBottom: "8px" }}>Peso en la Unidad (%)</label>
            <input required type="number" min="1" max="100" placeholder="Ej. 10" value={newActivity.weight} onChange={(e) => setNewActivity({...newActivity, weight: e.target.value})} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "1rem", backgroundColor: "#f8fafc" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "10px" }}>
            <ExpandingButton icon={X} label="Cancelar" onClick={() => setShowActivityModal(false)} variant="cancel" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} />
            <ExpandingButton icon={Save} label="Confirmar" type="submit" variant="primary" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
          </div>
        </form>
      </div>
    </div>
  );
}
