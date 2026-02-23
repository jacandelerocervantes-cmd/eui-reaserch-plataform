"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, FileText, Bookmark, Quote, 
  CheckCircle2, AlertTriangle, Wand2, Download, 
  Layout, History, MessageSquare, ChevronRight
} from "lucide-react";

export default function CanvasRedaccion() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('copiloto'); // copiloto | citas | revision

  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return null;

  return (
    <div style={{ 
      display: "grid", 
      gridTemplateColumns: "1fr 400px", 
      height: "calc(100vh - 80px)", 
      backgroundColor: "white",
      overflow: "hidden"
    }}>
      
      {/* --- COLUMNA IZQUIERDA: EL EDITOR --- */}
      <section style={{ 
        display: "flex", 
        flexDirection: "column", 
        borderRight: "1px solid #e2e8f0",
        backgroundColor: "#fcfcfd"
      }}>
        {/* Toolbar Superior */}
        <div style={{ 
          padding: "12px 40px", 
          borderBottom: "1px solid #f1f5f9", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          backgroundColor: "white"
        }}>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: "800", color: "#1B396A", margin: 0 }}>
              Manuscrito: Algoritmos Genéticos V1
            </h2>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>Guardado hace 2 min</span>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><History size={20}/></button>
            <button style={{ backgroundColor: "#1B396A", color: "white", padding: "8px 16px", borderRadius: "10px", fontWeight: "700", border: "none", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <Download size={18} /> Exportar
            </button>
          </div>
        </div>

        {/* Área de Escritura */}
        <div className="custom-scrollbar" style={{ 
          flex: 1, 
          overflowY: "auto", 
          padding: "60px 80px",
          display: "flex",
          justifyContent: "center"
        }}>
          <div style={{ 
            width: "100%", 
            maxWidth: "800px", 
            backgroundColor: "white", 
            padding: "80px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            minHeight: "1000px",
            borderRadius: "4px"
          }}>
            <h1 style={{ fontSize: "2.2rem", color: "#1B396A", fontWeight: "900", marginBottom: "30px", border: "none", outline: "none" }} contentEditable suppressContentEditableWarning>
              Título del Artículo Científico
            </h1>
            <div style={{ color: "#475569", lineHeight: "1.8", fontSize: "1.1rem", border: "none", outline: "none" }} contentEditable suppressContentEditableWarning>
              Comienza a escribir tu introducción aquí... La IA está analizando tu tono para asegurar que sea estrictamente académico y profesional.
            </div>
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
                color: activeTab === tab.id ? "#f59e0b" : "#64748b",
                fontWeight: "800", fontSize: "0.75rem", cursor: "pointer",
                borderBottom: activeTab === tab.id ? "3px solid #f59e0b" : "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "6px"
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Contenido Dinámico del Copiloto */}
        <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          
          {activeTab === 'copiloto' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ backgroundColor: "#f3f0ff", padding: "20px", borderRadius: "20px", border: "1px solid #e9e3ff" }}>
                <h3 style={{ color: "#7c3aed", fontSize: "0.9rem", fontWeight: "800", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Wand2 size={16} /> Continuar Redacción
                </h3>
                <p style={{ fontSize: "0.85rem", color: "#5b21b6", margin: 0, lineHeight: "1.5" }}>
                  "Basado en tu introducción, sugiero mencionar el impacto del cambio climático en los suelos de la región..."
                </p>
                <button style={{ marginTop: "12px", width: "100%", padding: "10px", backgroundColor: "#7c3aed", color: "white", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}>Generar Párrafo Sugerido</button>
              </div>

              <div style={{ backgroundColor: "#f8fafc", padding: "20px", borderRadius: "20px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ color: "#1B396A", fontSize: "0.9rem", fontWeight: "800", margin: "0 0 15px 0" }}>Verificador de Estilo</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                   <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "8px" }}>
                      <AlertTriangle size={14} color="#f59e0b" /> Uso excesivo de voz pasiva detectado.
                   </div>
                   <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", gap: "8px" }}>
                      <CheckCircle2 size={14} color="#10b981" /> Tono académico consistente.
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'citas' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600" }}>Sugerencias del Explorador Literario:</p>
              {[
                { author: "Cervantes et al.", year: "2025", title: "Smart Irrigation Systems" },
                { author: "Ramos, E.", year: "2024", title: "Neural Networks in Farming" }
              ].map((cite, i) => (
                <div key={i} style={{ padding: "16px", borderRadius: "16px", border: "1px solid #f1f5f9", cursor: "pointer" }}>
                  <div style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.85rem" }}>({cite.author}, {cite.year})</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", margin: "4px 0" }}>{cite.title}</div>
                  <button style={{ color: "#f59e0b", background: "none", border: "none", fontSize: "0.75rem", fontWeight: "800", padding: 0, cursor: "pointer" }}>Insertar Cita</button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'revision' && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
               <MessageSquare size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
               <h3 style={{ color: "#1B396A", fontSize: "1.1rem", fontWeight: "800" }}>Modo Revisor 2</h3>
               <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: "1.5" }}>Activa esta simulación para que la IA critique tu paper como si fuera un revisor de revista Q1.</p>
               <button style={{ marginTop: "20px", width: "100%", padding: "12px", backgroundColor: "#1B396A", color: "white", borderRadius: "12px", fontWeight: "800", border: "none", cursor: "pointer" }}>Iniciar Auditoría Crítica</button>
            </div>
          )}

        </div>
      </aside>
    </div>
  );
}