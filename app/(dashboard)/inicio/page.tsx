"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, Mail, Calendar, Clock, CheckSquare, 
  ArrowRight, Plus, Users, Video, Bell, 
  ChevronRight, Bookmark, FileText
} from "lucide-react";

// --- REUTILIZAMOS TU COMPONENTE DE BOTÓN PREMIUM ---
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
        backgroundColor: style.bg, color: style.text, border: style.border ? `1px solid ${style.border}` : "none",
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

export default function CentroDeMando() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {/* --- HEADER INTELIGENTE --- */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.5rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>
            Centro de Mando
          </h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={18} color="#8b5cf6" /> Hoy es un gran día para avanzar en la Unidad 3 y tu paper de IoT.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={Plus} label="Nueva Tarea" variant="secondary" />
          <ExpandingButton icon={Video} label="Iniciar Sesión Meet" variant="primary" />
        </div>
      </header>

      {/* --- GRID PRINCIPAL (3 COLUMNAS) --- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* COLUMNA 1: EL RADAR (Stats & Correo) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <h3 style={{ color: "#1B396A", fontSize: "1rem", fontWeight: "800", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Mail size={18} color="#ef4444" /> Bandeja Prioritaria
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { from: "Jefatura de Docencia", sub: "Acreditación 2026", time: "10 min" },
                { from: "María (Tesista)", sub: "Duda sobre Metodología", time: "1 hr" },
                { from: "IEEE Journal", sub: "Estado de Revisión", time: "3 hr" }
              ].map((mail, i) => (
                <div key={i} style={{ padding: "12px", borderRadius: "12px", backgroundColor: "#f8fafc", cursor: "pointer" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1e293b" }}>{mail.from}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{mail.sub}</div>
                </div>
              ))}
            </div>
            <button style={{ width: "100%", marginTop: "16px", padding: "10px", color: "#ef4444", fontSize: "0.85rem", fontWeight: "700", border: "none", background: "none", cursor: "pointer" }}>
              Ver todos en Gmail <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* COLUMNA 2: TIMELINE MAESTRO (Agenda) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ color: "#1B396A", fontSize: "1.3rem", fontWeight: "900", margin: 0 }}>Agenda de Hoy</h2>
              <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#64748b" }}>22 Feb, 2026</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
              {/* Línea vertical de fondo */}
              <div style={{ position: "absolute", left: "7px", top: "10px", bottom: "10px", width: "2px", backgroundColor: "#f1f5f9" }} />
              
              {[
                { time: "09:00", task: "Reunión de Academia", type: "Docencia", color: "#3b82f6" },
                { time: "11:00", task: "Clase: Redes de Computadoras", type: "Docencia", color: "#3b82f6" },
                { time: "13:00", task: "Almuerzo / Deep Work", type: "Personal", color: "#64748b" },
                { time: "15:00", task: "Asesoría: Proyecto Drones", type: "Investigación", color: "#f59e0b" },
                { time: "17:00", task: "Pruebas de Sensores", type: "Laboratorio", color: "#10b981" }
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "20px", alignItems: "flex-start", position: "relative" }}>
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "white", border: `4px solid ${item.color}`, zIndex: 1, marginTop: "4px" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: "800", color: item.color, textTransform: "uppercase" }}>{item.time} — {item.type}</div>
                    <div style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b" }}>{item.task}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMNA 3: INTELIGENCIA (Insights & Pendientes) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* AI Insight Card */}
          <div style={{ backgroundColor: "#f3f0ff", borderRadius: "24px", padding: "24px", border: "1px solid #e9e3ff" }}>
            <h3 style={{ color: "#7c3aed", fontSize: "1rem", fontWeight: "800", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={18} /> Sugerencia IA
            </h3>
            <p style={{ color: "#5b21b6", fontSize: "0.9rem", lineHeight: "1.5", margin: 0 }}>
              Detectamos que el <b>40% del grupo de Redes</b> no ha entregado la práctica. ¿Quieres enviar un recordatorio automático masivo?
            </p>
            <button style={{ marginTop: "16px", backgroundColor: "#7c3aed", color: "white", border: "none", padding: "10px 16px", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}>
              Enviar Recordatorio
            </button>
          </div>

          {/* Pendientes Rápidos */}
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
            <h3 style={{ color: "#1B396A", fontSize: "1rem", fontWeight: "800", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckSquare size={18} color="#f59e0b" /> Lista de Tareas
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {["Firmar actas de examen", "Subir PDF de convocatoria", "Revisar tesis de María"].map((task, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input type="checkbox" style={{ width: "18px", height: "18px", accentColor: "#1B396A" }} />
                  <span style={{ fontSize: "0.9rem", color: "#475569", fontWeight: "500" }}>{task}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}