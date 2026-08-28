"use client";

import { CheckCircle2, Loader2, Wand2, X } from "lucide-react";

export default function FloatingActionPill({
  selectedIds, setSelectedIds, isProcessingAI, aiProgress,
  allSelectedAreAIDraft, handlePublishSelected, handleProcessAI,
}: {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  isProcessingAI: boolean;
  aiProgress: { done: number; total: number };
  allSelectedAreAIDraft: boolean;
  handlePublishSelected: () => void;
  handleProcessAI: () => void;
}) {
  return (
    <div style={{ position: "fixed", bottom: "40px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B396A", padding: "12px 12px 12px 24px", borderRadius: "100px", display: "flex", alignItems: "center", gap: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)", zIndex: 1000, border: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ backgroundColor: "#D4AF37", color: "#1B396A", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "950" }}>{selectedIds.length}</div>
        <span style={{ color: "white", fontWeight: "700", fontSize: "0.95rem" }}>
          {isProcessingAI ? `Procesando ${aiProgress.done}/${aiProgress.total}...` : "Seleccionados"}
        </span>
      </div>
      {allSelectedAreAIDraft ? (
        <button
          onClick={handlePublishSelected}
          disabled={isProcessingAI}
          style={{ backgroundColor: "#10b981", color: "white", border: "none", padding: "12px 28px", borderRadius: "100px", fontWeight: "900", cursor: isProcessingAI ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "10px", transition: "transform 0.2s", opacity: isProcessingAI ? 0.8 : 1 }}
          onMouseEnter={(e) => { if (!isProcessingAI) e.currentTarget.style.transform = "scale(1.05)" }}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          {isProcessingAI ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {isProcessingAI ? "Publicando..." : "Enviar Calificación Final"}
        </button>
      ) : (
        <button
          onClick={handleProcessAI}
          disabled={isProcessingAI}
          style={{ backgroundColor: "#8b5cf6", color: "white", border: "none", padding: "12px 28px", borderRadius: "100px", fontWeight: "900", cursor: isProcessingAI ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "10px", transition: "transform 0.2s", opacity: isProcessingAI ? 0.8 : 1 }}
          onMouseEnter={(e) => { if (!isProcessingAI) e.currentTarget.style.transform = "scale(1.05)" }}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          {isProcessingAI ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
          {isProcessingAI ? "Procesando..." : "Procesar con IA"}
        </button>
      )}
      <button onClick={() => setSelectedIds([])} disabled={isProcessingAI} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "white", padding: "10px", borderRadius: "50%", cursor: isProcessingAI ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: isProcessingAI ? 0.5 : 1 }}><X size={20} /></button>
    </div>
  );
}
