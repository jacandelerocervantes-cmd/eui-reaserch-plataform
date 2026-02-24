"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Sparkles, FileText, Bookmark, Quote, 
  CheckCircle2, AlertTriangle, Wand2, Download, 
  Layout, History, MessageSquare, ChevronRight, Loader2
} from "lucide-react";

export default function CanvasRedaccion() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('copiloto'); // copiloto | citas | revision

  // Estados del Documento
  const [titulo, setTitulo] = useState("Algoritmos Genéticos en la Optimización de Riego");
  const [contenido, setContenido] = useState("El cambio climático ha impuesto retos sin precedentes en la gestión de recursos hídricos para la agricultura. En este contexto, la optimización de...");
  
  // Estados de Fricción Cero (Auto-guardado)
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState("Sincronizado");

  // Estados de IA
  const [isGenerating, setIsGenerating] = useState(false);
  const [revisionScore, setRevisionScore] = useState<number | null>(null);
  const [critica, setCritica] = useState<string | null>(null);

  useEffect(() => setIsMounted(true), []);

  // =====================================================================
  // 1. MOTOR DE AUTO-GUARDADO (Fricción Cero con Debounce)
  // =====================================================================
  useEffect(() => {
    if (!isMounted) return;
    
    setLastSaved("Escribiendo...");
    
    // Espera 1.5 segundos después de que el usuario deja de teclear para guardar
    const delayDebounceFn = setTimeout(async () => {
      setIsSaving(true);
      try {
        // Aquí iría el guardado real a Supabase en la tabla 'canvas_documentos'
        // await supabase.from('canvas_documentos').upsert({ id: 'doc-1', titulo, contenido_json: contenido });
        
        // Simulamos el tiempo de red de Supabase
        await new Promise(r => setTimeout(r, 500)); 
        setLastSaved(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
      } catch (error) {
        console.error("Error al guardar:", error);
      } finally {
        setIsSaving(false);
      }
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [titulo, contenido, isMounted]);

  // =====================================================================
  // 2. COPILOTO GENERATIVO (Simulación de Inserción AI)
  // =====================================================================
  const generarParrafo = () => {
    setIsGenerating(true);
    
    // Simulamos el tiempo de respuesta de un LLM (Ej. Gemini / GPT-4)
    setTimeout(() => {
      const sugerencia = "\n\nPor lo tanto, la integración de redes de sensores IoT con algoritmos evolutivos permite no solo predecir el estrés hídrico de la planta, sino también adaptar los ciclos de riego en tiempo real, maximizando el rendimiento del cultivo y minimizando el desperdicio de agua en un 30% respecto a los métodos tradicionales.";
      
      setContenido(prev => prev + sugerencia);
      setIsGenerating(false);
    }, 1800);
  };

  // =====================================================================
  // 3. MODO REVISOR 2 (Auditoría Crítica)
  // =====================================================================
  const iniciarAuditoria = () => {
    setIsGenerating(true);
    setRevisionScore(null);
    setCritica(null);

    setTimeout(() => {
      const length = contenido.split(' ').length;
      
      // Lógica simple simulando una IA evaluadora
      if (length < 50) {
        setRevisionScore(45);
        setCritica("El manuscrito carece de profundidad. La introducción no establece claramente la brecha de conocimiento (gap). Se requiere expandir sustancialmente el marco teórico.");
      } else {
        setRevisionScore(82);
        setCritica("El planteamiento es sólido, sin embargo, la metodología necesita mayor rigor estadístico. La afirmación sobre el '30% de ahorro' debe ser respaldada con citas o datos empíricos de las pruebas de laboratorio.");
      }
      setIsGenerating(false);
    }, 2500);
  };

  if (!isMounted) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", height: "calc(100vh - 80px)", backgroundColor: "white", overflow: "hidden" }}>
      
      {/* --- COLUMNA IZQUIERDA: EL EDITOR --- */}
      <section style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #e2e8f0", backgroundColor: "#fcfcfd" }}>
        
        {/* Toolbar Superior */}
        <div style={{ padding: "12px 40px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "white" }}>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
              Mundo Dorado
            </span>
            <h2 style={{ fontSize: "1rem", fontWeight: "800", color: "#1B396A", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              Canvas AI
              {isSaving && <Loader2 size={14} className="animate-spin text-amber-500" />}
            </h2>
            <span style={{ fontSize: "0.75rem", color: isSaving ? "#f59e0b" : "#94a3b8", fontWeight: "600", transition: "color 0.3s" }}>
              {isSaving ? "Guardando..." : `Guardado a las ${lastSaved}`}
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "8px", borderRadius: "8px" }} title="Historial de Versiones"><History size={20}/></button>
            <button style={{ backgroundColor: "#1B396A", color: "white", padding: "8px 16px", borderRadius: "10px", fontWeight: "700", border: "none", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#152c54"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "#1B396A"}>
              <Download size={18} /> Exportar Word
            </button>
          </div>
        </div>

        {/* Área de Escritura (Sin Fricción) */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "60px 80px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: "800px", backgroundColor: "white", padding: "80px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", minHeight: "1000px", borderRadius: "4px", display: "flex", flexDirection: "column" }}>
            
            {/* Título Controlado */}
            <input 
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título del Artículo Científico"
              style={{ fontSize: "2.2rem", color: "#1B396A", fontWeight: "900", marginBottom: "30px", border: "none", outline: "none", width: "100%", fontFamily: "inherit" }}
            />
            
            {/* Cuerpo del Texto Auto-expansible */}
            <textarea 
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Comienza a escribir tu introducción aquí..."
              style={{ 
                flex: 1, color: "#475569", lineHeight: "1.8", fontSize: "1.1rem", 
                border: "none", outline: "none", resize: "none", width: "100%", 
                fontFamily: "inherit", minHeight: "600px" 
              }}
            />
          </div>
        </div>
      </section>

      {/* --- COLUMNA DERECHA: EL COPILOTO AI --- */}
      <aside style={{ display: "flex", flexDirection: "column", backgroundColor: "white" }}>
        
        {/* Tabs de Herramientas */}
        <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9" }}>
          {[
            { id: 'copiloto', icon: <Sparkles size={18} />, label: "Asistente" },
            { id: 'citas', icon: <Quote size={18} />, label: "Citas" },
            { id: 'revision', icon: <CheckCircle2 size={18} />, label: "Revisión" }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ 
                flex: 1, padding: "20px 10px", border: "none", 
                backgroundColor: activeTab === tab.id ? "white" : "#f8fafc",
                color: activeTab === tab.id ? "#d97706" : "#64748b", // Dorado/Ambar
                fontWeight: "800", fontSize: "0.75rem", cursor: "pointer",
                borderBottom: activeTab === tab.id ? "3px solid #f59e0b" : "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                transition: "all 0.2s"
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Contenido Dinámico del Copiloto */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "24px", position: "relative" }}>
          
          {/* Overlay de carga IA */}
          {isGenerating && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(255,255,255,0.8)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
              <Loader2 size={32} className="animate-spin text-amber-500" />
              <span style={{ fontWeight: "800", color: "#d97706", fontSize: "0.9rem" }}>Certeza AI procesando...</span>
            </div>
          )}

          {activeTab === 'copiloto' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fadeIn 0.3s" }}>
              <div style={{ backgroundColor: "#fffbeb", padding: "20px", borderRadius: "20px", border: "1px solid #fde68a" }}>
                <h3 style={{ color: "#d97706", fontSize: "0.9rem", fontWeight: "800", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Wand2 size={16} /> Sugerencia de Redacción
                </h3>
                <p style={{ fontSize: "0.85rem", color: "#92400e", margin: 0, lineHeight: "1.5", fontStyle: "italic" }}>
                  "Basado en tu introducción, sugiero mencionar el impacto estadístico del desperdicio de agua mediante redes IoT..."
                </p>
                <button 
                  onClick={generarParrafo}
                  style={{ marginTop: "16px", width: "100%", padding: "12px", backgroundColor: "#f59e0b", color: "white", border: "none", borderRadius: "10px", fontWeight: "800", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", boxShadow: "0 4px 10px rgba(245, 158, 11, 0.3)", transition: "transform 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >
                  <Sparkles size={16} /> Insertar Sugerencia
                </button>
              </div>

              <div style={{ backgroundColor: "#f8fafc", padding: "20px", borderRadius: "20px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ color: "#1B396A", fontSize: "0.9rem", fontWeight: "800", margin: "0 0 15px 0" }}>Verificador de Estilo en Vivo</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                   <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: "2px" }} /> 
                      Uso excesivo de voz pasiva detectado en el primer párrafo. Considera hacer la oración más directa.
                   </div>
                   <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: "2px" }} /> 
                      Tono académico consistente. Vocabulario técnico adecuado ("recursos hídricos").
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'citas' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "fadeIn 0.3s" }}>
              <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                <p style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Database size={14} /> Tu Repositorio Zotero / Mendeley
                </p>
                <div style={{ position: "relative" }}>
                  <Search size={14} color="#94a3b8" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" placeholder="Buscar por autor o keyword..." style={{ width: "100%", padding: "8px 12px 8px 30px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.8rem", outline: "none" }} />
                </div>
              </div>

              {[
                { author: "Candelero et al.", year: "2026", title: "Supabase Edge Functions in Smart Farming", journal: "IEEE Sensors" },
                { author: "Ramos, E.", year: "2024", title: "Neural Networks in IoT Architectures", journal: "Nature Agriculture" }
              ].map((cite, i) => (
                <div key={i} style={{ padding: "16px", borderRadius: "16px", border: "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                  <div style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.85rem" }}>({cite.author}, {cite.year})</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", margin: "4px 0", lineHeight: "1.4" }}>{cite.title}. <i>{cite.journal}</i>.</div>
                  <button style={{ color: "#d97706", background: "none", border: "none", fontSize: "0.75rem", fontWeight: "800", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", marginTop: "8px" }}>
                    <Plus size={12} /> Insertar [1]
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'revision' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "fadeIn 0.3s" }}>
               
               {revisionScore === null ? (
                 <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <MessageSquare size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
                    <h3 style={{ color: "#1B396A", fontSize: "1.1rem", fontWeight: "800" }}>Modo Revisor 2</h3>
                    <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: "1.5" }}>Activa esta simulación para que la IA audite tu paper buscando debilidades metodológicas antes de mandarlo a la revista.</p>
                    <button onClick={iniciarAuditoria} style={{ marginTop: "20px", width: "100%", padding: "12px", backgroundColor: "#1B396A", color: "white", borderRadius: "12px", fontWeight: "800", border: "none", cursor: "pointer", boxShadow: "0 4px 10px rgba(27, 57, 106, 0.2)" }}>
                      Iniciar Auditoría Crítica
                    </button>
                 </div>
               ) : (
                 <div style={{ animation: "slideUp 0.4s ease-out" }}>
                   <div style={{ backgroundColor: revisionScore > 70 ? "#ecfdf5" : "#fef2f2", padding: "24px", borderRadius: "20px", border: `1px solid ${revisionScore > 70 ? '#a7f3d0' : '#fecaca'}`, textAlign: "center" }}>
                      <div style={{ fontSize: "3rem", fontWeight: "900", color: revisionScore > 70 ? "#059669" : "#dc2626", lineHeight: "1" }}>{revisionScore}</div>
                      <div style={{ fontSize: "0.75rem", fontWeight: "800", color: revisionScore > 70 ? "#10b981" : "#ef4444", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>Probabilidad de Aceptación</div>
                   </div>

                   <div style={{ marginTop: "20px", backgroundColor: "#f8fafc", padding: "20px", borderRadius: "20px", border: "1px solid #e2e8f0" }}>
                     <h4 style={{ color: "#1B396A", margin: "0 0 10px 0", fontSize: "0.9rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                       <MessageSquare size={16} /> Comentarios del Revisor
                     </h4>
                     <p style={{ color: "#475569", fontSize: "0.85rem", lineHeight: "1.6", margin: 0, fontStyle: "italic", borderLeft: "3px solid #cbd5e1", paddingLeft: "12px" }}>
                       "{critica}"
                     </p>
                   </div>

                   <button onClick={() => setRevisionScore(null)} style={{ marginTop: "20px", width: "100%", padding: "12px", backgroundColor: "white", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: "12px", fontWeight: "700", cursor: "pointer" }}>
                     Limpiar y Seguir Escribiendo
                   </button>
                 </div>
               )}

            </div>
          )}

        </div>
      </aside>
    </div>
  );
}