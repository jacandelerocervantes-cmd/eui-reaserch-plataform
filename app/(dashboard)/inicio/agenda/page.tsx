"use client";

import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Plus, Video, Clock, MapPin, Sparkles, Loader2 
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AgendaUnificada() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
    fetchCalendar();
  }, []);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.functions.invoke('sync-calendar');
      if (data?.success) {
        setEvents(data.data);
      }
    } catch (err) {
      console.error("Error cargando calendario:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  // Mapeo de días para la lógica de la rejilla (1 = Lunes, 5 = Viernes)
  const days = [
    { label: "Lun", code: 1 },
    { label: "Mar", code: 2 },
    { label: "Mié", code: 3 },
    { label: "Jue", code: 4 },
    { label: "Vie", code: 5 }
  ];

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "950", margin: 0 }}>Agenda Académica</h1>
          <p style={{ color: "#64748b", fontWeight: "600" }}>Sincronizado con Google Calendar</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button 
            onClick={fetchCalendar}
            style={{ padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", backgroundColor: "white", cursor: "pointer" }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Clock size={18} />}
          </button>
          <button style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
            <Plus size={18} /> Nuevo Evento
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
        {/* Cabecera de Días */}
        <div style={{ display: "grid", gridTemplateColumns: "100px repeat(5, 1fr)", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ padding: "20px" }} />
          {days.map(day => (
            <div key={day.code} style={{ padding: "20px", textAlign: "center", fontWeight: "800", color: "#1B396A", borderLeft: "1px solid #f1f5f9" }}>
              {day.label}
            </div>
          ))}
        </div>

        {/* Cuerpo de Horas */}
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }} className="custom-scrollbar">
          {hours.map(hour => (
            <div key={hour} style={{ display: "grid", gridTemplateColumns: "100px repeat(5, 1fr)", borderBottom: "1px solid #f8fafc", minHeight: "100px" }}>
              <div style={{ padding: "10px", textAlign: "right", fontSize: "0.75rem", color: "#94a3b8", fontWeight: "700" }}>{hour}</div>
              
              {days.map(day => {
                // Filtramos eventos que coincidan con este día y esta hora exacta
                const cellEvents = events.filter(e => e.diaSemana === day.code && e.horaInicio === hour);
                
                return (
                  <div key={day.code} style={{ borderLeft: "1px solid #f1f5f9", position: "relative", padding: "4px" }}>
                    {cellEvents.map(event => (
                      <div 
                        key={event.id}
                        style={{ 
                          backgroundColor: `${event.color}15`, // Fondo claro del color de la categoría
                          borderLeft: `4px solid ${event.color}`, // Borde sólido de la categoría
                          borderRadius: "8px", padding: "8px", cursor: "pointer", marginBottom: "4px" 
                        }}
                      >
                        <div style={{ fontSize: "0.6rem", fontWeight: "900", color: event.color, textTransform: "uppercase" }}>
                          {event.categoria}
                        </div>
                        <div style={{ fontSize: "0.8rem", fontWeight: "800", color: "#1e293b" }}>{event.titulo}</div>
                        <div style={{ fontSize: "0.7rem", color: "#64748b" }}>{event.ubicacion}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}