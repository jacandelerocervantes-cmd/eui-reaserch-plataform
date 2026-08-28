"use client";

import { X, CheckCircle2, AlertCircle, MessageSquare, Sparkles } from "lucide-react";
import type { Feedback } from "../_hooks/useTesistas";

export const FeedbackPanel = ({ fb, onClose }: { fb: Feedback; onClose: () => void }) => (
  <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
    <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "680px", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ color: "#1B396A", margin: 0, fontWeight: "900", display: "flex", alignItems: "center", gap: "8px" }}><Sparkles size={20} color="#8b5cf6" /> Retroalimentación IA</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={24} /></button>
      </div>
      {[
        { label: 'Fortalezas', items: fb.fortalezas, color: '#10b981', icon: CheckCircle2 },
        { label: 'Áreas de Mejora', items: fb.areas_mejora, color: '#f59e0b', icon: AlertCircle },
        { label: 'Preguntas de Defensa', items: fb.preguntas_defensa, color: '#8b5cf6', icon: MessageSquare },
      ].map(({ label, items, color, icon: Icon }) => (
        <div key={label} style={{ marginBottom: "24px" }}>
          <h4 style={{ color, fontSize: "0.85rem", fontWeight: "900", textTransform: "uppercase", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}><Icon size={14} /> {label}</h4>
          <ul style={{ margin: 0, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {items.map((it, i) => <li key={i} style={{ fontSize: "0.9rem", color: "#1e293b", lineHeight: 1.5 }}>{it}</li>)}
          </ul>
        </div>
      ))}
      <div style={{ backgroundColor: "#f8fafc", borderRadius: "16px", padding: "20px" }}>
        <p style={{ margin: "0 0 4px 0", fontWeight: "900", color: "#1B396A", fontSize: "0.85rem", textTransform: "uppercase" }}>Siguiente Paso</p>
        <p style={{ margin: "0 0 12px 0", color: "#1e293b", fontSize: "0.95rem", lineHeight: 1.5 }}>{fb.siguiente_paso}</p>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Tiempo estimado: <strong>{fb.tiempo_estimado_siguiente_etapa}</strong></p>
      </div>
    </div>
  </div>
);
