"use client";

import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, Clock, Video, User, 
  CheckCircle2, XCircle, Plus, Filter, 
  Settings2, ExternalLink, Mail,
  Bookmark
} from "lucide-react";

// --- BOTÓN PREMIUM REUTILIZABLE ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary" }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const style = variant === "primary" 
    ? { bg: "#1B396A", text: "white" } 
    : { bg: "white", text: "#1B396A", border: "#e2e8f0" };

  return (
    <button
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: isHovered ? "10px" : "0px",
        backgroundColor: isHovered && variant === "primary" ? "#132a50" : style.bg, 
        color: style.text, border: style.border ? `1px solid ${style.border}` : "none",
        padding: "0 16px", height: "42px", borderRadius: "12px", fontWeight: "700",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", cursor: "pointer", overflow: "hidden"
      }}
    >
      <Icon size={18} />
      <span style={{ maxWidth: isHovered ? "200px" : "0px", opacity: isHovered ? 1 : 0, transition: "all 0.3s", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </button>
  );
};

export default function GestionCitas() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [activeTab, setActiveTab] = useState('proximas');

  const citas = [
    { id: 1, name: "Juan Pérez", type: "Asesoría Tesis", time: "10:00 AM", date: "Hoy", status: "confirmada", email: "juan.p@tecnm.mx" },
    { id: 2, name: "Equipo 3 - Redes", type: "Duda Proyecto", time: "12:30 PM", date: "Hoy", status: "pendiente", email: "team3@tecnm.mx" },
    { id: 3, name: "Dra. Elena Ramos", type: "Co-autoría Paper", time: "04:00 PM", date: "Mañana", status: "confirmada", email: "e.ramos@investigacion.com" }
  ];

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {/* HEADER DE SECCIÓN */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.5rem", fontWeight: "950", margin: 0 }}>Gestión de Citas</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Controla tus asesorías y reuniones institucionales.</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={Settings2} label="Configurar Horarios" variant="secondary" />
          <ExpandingButton icon={Plus} label="Nueva Cita Manual" variant="primary" />
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "32px" }}>
        
        {/* COLUMNA IZQUIERDA: LISTADO DE CITAS */}
        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9" }}>
            <button 
              onClick={() => setActiveTab('proximas')}
              style={{ flex: 1, padding: "20px", border: "none", background: activeTab === 'proximas' ? "white" : "#f8fafc", color: activeTab === 'proximas' ? "#1B396A" : "#64748b", fontWeight: "800", cursor: "pointer", borderBottom: activeTab === 'proximas' ? "3px solid #1B396A" : "none" }}
            >
              Próximas
            </button>
            <button 
              onClick={() => setActiveTab('historial')}
              style={{ flex: 1, padding: "20px", border: "none", background: activeTab === 'historial' ? "white" : "#f8fafc", color: activeTab === 'historial' ? "#1B396A" : "#64748b", fontWeight: "800", cursor: "pointer", borderBottom: activeTab === 'historial' ? "3px solid #1B396A" : "none" }}
            >
              Historial
            </button>
          </div>

          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {citas.map(cita => (
              <div key={cita.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px", borderRadius: "16px", border: "1px solid #f1f5f9", transition: "all 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = "#1B396A"}>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#1B396A" }}>
                    <User size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: "800", color: "#1B396A" }}>{cita.name}</div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Bookmark size={14} /> {cita.type}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: "800", color: "#1e293b" }}>{cita.time}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{cita.date}</div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  {cita.status === 'pendiente' ? (
                    <>
                      <button style={{ padding: "8px 12px", borderRadius: "10px", backgroundColor: "#ecfdf5", color: "#10b981", border: "none", fontWeight: "700", cursor: "pointer" }}>Aceptar</button>
                      <button style={{ padding: "8px 12px", borderRadius: "10px", backgroundColor: "#fef2f2", color: "#ef4444", border: "none", fontWeight: "700", cursor: "pointer" }}>Rechazar</button>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer" }} title="Enviar Correo"><Mail size={18} color="#64748b" /></button>
                      <button style={{ padding: "10px 16px", borderRadius: "10px", backgroundColor: "#1B396A", color: "white", border: "none", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Video size={18} /> Meet
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COLUMNA DERECHA: MINI CALENDARIO Y AJUSTES RÁPIDOS */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Disponibilidad */}
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#1B396A", fontSize: "1.1rem", fontWeight: "800" }}>Disponibilidad</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: "600" }}>Modo Automático</span>
                <div style={{ width: "40px", height: "20px", backgroundColor: "#1B396A", borderRadius: "20px", position: "relative", cursor: "pointer" }}>
                  <div style={{ width: "16px", height: "16px", backgroundColor: "white", borderRadius: "50%", position: "absolute", right: "2px", top: "2px" }} />
                </div>
              </div>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>Cuando está activo, los alumnos pueden agendar en tus huecos libres de Google Calendar.</p>
            </div>
          </div>

          {/* Estadísticas de Asesoría */}
          <div style={{ backgroundColor: "#1B396A", borderRadius: "24px", padding: "24px", color: "white" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: "700", opacity: 0.9 }}>Resumen Semanal</h3>
            <div style={{ fontSize: "2rem", fontWeight: "900" }}>14</div>
            <p style={{ fontSize: "0.85rem", opacity: 0.8, margin: 0 }}>Horas de asesoría brindadas esta semana.</p>
            <div style={{ marginTop: "16px", height: "4px", width: "100%", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "2px" }}>
              <div style={{ width: "70%", height: "100%", backgroundColor: "#f59e0b", borderRadius: "2px" }} />
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}