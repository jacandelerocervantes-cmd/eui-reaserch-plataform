"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, Library, Share2, Sparkles, 
  FileText, Network, Lightbulb, Filter,
  Download, ExternalLink, ChevronRight, Info
} from "lucide-react";

// --- SUB-COMPONENTE: NODO DEL GRAFO (SIMULADO) ---
const KnowledgeNode = ({ title, type, x, y, size }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "absolute", left: x, top: y,
        width: size, height: size, borderRadius: "50%",
        backgroundColor: type === 'main' ? "#1B396A" : "white",
        border: `3px solid ${type === 'main' ? "#f59e0b" : "#e2e8f0"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 0.3s ease",
        boxShadow: isHovered ? "0 0 20px rgba(245, 158, 11, 0.4)" : "none",
        zIndex: isHovered ? 10 : 1
      }}
    >
      {isHovered && (
        <div style={{
          position: "absolute", bottom: "120%", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#1B396A", color: "white", padding: "8px 12px", borderRadius: "8px",
          fontSize: "0.75rem", whiteSpace: "nowrap", fontWeight: "700", pointerEvents: "none"
        }}>
          {title}
        </div>
      )}
      <FileText size={size * 0.4} color={type === 'main' ? "white" : "#1B396A"} />
    </div>
  );
};

export default function ExploradorLiterario() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px", height: "calc(100vh - 100px)" }}>
      
      {/* HEADER Y BÚSQUEDA */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.5rem", fontWeight: "950", margin: 0 }}>Explorador Literario</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Descubre conexiones y huecos en la literatura científica.</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
           <div style={{ position: "relative", width: "400px" }}>
              <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
              <input type="text" placeholder="Buscar concepto o paper..." style={{ width: "100%", padding: "14px 16px 14px 48px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none" }} />
           </div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "24px", flex: 1, minHeight: 0 }}>
        
        {/* PANEL CENTRAL: EL MAPA DE CONOCIMIENTO (Visualización) */}
        <section style={{ 
          backgroundColor: "#f8fafc", borderRadius: "32px", border: "1px solid #e2e8f0", 
          position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" 
        }}>
          <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", zIndex: 5 }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <span style={{ backgroundColor: "white", padding: "8px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                <Network size={16} color="#f59e0b" /> Vista de Grafo
              </span>
            </div>
            <div style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: "600" }}>34 Artículos Relacionados</div>
          </div>

          {/* SIMULACIÓN DEL GRAFO (Aquí iría una librería como React Flow o D3.js) */}
          <div style={{ flex: 1, position: "relative" }}>
             <KnowledgeNode title="Impacto de IA en Yucatán" type="main" x="45%" y="40%" size={80} />
             <KnowledgeNode title="Paper: Redes Neuronales 2024" type="sub" x="30%" y="20%" size={50} />
             <KnowledgeNode title="Dataset: Clima Regional" type="sub" x="60%" y="25%" size={50} />
             <KnowledgeNode title="Teoría de Grafos Aplicada" type="sub" x="35%" y="65%" size={50} />
             <KnowledgeNode title="Estudio: Ética Algorítmica" type="sub" x="65%" y="60%" size={50} />
             
             {/* Líneas de conexión decorativas */}
             <svg style={{ position: "absolute", width: "100%", height: "100%", top: 0, left: 0, pointerEvents: "none" }}>
                <line x1="49%" y1="45%" x2="35%" y2="25%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                <line x1="49%" y1="45%" x2="62%" y2="30%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                <line x1="49%" y1="45%" x2="38%" y2="68%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
             </svg>
          </div>

          <div style={{ padding: "24px", background: "linear-gradient(to top, white, transparent)", zIndex: 5 }}>
             <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "20px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                   <div style={{ backgroundColor: "#fffbeb", color: "#f59e0b", padding: "10px", borderRadius: "12px" }}><Lightbulb size={20} /></div>
                   <div>
                      <div style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.9rem" }}>Insight de IA: Posible Gap Detectado</div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Nadie ha relacionado el Dataset A con la Teoría C en contextos tropicales.</div>
                   </div>
                </div>
                <button style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "8px 16px", borderRadius: "10px", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer" }}>Explorar Gap</button>
             </div>
          </div>
        </section>

        {/* PANEL DERECHO: DETALLES Y AI SUMMARY */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "24px", overflowY: "auto" }} className="custom-scrollbar">
          
          {/* Tarjeta de Resumen IA */}
          <div style={{ backgroundColor: "#1B396A", borderRadius: "24px", padding: "24px", color: "white", position: "relative", overflow: "hidden" }}>
            <Sparkles size={40} style={{ position: "absolute", right: "-10px", top: "-10px", opacity: 0.1 }} />
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
               Resumen del Paper
            </h3>
            <p style={{ fontSize: "0.9rem", opacity: 0.9, lineHeight: "1.6", margin: "0 0 20px 0" }}>
              Este artículo propone un nuevo método de optimización para redes en climas extremos. Sus conclusiones principales desafían el modelo de Smith (2022).
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.15)", border: "none", color: "white", padding: "10px", borderRadius: "10px", fontWeight: "700", fontSize: "0.8rem" }}>Leer PDF</button>
              <button style={{ flex: 1, backgroundColor: "#f59e0b", border: "none", color: "#1B396A", padding: "10px", borderRadius: "10px", fontWeight: "800", fontSize: "0.8rem" }}>Citar (APA)</button>
            </div>
          </div>

          {/* Lista de Referencias Relacionadas */}
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
            <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1rem", fontWeight: "800" }}>Referencias Clave</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                { title: "Network Resilience in LATAM", year: "2023", citations: 142 },
                { title: "Neural Topologies for IoT", year: "2024", citations: 28 },
                { title: "Climate Data Mining", year: "2022", citations: 89 }
              ].map((ref, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "start", borderBottom: i < 2 ? "1px solid #f1f5f9" : "none", paddingBottom: i < 2 ? "16px" : "0" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "0.85rem", marginBottom: "4px" }}>{ref.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Año: {ref.year} • {ref.citations} citas</div>
                  </div>
                  <ChevronRight size={16} color="#cbd5e1" />
                </div>
              ))}
            </div>
          </div>

        </aside>
      </div>

    </div>
  );
}