import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Slide, TYPES } from "../_hooks/useCrearMaterial";

// Resalta el marcador [CITA] que deja la IA donde el docente debe poner la
// referencia real — así se detecta de un vistazo en la vista previa.
function withCitationHighlight(text: string) {
  const parts = (text || "").split(/(\[CITA\])/g);
  return parts.map((part, i) => part === "[CITA]"
    ? <span key={i} style={{ backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 800, fontSize: "0.78em", padding: "1px 5px", borderRadius: "4px" }}>[CITA]</span>
    : <span key={i}>{part}</span>
  );
}

// --- MODAL DE SIMULACIÓN (vista previa rápida, mismo espíritu que la de Evaluaciones) ---
export default function SimulacionModal({ tipo, titulo, contenido, slides, onClose }: { tipo: (typeof TYPES)[number]; titulo: string; contenido: string; slides: Slide[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const total = slides.length + 1;
  const isCover = idx === 0;
  const slide = !isCover ? slides[idx - 1] : null;

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "#F8FAFC", zIndex: 5000, display: "flex", flexDirection: "column" }}>
      <header style={{ backgroundColor: "white", padding: "20px 40px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ color: "#1B396A", margin: 0 }}>Vista Previa</h2>
        <button onClick={onClose} style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "10px 25px", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}>Cerrar Vista Previa</button>
      </header>
      <main style={{ flex: 1, padding: "40px", display: "flex", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ maxWidth: "700px", width: "100%" }}>
          {tipo.tool === "crear_material_boveda" && (
            <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "40px", fontFamily: "Georgia, serif" }}>
              {(contenido || "").split("\n").map((line, i) => {
                const t = line.trim();
                if (!t) return <div key={i} style={{ height: "10px" }} />;
                if (t.startsWith("## ")) return <h3 key={i} style={{ color: "#1B396A", fontSize: "1.1rem", margin: "14px 0 6px" }}>{withCitationHighlight(t.slice(3))}</h3>;
                if (t.startsWith("# ")) return <h2 key={i} style={{ color: "#1B396A", fontSize: "1.35rem", margin: "16px 0 8px" }}>{withCitationHighlight(t.slice(2))}</h2>;
                if (t.startsWith("- ") || t.startsWith("* ")) return <p key={i} style={{ margin: "4px 0 4px 18px", color: "#334155" }}>• {withCitationHighlight(t.slice(2))}</p>;
                return <p key={i} style={{ margin: "6px 0", color: "#334155", lineHeight: "1.6" }}>{withCitationHighlight(t)}</p>;
              })}
            </div>
          )}

          {tipo.tool === "crear_presentacion_slides" && (
            <>
              <div style={{
                aspectRatio: "16/9", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden",
                display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px",
                backgroundColor: isCover ? "#1B396A" : "white",
              }}>
                {isCover ? (
                  <h2 style={{ color: "white", fontWeight: 800, fontSize: "1.8rem", textAlign: "center" }}>{titulo}</h2>
                ) : (
                  <>
                    <h3 style={{ color: "#1B396A", fontWeight: 800, fontSize: "1.3rem", marginBottom: "20px" }}>{slide?.titulo}</h3>
                    <ul style={{ margin: 0, paddingLeft: "24px", color: "#334155", fontSize: "1rem", lineHeight: "1.8" }}>
                      {slide?.bullets.map((b, i) => <li key={i}>{withCitationHighlight(b)}</li>)}
                    </ul>
                  </>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
                <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "700", color: idx === 0 ? "#cbd5e1" : "#1B396A", display: "flex", alignItems: "center", gap: "4px" }}><ChevronLeft size={18} /> Anterior</button>
                <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: "0.85rem" }}>{idx + 1} / {total}</span>
                <button disabled={idx === total - 1} onClick={() => setIdx(idx + 1)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "700", color: idx === total - 1 ? "#cbd5e1" : "#1B396A", display: "flex", alignItems: "center", gap: "4px" }}>Siguiente <ChevronRight size={18} /></button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
