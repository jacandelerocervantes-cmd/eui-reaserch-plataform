import { Trash2 } from "lucide-react";
import type { Criterio } from "../_hooks/useCrearMaterial";

// --- Tarjeta editable de un criterio de rúbrica ---
export default function CriterioCard({ criterio, index, onUpdate, onDelete }: { criterio: Criterio; index: number; onUpdate: (c: Criterio) => void; onDelete: () => void }) {
  return (
    <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8" }}>CRITERIO {index + 1}</span>
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={16} /></button>
      </div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "baseline" }}>
        <input value={criterio.name} onChange={(e) => onUpdate({ ...criterio, name: e.target.value })} placeholder="Nombre del criterio" style={{ flex: 1, fontWeight: 800, fontSize: "0.95rem", color: "#1B396A", border: "none", borderBottom: "1px solid #f1f5f9", padding: "4px 0", outline: "none" }} />
        <input type="number" value={criterio.weight} onChange={(e) => onUpdate({ ...criterio, weight: parseFloat(e.target.value) || 0 })} style={{ width: "60px", fontWeight: 800, fontSize: "0.95rem", color: "#1B396A", border: "none", borderBottom: "1px solid #f1f5f9", padding: "4px 0", outline: "none", textAlign: "right" }} />
        <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: "0.85rem" }}>%</span>
      </div>
      <textarea value={criterio.description} onChange={(e) => onUpdate({ ...criterio, description: e.target.value })} rows={2} placeholder="Indicadores de desempeño..." style={{ width: "100%", border: "none", outline: "none", fontSize: "0.85rem", color: "#475569", resize: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
    </div>
  );
}
