"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, Clock, MapPin, Sparkles, Loader2, Zap, AlertTriangle
} from "lucide-react";
import { supabase } from "@/lib/supabase"; // Unificado con tu arquitectura

// Tipado estricto IEO
interface AgendaEvent {
  id: string;
  titulo: string;
  diaSemana: number; // 1 (Lun) a 5 (Vie)
  horaInicio: string; // ej: "08:00"
  horaFin?: string;
  ubicacion: string;
  pilar: "DOCENCIA" | "INVESTIGACION" | "LABORATORIO" | "CAMPO" | "INSTITUCIONAL";
  color: string;
  esConflicto?: boolean; // Detectado por la IA
}

interface IA_Summary {
  hayConflictos: boolean;
  mensaje: string;
}

export default function AgendaUnificadaIEO() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [aiSummary, setAiSummary] = useState<IA_Summary | null>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchCalendar();
  }, []);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('sync-calendar');
      
      if (error) throw error;
      
      if (data?.success) {
        setEvents(data.data);
        setAiSummary(data.aiSummary); // El resumen que nos dará Gemini
      }
    } catch (err) {
      console.error("Error cargando calendario IEO:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  const days = [
    { label: "Lun", code: 1 },
    { label: "Mar", code: 2 },
    { label: "Mié", code: 3 },
    { label: "Jue", code: 4 },
    { label: "Vie", code: 5 }
  ];

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* CABECERA Y CONTROLES */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "950", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            Agenda Operativa
          </h1>
          <p style={{ color: "#64748b", fontWeight: "600", margin: "4px 0 0 0" }}>Sincronización bidireccional de compromisos académicos</p>
        </div>
        
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button 
            onClick={fetchCalendar}
            disabled={loading}
            style={{ padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", backgroundColor: "white", cursor: "pointer", color: "#1B396A" }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Clock size={18} />}
          </button>
          <button style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <Plus size={18} /> Nuevo Compromiso
          </button>
        </div>
      </div>

      {/* BRIEFING DE INTELIGENCIA (IEO) */}
      {!loading && aiSummary && (
        <div style={{ 
          backgroundColor: aiSummary.hayConflictos ? "#fef2f2" : "#f8fafc", 
          border: `1px solid ${aiSummary.hayConflictos ? "#fecaca" : "#e2e8f0"}`,
          borderRadius: "16px", padding: "16px 24px", display: "flex", alignItems: "center", gap: "16px" 
        }}>
          {aiSummary.hayConflictos ? (
            <AlertTriangle size={24} color="#ef4444" />
          ) : (
            <Sparkles size={24} color="#8b5cf6" />
          )}
          <div>
            <h4 style={{ margin: 0, color: aiSummary.hayConflictos ? "#b91c1c" : "#1B396A", fontWeight: "800", fontSize: "1rem" }}>
              Briefing de Triage IEO
            </h4>
            <p style={{ margin: "4px 0 0 0", color: "#475569", fontSize: "0.9rem", fontWeight: "500" }}>
              {aiSummary.mensaje}
            </p>
          </div>
          {aiSummary.hayConflictos && (
            <button style={{ marginLeft: "auto", backgroundColor: "#ef4444", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
              Resolver Conflictos
            </button>
          )}
        </div>
      )}

      {/* CUADRÍCULA DE HORARIOS */}
      <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
        
        {/* Cabecera de Días */}
        <div style={{ display: "grid", gridTemplateColumns: "80px repeat(5, 1fr)", borderBottom: "1px solid #f1f5f9", backgroundColor: "#fcfcfd" }}>
          <div style={{ padding: "16px" }} />
          {days.map(day => (
            <div key={day.code} style={{ padding: "16px", textAlign: "center", fontWeight: "900", color: "#1B396A", borderLeft: "1px solid #f1f5f9" }}>
              {day.label}
            </div>
          ))}
        </div>

        {/* Cuerpo de Horas */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative", maxHeight: "60vh" }} className="custom-scrollbar">
          {loading ? (
             <div style={{ padding: "60px", display: "flex", justifyContent: "center" }}>
               <Loader2 className="animate-spin" color="#1B396A" size={40} />
             </div>
          ) : (
            hours.map(hour => (
              <div key={hour} style={{ display: "grid", gridTemplateColumns: "80px repeat(5, 1fr)", borderBottom: "1px solid #f8fafc", minHeight: "110px" }}>
                <div style={{ padding: "10px", textAlign: "right", fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800" }}>{hour}</div>
                
                {days.map(day => {
                  const cellEvents = events.filter(e => e.diaSemana === day.code && e.horaInicio === hour);
                  
                  return (
                    <div key={`${day.code}-${hour}`} style={{ borderLeft: "1px solid #f1f5f9", padding: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {cellEvents.map(event => (
                        <div 
                          key={event.id}
                          style={{ 
                            backgroundColor: `${event.color}15`, 
                            borderLeft: `4px solid ${event.color}`, 
                            border: event.esConflicto ? "2px dashed #ef4444" : undefined,
                            borderRadius: "8px", padding: "10px", cursor: "pointer",
                            position: "relative"
                          }}
                        >
                          <div style={{ fontSize: "0.65rem", fontWeight: "900", color: event.color, display: "flex", alignItems: "center", gap: "4px" }}>
                            {event.pilar}
                            {event.esConflicto && <AlertTriangle size={10} color="#ef4444" />}
                          </div>
                          <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1e293b", margin: "4px 0", lineHeight: "1.2" }}>
                            {event.titulo}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                            <MapPin size={10} /> {event.ubicacion}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}