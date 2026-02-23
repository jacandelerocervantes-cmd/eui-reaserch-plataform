"use client";

import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Plus, Video, Clock, MapPin, Sparkles 
} from "lucide-react";

export default function AgendaUnificada() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return null;

  const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  const days = ["Lun 23", "Mar 24", "Mié 25", "Jue 26", "Vie 27"];

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* HEADER DE AGENDA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "900", margin: 0 }}>Agenda Académica</h1>
          <p style={{ color: "#64748b", fontWeight: "500" }}>Febrero 2026</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", backgroundColor: "white", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <button style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer" }}><ChevronLeft size={18} /></button>
            <div style={{ padding: "8px 16px", borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", fontWeight: "700", fontSize: "0.9rem" }}>Esta Semana</div>
            <button style={{ padding: "8px 12px", border: "none", background: "none", cursor: "pointer" }}><ChevronRight size={18} /></button>
          </div>
          <button style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <Plus size={18} /> Nuevo Evento
          </button>
        </div>
      </div>

      {/* REJILLA DE CALENDARIO */}
      <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
        {/* Cabecera de Días */}
        <div style={{ display: "grid", gridTemplateColumns: "100px repeat(5, 1fr)", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ padding: "20px" }} />
          {days.map(day => (
            <div key={day} style={{ padding: "20px", textAlign: "center", fontWeight: "800", color: "#1B396A", borderLeft: "1px solid #f1f5f9" }}>
              {day}
            </div>
          ))}
        </div>

        {/* Cuerpo de Horas */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }} className="custom-scrollbar">
          {hours.map(hour => (
            <div key={hour} style={{ display: "grid", gridTemplateColumns: "100px repeat(5, 1fr)", borderBottom: "1px solid #f8fafc", minHeight: "80px" }}>
              <div style={{ padding: "10px", textAlign: "right", fontSize: "0.75rem", color: "#94a3b8", fontWeight: "700" }}>{hour}</div>
              {[1, 2, 3, 4, 5].map(d => (
                <div key={d} style={{ borderLeft: "1px solid #f1f5f9", position: "relative", padding: "4px" }}>
                  {/* Ejemplo de Evento: Solo lunes a las 10 */}
                  {hour === "10:00" && d === 1 && (
                    <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "8px", position: "absolute", top: "4px", left: "4px", right: "4px", bottom: "4px", zIndex: 5, cursor: "pointer" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#1B396A", marginBottom: "2px" }}>DOCENCIA</div>
                      <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#1e3a8a" }}>Redes de Computadoras</div>
                      <div style={{ fontSize: "0.7rem", color: "#3b82f6", display: "flex", alignItems: "center", gap: "4px" }}><MapPin size={10} /> Edificio K-4</div>
                    </div>
                  )}
                  {/* Ejemplo de Evento: Investigación Miércoles */}
                  {hour === "12:00" && d === 3 && (
                    <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "8px", padding: "8px", position: "absolute", top: "4px", left: "4px", right: "4px", bottom: "-60px", zIndex: 10, cursor: "pointer" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#b45309", marginBottom: "2px" }}>INVESTIGACIÓN</div>
                      <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#92400e" }}>Revisión de Bibliografía AI</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}