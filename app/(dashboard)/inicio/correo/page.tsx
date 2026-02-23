"use client";

import React, { useState, useEffect } from "react";
import { 
  Mail, Star, Archive, Trash2, Search, 
  Filter, ChevronRight, User, Sparkles, Send
} from "lucide-react";

export default function BandejaCorreo() {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedMail, setSelectedMail] = useState<any>(null);

  useEffect(() => setIsMounted(true), []);

  const emails = [
    { id: 1, from: "Juan Pérez (Alumno)", subject: "Duda sobre la Unidad 2", preview: "Hola maestro, tengo una duda sobre el ejercicio de subnetting...", time: "10:24 AM", category: "Alumnos", unread: true },
    { id: 2, from: "Secretaría Académica", subject: "Reunión de Consejo", preview: "Se les convoca a la reunión ordinaria para revisar los indicadores...", time: "09:15 AM", category: "Institucional", unread: false },
    { id: 3, from: "IEEE Xplore", subject: "Nueva publicación en tu área", preview: "Tu alerta de búsqueda 'Vision Artificial' tiene nuevos resultados...", time: "Ayer", category: "Investigación", unread: true }
  ];

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", display: "grid", gridTemplateColumns: "350px 1fr", gap: "24px", height: "calc(100vh - 120px)" }}>
      
      {/* COLUMNA 1: LISTADO DE CORREOS */}
      <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input type="text" placeholder="Buscar en correo..." style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "5px" }}>
            {["Todos", "Alumnos", "Investigación"].map(cat => (
              <span key={cat} style={{ padding: "6px 12px", backgroundColor: "#f1f5f9", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "700", color: "#64748b", cursor: "pointer", whiteSpace: "nowrap" }}>{cat}</span>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }} className="custom-scrollbar">
          {emails.map(mail => (
            <div 
              key={mail.id} 
              onClick={() => setSelectedMail(mail)}
              style={{ 
                padding: "20px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", 
                backgroundColor: selectedMail?.id === mail.id ? "#f8fafc" : "white",
                position: "relative"
              }}
            >
              {mail.unread && <div style={{ position: "absolute", left: "8px", top: "25px", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#3b82f6" }} />}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1B396A" }}>{mail.from}</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{mail.time}</span>
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>{mail.subject}</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{mail.preview}</div>
            </div>
          ))}
        </div>
      </section>

      {/* COLUMNA 2: VISTA DEL CORREO SELECCIONADO */}
      <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {selectedMail ? (
          <>
            <div style={{ padding: "24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#1B396A", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                  {selectedMail.from[0]}
                </div>
                <div>
                  <div style={{ fontWeight: "800", color: "#1B396A" }}>{selectedMail.from}</div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Para: mi@tecnm.mx</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "none", cursor: "pointer" }}><Star size={18} color="#94a3b8" /></button>
                <button style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "none", cursor: "pointer" }}><Archive size={18} color="#94a3b8" /></button>
                <button style={{ padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "none", cursor: "pointer" }}><Trash2 size={18} color="#ef4444" /></button>
              </div>
            </div>
            
            <div style={{ padding: "32px", flex: 1, overflowY: "auto" }}>
              <h2 style={{ fontSize: "1.5rem", color: "#1B396A", fontWeight: "900", marginBottom: "24px" }}>{selectedMail.subject}</h2>
              <p style={{ color: "#475569", lineHeight: "1.6", fontSize: "1rem" }}>
                {selectedMail.preview} <br /><br />
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
            </div>

            {/* BARRA DE RESPUESTA CON IA */}
            <div style={{ padding: "24px", backgroundColor: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                <input type="text" placeholder="Escribe una respuesta..." style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none" }} />
                <button style={{ backgroundColor: "#8b5cf6", color: "white", border: "none", padding: "0 20px", borderRadius: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <Sparkles size={18} /> Redactar con IA
                </button>
                <button style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "0 20px", borderRadius: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <Send size={18} /> Enviar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#94a3b8" }}>
            <Mail size={64} style={{ marginBottom: "16px", opacity: 0.2 }} />
            <p style={{ fontWeight: "600" }}>Selecciona un correo para leerlo</p>
          </div>
        )}
      </section>

    </div>
  );
}