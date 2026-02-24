"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, Library, Share2, Sparkles, 
  FileText, Network, Lightbulb, Filter,
  Download, ExternalLink, ChevronRight, Info, Loader2, ArrowRight
} from "lucide-react";

// --- SUB-COMPONENTE: NODO DEL GRAFO (INTERACTIVO) ---
const KnowledgeNode = ({ data, isActive, onClick }: { data: any, isActive: boolean, onClick: () => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        position: "absolute", left: data.x, top: data.y,
        width: data.size, height: data.size, borderRadius: "50%",
        backgroundColor: isActive ? "#f59e0b" : (data.type === 'main' ? "#1B396A" : "white"),
        border: `3px solid ${isActive ? "#f59e0b" : (data.type === 'main' ? "#1B396A" : "#e2e8f0")}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: isActive || isHovered ? "0 0 25px rgba(245, 158, 11, 0.4)" : "0 4px 6px rgba(0,0,0,0.05)",
        zIndex: isActive || isHovered ? 10 : 1,
        transform: isActive ? "scale(1.1)" : "scale(1)"
      }}
    >
      {/* Tooltip Hover */}
      {(isHovered || isActive) && (
        <div style={{
          position: "absolute", bottom: "120%", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#1e293b", color: "white", padding: "8px 14px", borderRadius: "10px",
          fontSize: "0.75rem", whiteSpace: "nowrap", fontWeight: "800", pointerEvents: "none",
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 20
        }}>
          {data.title}
          <div style={{ position: "absolute", bottom: "-4px", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid #1e293b" }}></div>
        </div>
      )}
      <FileText size={data.size * 0.4} color={isActive ? "white" : (data.type === 'main' ? "white" : "#1B396A")} style={{ transition: "color 0.3s" }} />
    </div>
  );
};

export default function ExploradorLiterario() {
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeGap, setActiveGap] = useState<string | null>(null);

  // Estado del Grafo (Listo para ser alimentado por Supabase)
  const [papers, setPapers] = useState<any[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    // Simulamos la carga de la base de datos de literatura
    setPapers([
      { id: 'p1', title: "Impacto de IA en Agricultura Tropical", type: "main", x: "45%", y: "40%", size: 80, year: 2025, author: "Candelero et al.", summary: "Este artículo principal propone un nuevo método de optimización para redes IoT en climas extremos de la península de Yucatán. Sus conclusiones principales desafían el modelo clásico de Smith (2022) reduciendo latencia en un 15%.", citations: 45 },
      { id: 'p2', title: "Redes Neuronales para Riego 2024", type: "sub", x: "25%", y: "20%", size: 55, year: 2024, author: "Ramos, E.", summary: "Estudio sobre topologías de redes neuronales aplicadas a sistemas de riego automatizado.", citations: 120 },
      { id: 'p3', title: "Dataset: Clima Regional LATAM", type: "sub", x: "65%", y: "25%", size: 55, year: 2023, author: "Gómez, M.", summary: "Compilación de 10 años de datos meteorológicos orientados a machine learning.", citations: 310 },
      { id: 'p4', title: "Teoría de Grafos Aplicada a Sensores", type: "sub", x: "32%", y: "65%", size: 50, year: 2022, author: "Smith, J.", summary: "Fundamentos teóricos sobre la resiliencia en redes de sensores inalámbricos.", citations: 89 },
      { id: 'p5', title: "Ética Algorítmica en la Agronomía", type: "sub", x: "65%", y: "60%", size: 45, year: 2024, author: "López, T.", summary: "Análisis cualitativo del impacto socioeconómico de automatizar decisiones de riego.", citations: 12 },
    ]);
    setSelectedNodeId('p1'); // Seleccionamos el nodo principal por defecto
  }, []);

  const handleAnalyzeGap = () => {
    setIsAnalyzing(true);
    setActiveGap(null);
    setTimeout(() => {
      setIsAnalyzing(false);
      setActiveGap("Análisis de Certeza AI completado. El modelo identifica una oportunidad de investigación clara: Ninguno de los 34 artículos analizados correlaciona directamente las variables ético-sociales (López, 2024) con los datasets climáticos (Gómez, 2023) al aplicar redes neuronales. Hay un hueco para un modelo de IA socialmente responsable.");
    }, 2500);
  };

  if (!isMounted) return null;

  const selectedNode = papers.find(p => p.id === selectedNodeId);

  return (
    <div style={{ padding: "40px", maxWidth: "1600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px", height: "calc(100vh - 80px)", animation: "fadeIn 0.5s ease-out" }}>
      
      {/* HEADER Y BÚSQUEDA */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
              Mundo Dorado
            </span>
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.4rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Explorador Literario</h1>
          <p style={{ color: "#64748b", fontSize: "1.05rem", fontWeight: "500", marginTop: "4px" }}>Descubre conexiones y huecos en la literatura científica usando Grafos e IA.</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
           <div style={{ position: "relative", width: "400px" }}>
              <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar concepto, autor o paper..." 
                style={{ width: "100%", padding: "14px 16px 14px 48px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none", color: "#1B396A", fontWeight: "600", transition: "border 0.2s" }} 
                onFocus={(e) => e.target.style.borderColor = "#f59e0b"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
              />
           </div>
           <button style={{ backgroundColor: "white", border: "1px solid #e2e8f0", color: "#64748b", padding: "0 16px", borderRadius: "14px", display: "flex", alignItems: "center", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => {e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.color = "#1B396A"}} onMouseLeave={e => {e.currentTarget.style.backgroundColor = "white"; e.currentTarget.style.color = "#64748b"}}>
             <Filter size={18} />
           </button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "24px", flex: 1, minHeight: 0 }}>
        
        {/* PANEL CENTRAL: EL MAPA DE CONOCIMIENTO (Visualización) */}
        <section style={{ backgroundColor: "#f8fafc", borderRadius: "32px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "inset 0 4px 6px rgba(0,0,0,0.02)" }}>
          
          {/* Controles del Grafo */}
          <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", zIndex: 5, position: "absolute", top: 0, left: 0, right: 0 }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <span style={{ backgroundColor: "white", padding: "8px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px", color: "#1B396A", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                <Network size={16} color="#f59e0b" /> Vista de Grafo 2D
              </span>
            </div>
            <div style={{ backgroundColor: "white", padding: "8px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", color: "#64748b", fontSize: "0.8rem", fontWeight: "700" }}>
              {papers.length} Nodos Relacionados
            </div>
          </div>

          {/* SIMULACIÓN DEL GRAFO */}
          <div style={{ flex: 1, position: "relative", width: "100%", height: "100%", cursor: "grab" }}>
             
             {/* Líneas de conexión decorativas (Basadas en los nodos definidos) */}
             <svg style={{ position: "absolute", width: "100%", height: "100%", top: 0, left: 0, pointerEvents: "none" }}>
                <line x1="49%" y1="45%" x2="28%" y2="25%" stroke={selectedNodeId === 'p2' ? "#f59e0b" : "#cbd5e1"} strokeWidth="2" strokeDasharray="4" style={{ transition: "stroke 0.3s" }} />
                <line x1="49%" y1="45%" x2="68%" y2="30%" stroke={selectedNodeId === 'p3' ? "#f59e0b" : "#cbd5e1"} strokeWidth="2" strokeDasharray="4" style={{ transition: "stroke 0.3s" }} />
                <line x1="49%" y1="45%" x2="35%" y2="68%" stroke={selectedNodeId === 'p4' ? "#f59e0b" : "#cbd5e1"} strokeWidth="2" strokeDasharray="4" style={{ transition: "stroke 0.3s" }} />
                <line x1="68%" y1="30%" x2="68%" y2="62%" stroke={selectedNodeId === 'p5' || selectedNodeId === 'p3' ? "#f59e0b" : "#e2e8f0"} strokeWidth="1" strokeDasharray="4" style={{ transition: "stroke 0.3s" }} />
             </svg>

             {/* Nodos Renderizados */}
             {papers.map((paper) => (
                <KnowledgeNode 
                  key={paper.id} 
                  data={paper} 
                  isActive={selectedNodeId === paper.id} 
                  onClick={() => setSelectedNodeId(paper.id)} 
                />
             ))}
          </div>

          {/* CINTA INFERIOR: DETECCIÓN DE GAPS */}
          <div style={{ padding: "24px", background: "linear-gradient(to top, rgba(248, 250, 252, 1) 40%, transparent)", zIndex: 5, position: "absolute", bottom: 0, left: 0, right: 0 }}>
             <div style={{ backgroundColor: "white", padding: "16px 20px", borderRadius: "20px", border: activeGap ? "2px solid #f59e0b" : "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: activeGap ? "0 10px 25px rgba(245, 158, 11, 0.15)" : "0 4px 10px rgba(0,0,0,0.02)", transition: "all 0.3s" }}>
                
                <div style={{ display: "flex", gap: "16px", alignItems: "center", flex: 1 }}>
                   <div style={{ backgroundColor: activeGap ? "#f59e0b" : "#fffbeb", color: activeGap ? "white" : "#f59e0b", padding: "12px", borderRadius: "14px", transition: "all 0.3s" }}>
                     {isAnalyzing ? <Loader2 size={24} className="animate-spin" /> : <Lightbulb size={24} />}
                   </div>
                   <div style={{ flex: 1, paddingRight: "20px" }}>
                      <div style={{ fontWeight: "900", color: "#1B396A", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                        Scanner de Gaps (AI) <Sparkles size={14} color="#f59e0b" />
                      </div>
                      <div style={{ fontSize: "0.85rem", color: activeGap ? "#475569" : "#64748b", marginTop: "4px", lineHeight: "1.4", fontStyle: activeGap ? "normal" : "italic" }}>
                        {activeGap ? activeGap : "Cruza los metadatos de los nodos visibles para descubrir oportunidades de investigación o temas no explorados."}
                      </div>
                   </div>
                </div>

                <button 
                  onClick={handleAnalyzeGap}
                  disabled={isAnalyzing}
                  style={{ backgroundColor: isAnalyzing ? "#cbd5e1" : "#1B396A", color: "white", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: "800", fontSize: "0.9rem", cursor: isAnalyzing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s", whiteSpace: "nowrap" }}
                >
                  {isAnalyzing ? "Analizando Red..." : "Explorar Huecos"}
                </button>
             </div>
          </div>
        </section>

        {/* PANEL DERECHO: DETALLES Y AI SUMMARY (Dinámico basado en el nodo seleccionado) */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "24px", overflowY: "auto" }} className="custom-scrollbar">
          
          {selectedNode ? (
            <>
              {/* Tarjeta de Resumen IA */}
              <div style={{ backgroundColor: "#1B396A", borderRadius: "24px", padding: "32px", color: "white", position: "relative", overflow: "hidden", animation: "slideLeft 0.3s ease-out" }}>
                <Sparkles size={80} style={{ position: "absolute", right: "-10px", top: "-10px", opacity: 0.05 }} />
                
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  <span style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "white", padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "800" }}>{selectedNode.year}</span>
                  <span style={{ backgroundColor: "rgba(245,158,11,0.2)", color: "#fbbf24", padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Quote size={10} /> {selectedNode.citations} Citas
                  </span>
                </div>

                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.2rem", fontWeight: "900", lineHeight: "1.3" }}>
                   {selectedNode.title}
                </h3>
                <p style={{ margin: "0 0 20px 0", fontSize: "0.85rem", color: "#94a3b8", fontWeight: "600" }}>{selectedNode.author}</p>

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "20px", marginBottom: "24px" }}>
                  <p style={{ fontSize: "0.9rem", opacity: 0.9, lineHeight: "1.6", margin: 0 }}>
                    {selectedNode.summary}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button style={{ flex: 1, backgroundColor: "white", border: "none", color: "#1B396A", padding: "12px", borderRadius: "12px", fontWeight: "800", fontSize: "0.85rem", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                    <ExternalLink size={16} /> Ver Fuente
                  </button>
                  <button style={{ flex: 1, backgroundColor: "#f59e0b", border: "none", color: "#1B396A", padding: "12px", borderRadius: "12px", fontWeight: "900", fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                    Citar (APA)
                  </button>
                </div>
              </div>

              {/* Lista de Referencias Relacionadas */}
              <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px", animation: "slideLeft 0.4s ease-out" }}>
                <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Library size={18} /> Bibliografía Conectada
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {papers.filter(p => p.id !== selectedNode.id).slice(0, 3).map((ref, i) => (
                    <div key={i} onClick={() => setSelectedNodeId(ref.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < 2 ? "1px solid #f1f5f9" : "none", paddingBottom: i < 2 ? "16px" : "0", cursor: "pointer", transition: "padding-left 0.2s" }} onMouseEnter={e => {e.currentTarget.style.paddingLeft = "8px"; (e.currentTarget.lastChild as HTMLElement).style.color = "#f59e0b"}} onMouseLeave={e => {e.currentTarget.style.paddingLeft = "0"; (e.currentTarget.lastChild as HTMLElement).style.color = "#cbd5e1"}}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "0.85rem", marginBottom: "4px" }}>{ref.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>{ref.author} • {ref.year}</div>
                      </div>
                      <ChevronRight size={16} color="#cbd5e1" style={{ transition: "color 0.2s" }} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ height: "100%", border: "2px dashed #e2e8f0", borderRadius: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", textAlign: "center", color: "#94a3b8" }}>
              <Network size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
              <h3 style={{ color: "#64748b", margin: "0 0 8px 0", fontSize: "1.1rem" }}>Selecciona un Nodo</h3>
              <p style={{ fontSize: "0.85rem", margin: 0 }}>Haz clic en un círculo del mapa para ver los detalles del artículo, resumen y red de citas.</p>
            </div>
          )}

        </aside>
      </div>
    </div>
  );
}