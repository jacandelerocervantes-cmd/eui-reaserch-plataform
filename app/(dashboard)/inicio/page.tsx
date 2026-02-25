"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, Mail, Calendar, Clock, CheckSquare, 
  ArrowRight, Plus, Users, Video, Bell, 
  ChevronRight, Bookmark, FileText, Loader2
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Inicializamos Supabase con las variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- COMPONENTE DE BOTÓN PREMIUM ---
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
  const [loading, setLoading] = useState(true);
  
  // Estado centralizado para el dashboard
  const [dashboardData, setDashboardData] = useState({
    emails: [] as any[],
    agenda: [] as any[], 
    tasks: [] as any[]  
  });

  useEffect(() => {
    setIsMounted(true);
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Invocamos 'sync-correo' que es la que SÍ tienes en tus Edge Functions
      const { data, error } = await supabase.functions.invoke('sync-correo', {
        body: { action: 'obtenerCorreos' }
      });
      
      if (error) throw error;
      
      if (data && data.success) {
        setDashboardData(prev => ({
          ...prev,
          emails: data.data || [] // Usamos data.data porque el Router encapsula la respuesta
        }));
      }
    } catch (error) {
      console.error("Error cargando datos del Centro de Mando:", error);
    } finally {
      setLoading(false);
    }
  };

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
        
        {/* COLUMNA 1: EL RADAR (Correos dinámicos conectados a sync-correo) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <h3 style={{ color: "#1B396A", fontSize: "1rem", fontWeight: "800", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Mail size={18} color="#ef4444" /> Bandeja Prioritaria
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: "150px" }}>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#94a3b8" }}>
                  <Loader2 size={24} className="animate-spin" />
                </div>
              ) : dashboardData.emails.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", fontSize: "0.85rem", marginTop: "20px" }}>Bandeja al día ✨</div>
              ) : (
                dashboardData.emails.map((mail: any, i: number) => (
                  <div key={i} style={{ padding: "12px", borderRadius: "12px", backgroundColor: "#f8fafc", cursor: "pointer" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mail.from}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mail.subject}</div>
                  </div>
                ))
              )}
            </div>
            
            <button 
              onClick={() => window.location.href = "/inicio/correo"}
              style={{ width: "100%", marginTop: "16px", padding: "10px", color: "#ef4444", fontSize: "0.85rem", fontWeight: "700", border: "none", background: "none", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "4px" }}
            >
              Ver todos los correos <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* COLUMNA 2: TIMELINE MAESTRO (Agenda - Estático hasta crear función) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ color: "#1B396A", fontSize: "1.3rem", fontWeight: "900", margin: 0 }}>Agenda de Hoy</h2>
              <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#64748b" }}>
                {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative", minHeight: "200px" }}>
              <div style={{ position: "absolute", left: "7px", top: "10px", bottom: "10px", width: "2px", backgroundColor: "#f1f5f9" }} />
              
              {dashboardData.agenda.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", fontSize: "0.9rem", marginTop: "40px" }}>Sincroniza tu calendario en la sección de Agenda.</div>
              ) : (
                dashboardData.agenda.map((item: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "20px", alignItems: "flex-start", position: "relative" }}>
                    {/* El círculo ahora usa el color real del evento */}
                    <div style={{ 
                      width: "16px", height: "16px", borderRadius: "50%", 
                      backgroundColor: "white", border: `4px solid ${item.color || '#3b82f6'}`, 
                      zIndex: 1, marginTop: "4px" 
                    }} />
                    <div style={{ flex: 1 }}>
                      {/* El texto de la hora también usa el color de la categoría */}
                      <div style={{ fontSize: "0.75rem", fontWeight: "800", color: item.color || '#3b82f6', textTransform: "uppercase" }}>
                        {item.time} — {item.type || item.categoria}
                      </div>
                      <div style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b" }}>{item.task || item.titulo}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUMNA 3: INTELIGENCIA (Insights & Tareas - Estático hasta crear función) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
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

          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
            <h3 style={{ color: "#1B396A", fontSize: "1rem", fontWeight: "800", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckSquare size={18} color="#f59e0b" /> Lista de Tareas
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: "100px" }}>
              {dashboardData.tasks.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", fontSize: "0.85rem", marginTop: "10px" }}>Sincroniza tus tareas en la sección de Tareas.</div>
              ) : (
                dashboardData.tasks.map((task: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="checkbox" style={{ width: "18px", height: "18px", accentColor: "#1B396A" }} />
                    <span style={{ fontSize: "0.9rem", color: "#475569", fontWeight: "500" }}>{task.title || task}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}