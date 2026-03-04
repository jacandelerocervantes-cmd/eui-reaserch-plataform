"use client";

import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, Clock, Video, User, 
  CheckCircle2, XCircle, Plus, Filter, 
  Settings2, ExternalLink, Mail, MapPin,
  Bookmark, Loader2, Zap, ShieldCheck
} from "lucide-react";
import { supabase } from "@/lib/supabase"; // Importación arquitectónica correcta

interface EnrichedAppointment {
  id: string;
  name: string;
  type: string;
  date: string;
  time: string;
  email: string;
  meetLink?: string;
  location?: string;
  pilar?: string;
  modalidad?: "Virtual" | "Física";
  color?: string;
  accion_sugerida?: string;
}

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

export default function GestionCitasIEO() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('proximas');
  const [citas, setCitas] = useState<EnrichedAppointment[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchCitas();
  }, []);

  const fetchCitas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('sync-appointments', {
        body: { action: 'obtenerCitas' }
      });
      if (error) throw error;
      if (data?.success) {
        setCitas(data.data);
        if (data.aiSummary) setAiSummary(data.aiSummary);
      }
    } catch (err) {
      console.error("Error cargando citas IEO:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.5rem", fontWeight: "950", margin: 0 }}>Gestión de Citas</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>
            Control IEO de asesorías físicas y virtuales.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={Settings2} label="Configurar Horarios" variant="secondary" />
          <ExpandingButton icon={Plus} label="Nueva Cita Manual" variant="primary" />
        </div>
      </header>

      {/* BRIEFING IEO */}
      {!loading && aiSummary && (
        <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px 24px", display: "flex", gap: "16px", alignItems: "center" }}>
          <ShieldCheck size={28} color="#10b981" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: "800", color: "#10b981", textTransform: "uppercase", marginBottom: "4px" }}>Briefing de Citas IEO</div>
            <div style={{ fontSize: "1rem", color: "#334155", fontWeight: "600" }}>{aiSummary}</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "32px" }}>
        
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

          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", minHeight: "300px" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><Loader2 className="animate-spin" size={40} color="#1B396A" /></div>
            ) : citas.length === 0 ? (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px", fontWeight: "600" }}>No hay citas programadas.</div>
            ) : (
              citas.map(cita => (
                <div key={cita.id} style={{ 
                  display: "flex", alignItems: "center", justifyContent: "space-between", 
                  padding: "20px", borderRadius: "16px", border: "1px solid #f1f5f9", 
                  borderLeft: cita.color ? `4px solid ${cita.color}` : "1px solid #f1f5f9",
                  transition: "all 0.2s" 
                }}>
                  <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: `${cita.color || '#1B396A'}15`, display: "flex", alignItems: "center", justifyContent: "center", color: cita.color || "#1B396A", marginTop: "4px" }}>
                      {cita.modalidad === "Física" ? <MapPin size={24} /> : <Video size={24} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: "900", color: "#1e293b", fontSize: "1.05rem" }}>{cita.name}</div>
                      
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: "800", color: cita.color, backgroundColor: `${cita.color}15`, padding: "2px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Bookmark size={12} /> {cita.pilar}
                        </div>
                        {cita.modalidad && (
                          <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b", backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            {cita.modalidad === "Física" ? <MapPin size={12} /> : <Video size={12} />} {cita.modalidad}
                          </div>
                        )}
                      </div>

                      {cita.accion_sugerida && (
                        <div style={{ fontSize: "0.8rem", color: "#8b5cf6", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px", marginTop: "8px" }}>
                          <Zap size={14} /> {cita.accion_sugerida}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ fontWeight: "900", color: "#1B396A", fontSize: "1.1rem" }}>{cita.time}</div>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600" }}>{cita.date}</div>
                    </div>
                    
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button 
                        onClick={() => window.location.href = `mailto:${cita.email}`}
                        style={{ padding: "8px 12px", borderRadius: "8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", cursor: "pointer" }} 
                        title="Enviar Correo"
                      >
                        <Mail size={16} color="#64748b" />
                      </button>
                      {cita.meetLink && (
                        <button 
                          onClick={() => window.open(cita.meetLink, '_blank')}
                          style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: "#1B396A", color: "white", border: "none", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <Video size={16} /> Entrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Panel lateral intacto */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#1B396A", fontSize: "1.1rem", fontWeight: "800" }}>Disponibilidad IEO</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: "600" }}>Aprobación Automática</span>
                <div style={{ width: "40px", height: "20px", backgroundColor: "#10b981", borderRadius: "20px", position: "relative", cursor: "pointer" }}>
                  <div style={{ width: "16px", height: "16px", backgroundColor: "white", borderRadius: "50%", position: "absolute", right: "2px", top: "2px" }} />
                </div>
              </div>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
                El portal de alumnos permitirá agendar citas físicas o virtuales en huecos validados por la IA.
              </p>
            </div>
          </div>

          <div style={{ backgroundColor: "#1B396A", borderRadius: "24px", padding: "24px", color: "white" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: "700", opacity: 0.9 }}>Citas Activas</h3>
            <div style={{ fontSize: "2.5rem", fontWeight: "900" }}>{citas.length}</div>
            <p style={{ fontSize: "0.85rem", opacity: 0.8, margin: 0 }}>En radar operativo.</p>
          </div>
        </aside>

      </div>
    </div>
  );
}