"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  GraduationCap, FileText, Calendar, ChevronRight, 
  UserCheck, AlertCircle, Plus, Sparkles, CheckCircle2, 
  Clock, ArrowRight, Loader2, MessageSquare
} from "lucide-react";

// --- TARJETA DE TESISTA EXPANSIBLE E INTERACTIVA ---
const TesistaCard = ({ tesista, onUpdateProgress }: { tesista: any, onUpdateProgress: (id: string, progress: number) => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const handleSimulateAI = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingFeedback(true);
    setTimeout(() => {
      setIsGeneratingFeedback(false);
      setAiFeedback("El alumno corrigió el marco teórico según tus comentarios. Añadió 5 citas nuevas sobre algoritmos genéticos y reestructuró la hipótesis. El documento tiene buena cohesión, listo para pasar al capítulo de Metodología.");
    }, 2000);
  };

  const handleAprobarAvance = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Suma 15% al progreso sin pasarse de 100%
    const nuevoProgreso = Math.min(tesista.progreso + 15, 100);
    onUpdateProgress(tesista.id, nuevoProgreso);
  };

  const isAlert = tesista.progreso < 50 && tesista.diasRestantes < 30;

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white", borderRadius: "24px", 
        border: isAlert ? "2px solid #fecaca" : "1px solid #e2e8f0", 
        boxShadow: isHovered ? "0 20px 25px -5px rgba(27, 57, 106, 0.1)" : "0 4px 6px -1px rgba(0,0,0,0.02)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden",
        position: "relative", transform: isHovered ? "translateY(-4px)" : "translateY(0)"
      }}
    >
      {/* Alerta Visual si va atrasado */}
      {isAlert && <div style={{ position: "absolute", top: 0, right: 0, backgroundColor: "#ef4444", color: "white", padding: "4px 16px", borderBottomLeftRadius: "16px", fontSize: "0.75rem", fontWeight: "900", display: "flex", alignItems: "center", gap: "6px" }}><AlertCircle size={12}/> ATRASE DETECTADO</div>}

      <div style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
        
        {/* INFO DEL ALUMNO */}
        <div style={{ display: "flex", gap: "20px", alignItems: "center", flex: 1, minWidth: "300px" }}>
          <div style={{ backgroundColor: isAlert ? "#fef2f2" : "#fffbeb", color: isAlert ? "#ef4444" : "#f59e0b", padding: "16px", borderRadius: "20px", position: "relative" }}>
            <GraduationCap size={28} />
            {tesista.progreso === 100 && <div style={{ position: "absolute", bottom: "-5px", right: "-5px", backgroundColor: "#10b981", color: "white", borderRadius: "50%", padding: "4px" }}><CheckCircle2 size={12}/></div>}
          </div>
          <div>
            <h3 style={{ margin: "0 0 4px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "900" }}>{tesista.nombre}</h3>
            <p style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "#475569", fontWeight: "600" }}>{tesista.proyecto}</p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#d97706", backgroundColor: "#fef3c7", padding: "4px 10px", borderRadius: "8px", textTransform: "uppercase" }}>{tesista.status}</span>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12}/> Activo hace 2 días</span>
            </div>
          </div>
        </div>

        {/* PROGRESO INTERACTIVO */}
        <div style={{ textAlign: "right", minWidth: "250px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "800", marginBottom: "8px", color: "#1B396A" }}>
            <span>Avance Global</span>
            <span style={{ color: tesista.progreso === 100 ? "#10b981" : "#f59e0b" }}>{tesista.progreso}%</span>
          </div>
          <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden", marginBottom: "12px" }}>
            <div style={{ width: `${tesista.progreso}%`, height: "100%", backgroundColor: tesista.progreso === 100 ? "#10b981" : "#f59e0b", transition: "width 0.5s ease-out" }} />
          </div>
          
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button 
              onClick={handleAprobarAvance}
              disabled={tesista.progreso === 100}
              style={{ backgroundColor: tesista.progreso === 100 ? "#f1f5f9" : "#1B396A", color: tesista.progreso === 100 ? "#94a3b8" : "white", padding: "6px 16px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: "800", border: "none", cursor: tesista.progreso === 100 ? "not-allowed" : "pointer", transition: "all 0.2s" }}
            >
              {tesista.progreso === 100 ? "Tesis Terminada" : "Aprobar Capítulo (+15%)"}
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA EXPANSIBLE: DOCUMENTOS E IA */}
      <div style={{ 
        maxHeight: isHovered || aiFeedback ? "400px" : "0px", opacity: isHovered || aiFeedback ? 1 : 0, 
        padding: isHovered || aiFeedback ? "0 24px 24px 24px" : "0 24px", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        backgroundColor: "#f8fafc", borderTop: "1px solid #e2e8f0"
      }}>
        <div style={{ paddingTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          
          {/* Documento Reciente */}
          <div>
            <h4 style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 10px 0", textTransform: "uppercase", fontWeight: "800" }}>Última Entrega</h4>
            <div style={{ backgroundColor: "white", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <FileText size={24} color="#3b82f6" />
                <div>
                  <div style={{ fontSize: "0.9rem", fontWeight: "800", color: "#1B396A" }}>{tesista.ultimoArchivo}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Subido el {tesista.entrega}</div>
                </div>
              </div>
              <button style={{ backgroundColor: "#f1f5f9", color: "#1B396A", padding: "8px", borderRadius: "10px", border: "none", cursor: "pointer" }}>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Asistente de Revisión IA */}
          <div>
            <h4 style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 10px 0", textTransform: "uppercase", fontWeight: "800" }}>Certeza AI (Revisor)</h4>
            
            {aiFeedback ? (
               <div style={{ backgroundColor: "#fffbeb", padding: "16px", borderRadius: "16px", border: "1px solid #fde68a", animation: "fadeIn 0.3s ease-out" }}>
                 <div style={{ display: "flex", gap: "8px", color: "#d97706", fontSize: "0.85rem", fontWeight: "800", marginBottom: "6px" }}><Sparkles size={14}/> Resumen de Cambios:</div>
                 <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e", lineHeight: "1.5" }}>{aiFeedback}</p>
               </div>
            ) : (
               <button 
                 onClick={handleSimulateAI}
                 disabled={isGeneratingFeedback}
                 style={{ width: "100%", height: "70px", backgroundColor: "white", border: "1px dashed #cbd5e1", borderRadius: "16px", color: "#d97706", fontWeight: "800", fontSize: "0.9rem", cursor: isGeneratingFeedback ? "wait" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", transition: "all 0.2s" }}
                 onMouseEnter={e => {if(!isGeneratingFeedback) e.currentTarget.style.backgroundColor = "#fffbeb"}}
                 onMouseLeave={e => {if(!isGeneratingFeedback) e.currentTarget.style.backgroundColor = "white"}}
               >
                 {isGeneratingFeedback ? <><Loader2 size={18} className="animate-spin" /> Analizando documento...</> : <><Sparkles size={18} /> Resumir última versión con IA</>}
               </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default function GestionTesistas() {
  const [isMounted, setIsMounted] = useState(false);
  const [tesistas, setTesistas] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
    // Simulación de Fetch desde Supabase
    setTesistas([
      { id: "T-01", nombre: "Ing. Andrea Méndez", proyecto: "Detección de Plagas vía Vision AI", progreso: 85, entrega: "15 Mar", status: "Revisión Final", diasRestantes: 15, ultimoArchivo: "Capitulo_4_Resultados.pdf" },
      { id: "T-02", nombre: "Lic. Kevin Soto", proyecto: "Blockchain en Cadenas de Suministro", progreso: 30, entrega: "20 May", status: "Marco Teórico", diasRestantes: 65, ultimoArchivo: "Borrador_Cap2_V2.docx" },
      { id: "T-03", nombre: "Mtra. Elena Ruiz", proyecto: "Desalinización mediante IoT", progreso: 100, entrega: "Ya defendido", status: "Titulada", diasRestantes: 0, ultimoArchivo: "Tesis_Aprobada_Final.pdf" }
    ]);
  }, []);

  const handleUpdateProgress = (id: string, nuevoProgreso: number) => {
    // Optimistic UI Update
    setTesistas(prev => prev.map(t => t.id === id ? { ...t, progreso: nuevoProgreso, status: nuevoProgreso === 100 ? "Finalizada" : t.status } : t));
    // Aquí iría: await supabase.from('tesistas').update({ progreso: nuevoProgreso }).eq('id', id);
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>
      
      <header style={{ marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
              Mundo Dorado
            </span>
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Director de Tesis</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Seguimiento de protocolos, revisiones asistidas por IA y métricas de titulación.</p>
        </div>
        <button style={{ backgroundColor: "#1B396A", color: "white", padding: "14px 24px", borderRadius: "14px", fontWeight: "800", display: "flex", alignItems: "center", gap: "10px", border: "none", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(27, 57, 106, 0.2)" }}>
          <Plus size={20} /> Añadir Tesista
        </button>
      </header>

      {/* MÉTRICAS RÁPIDAS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "40px" }}>
         {[
           { label: "Tesistas Activos", val: tesistas.filter(t=>t.progreso < 100).length, color: "#3b82f6" },
           { label: "En Riesgo de Atraso", val: tesistas.filter(t=>t.progreso < 50 && t.diasRestantes < 30).length, color: "#ef4444" },
           { label: "Titulados Histórico", val: 14, color: "#10b981" }
         ].map((m, i) => (
           <div key={i} style={{ backgroundColor: "white", padding: "24px", borderRadius: "20px", border: `1px solid ${m.color}30`, display: "flex", alignItems: "center", gap: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
             <div style={{ fontSize: "3rem", fontWeight: "900", color: m.color, lineHeight: 1 }}>{m.val}</div>
             <div style={{ fontSize: "1rem", fontWeight: "800", color: "#64748b", lineHeight: 1.2 }}>{m.label}</div>
           </div>
         ))}
      </div>

      {/* LISTA DE TESISTAS */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <h2 style={{ color: "#1B396A", fontSize: "1.2rem", fontWeight: "900", margin: "0 0 10px 0" }}>Pipeline de Titulación</h2>
        {tesistas.map((t) => (
          <TesistaCard key={t.id} tesista={t} onUpdateProgress={handleUpdateProgress} />
        ))}
      </div>
      
    </div>
  );
}