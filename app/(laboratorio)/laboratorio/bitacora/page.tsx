"use client";

import React, { useState, useEffect } from "react";
import { 
  Mic, MicOff, Save, Clock, Book, 
  Plus, Search, Sparkles, Database,
  Beaker, ChevronRight, FileJson, Trash2
} from "lucide-react";

export default function BitacoraLaboratorio() {
  const [isMounted, setIsMounted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeNote, setActiveNote] = useState<string>("");

  useEffect(() => setIsMounted(true), []);

  const logs = [
    { id: 1, date: "22 Feb, 2026", time: "14:20", title: "Prueba de Estres Térmico", tags: ["Hardware", "IoT"] },
    { id: 2, date: "21 Feb, 2026", time: "10:05", title: "Calibración de Sensores Lora", tags: ["Redes", "Calibración"] },
  ];

  if (!isMounted) return null;

  return (
    <div style={{ 
      display: "grid", 
      gridTemplateColumns: "350px 1fr", 
      height: "calc(100vh - 80px)", 
      backgroundColor: "#f8fafc" 
    }}>
      
      {/* --- COLUMNA IZQUIERDA: HISTORIAL DE REGISTROS --- */}
      <aside style={{ backgroundColor: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid #f1f5f9" }}>
          <button style={{ 
            width: "100%", backgroundColor: "#10b981", color: "white", 
            padding: "12px", borderRadius: "12px", border: "none", 
            fontWeight: "800", display: "flex", alignItems: "center", 
            justifyContent: "center", gap: "10px", cursor: "pointer",
            boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)"
          }}>
            <Plus size={18} /> Nuevo Registro
          </button>
          <div style={{ position: "relative", marginTop: "16px" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input type="text" placeholder="Buscar en bitácora..." style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.85rem" }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }} className="custom-scrollbar">
          {logs.map(log => (
            <div key={log.id} style={{ padding: "20px", borderBottom: "1px solid #f8fafc", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0fdf4"}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#94a3b8" }}>{log.date} • {log.time}</span>
                <ChevronRight size={14} color="#cbd5e1" />
              </div>
              <div style={{ fontWeight: "700", color: "#1B396A", fontSize: "0.95rem", marginBottom: "8px" }}>{log.title}</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {log.tags.map(tag => (
                  <span key={tag} style={{ fontSize: "0.65rem", fontWeight: "700", backgroundColor: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: "4px" }}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* --- COLUMNA DERECHA: EDITOR Y VOZ --- */}
      <section style={{ display: "flex", flexDirection: "column" }}>
        {/* Toolbar del Editor */}
        <div style={{ padding: "16px 40px", backgroundColor: "white", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ backgroundColor: "#ecfdf5", color: "#10b981", padding: "8px", borderRadius: "10px" }}><Book size={20} /></div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#1B396A", margin: 0 }}>Entrada: Observación de Sensores</h2>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><Trash2 size={20}/></button>
            <button style={{ backgroundColor: "#1B396A", color: "white", padding: "10px 24px", borderRadius: "12px", fontWeight: "800", border: "none", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <Save size={18} /> Guardar Registro
            </button>
          </div>
        </div>

        {/* Área de Entrada de Datos */}
        <div style={{ flex: 1, padding: "40px", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", flex: 1, display: "flex", flexDirection: "column", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <textarea 
              value={activeNote}
              onChange={(e) => setActiveNote(e.target.value)}
              placeholder="Describe tus observaciones aquí o usa el dictado de voz..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: "1.1rem", color: "#334155", lineHeight: "1.6", resize: "none" }}
            />
            
            {/* Controles de Voz e IA */}
            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                <button 
                  onClick={() => setIsRecording(!isRecording)}
                  style={{ 
                    backgroundColor: isRecording ? "#ef4444" : "#f1f5f9", 
                    color: isRecording ? "white" : "#64748b",
                    padding: "12px 20px", borderRadius: "14px", border: "none",
                    fontWeight: "700", display: "flex", alignItems: "center", gap: "10px",
                    cursor: "pointer", transition: "all 0.3s"
                  }}
                >
                  {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                  {isRecording ? "Grabando..." : "Dictado por Voz"}
                </button>
                <button style={{ backgroundColor: "#f3f0ff", color: "#7c3aed", padding: "12px 20px", borderRadius: "14px", border: "none", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <Sparkles size={18} /> Auto-estructurar Datos
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "0.85rem", fontWeight: "600" }}>
                <Clock size={16} /> Última edición: hace 1 min
              </div>
            </div>
          </div>

          {/* Panel de Datos Estructurados (Lo que la IA detecta) */}
          <div style={{ backgroundColor: "#1B396A", borderRadius: "20px", padding: "20px", color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <FileJson size={18} color="#10b981" />
              <span style={{ fontSize: "0.85rem", fontWeight: "800", opacity: 0.9 }}>DATA PREVIEW (JSON)</span>
            </div>
            <code style={{ fontSize: "0.8rem", opacity: 0.8, fontFamily: "monospace" }}>
              {`{ "temperatura": 24.5, "unidad": "C", "sensor_id": "IOT-01", "timestamp": "2026-02-22T20:15" }`}
            </code>
          </div>
        </div>
      </section>

    </div>
  );
}