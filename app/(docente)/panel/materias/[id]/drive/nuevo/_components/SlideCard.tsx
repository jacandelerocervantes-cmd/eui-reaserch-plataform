import { Plus, Trash2 } from "lucide-react";
import type { Slide } from "../_hooks/useCrearMaterial";

// --- Tarjeta editable de una diapositiva (mismo espíritu que QuestionCard en Evaluaciones) ---
export default function SlideCard({ slide, index, onUpdate, onDelete }: { slide: Slide; index: number; onUpdate: (s: Slide) => void; onDelete: () => void }) {
  return (
    <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#94a3b8" }}>DIAPOSITIVA {index + 1}</span>
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={16} /></button>
      </div>
      <input
        value={slide.titulo}
        onChange={(e) => onUpdate({ ...slide, titulo: e.target.value })}
        placeholder="Título de la diapositiva"
        style={{ width: "100%", fontWeight: 800, fontSize: "1rem", color: "#1B396A", border: "none", borderBottom: "1px solid #f1f5f9", padding: "4px 0", marginBottom: "10px", outline: "none", boxSizing: "border-box" }}
      />
      {slide.bullets.map((b, bi) => (
        <div key={bi} style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "center" }}>
          <span style={{ color: "#cbd5e1" }}>•</span>
          <input
            value={b}
            onChange={(e) => onUpdate({ ...slide, bullets: slide.bullets.map((x, i) => i === bi ? e.target.value : x) })}
            style={{ flex: 1, border: "none", outline: "none", fontSize: "0.88rem", color: "#334155", padding: "2px 0" }}
          />
          <button onClick={() => onUpdate({ ...slide, bullets: slide.bullets.filter((_, i) => i !== bi) })} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1" }}><Trash2 size={13} /></button>
        </div>
      ))}
      <button onClick={() => onUpdate({ ...slide, bullets: [...slide.bullets, ""] })} style={{ background: "none", border: "none", cursor: "pointer", color: "#1B396A", fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px", marginTop: "6px" }}>
        <Plus size={14} /> Punto
      </button>
    </div>
  );
}
