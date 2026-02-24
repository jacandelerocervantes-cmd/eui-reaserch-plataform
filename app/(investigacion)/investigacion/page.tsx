"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Sparkles, TrendingUp, BookOpen, Users, 
  ChevronRight, ArrowUpRight, Clock, Star,
  Award, FileText, Share2, Activity, BellRing,
  CheckCircle2, Plus, Loader2
} from "lucide-react";

// --- SUB-COMPONENTE: NÚMERO ANIMADO ---
const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1000; // 1 segundo
    const increment = value / (duration / 16); // 60fps
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.ceil(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue.toLocaleString()}</>;
};

// --- MINI COMPONENTE DE MÉTRICA ---
const MetricCard = ({ label, value, icon: Icon, color, onClick }: any) => (
  <div 
    onClick={onClick}
    style={{ backgroundColor: "white", padding: "24px", borderRadius: "24px", border: "1px solid #e2e8f0", flex: 1, display: "flex", alignItems: "center", gap: "20px", cursor: onClick ? "pointer" : "default", transition: "all 0.3s", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}
    onMouseEnter={e => { if(onClick) e.currentTarget.style.transform = "translateY(-4px)"; if(onClick) e.currentTarget.style.boxShadow = `0 10px 20px -5px ${color}20` }}
    onMouseLeave={e => { if(onClick) e.currentTarget.style.transform = "translateY(0)"; if(onClick) e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.02)" }}
  >
    <div style={{ backgroundColor: `${color}15`, color: color, padding: "16px", borderRadius: "16px" }}>
      <Icon size={28} />
    </div>
    <div>
      <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
      <p style={{ margin: "4px 0 0 0", fontSize: "1.8rem", fontWeight: "900", color: "#1B396A", lineHeight: 1 }}>
        <AnimatedNumber value={value} />
      </p>
    </div>
  </div>
);

export default function EscritorioInvestigacion() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    // Simular carga de base de datos para el Dashboard
    setTimeout(() => {
      setAlertas([
        { id: 1, type: "cita", title: "¡Nueva cita detectada!", desc: "Tu paper sobre 'IoT Agrícola' fue citado en Nature Journal.", time: "Hace 2 horas", color: "#10b981", icon: Share2, action: "Ver Radar" },
        { id: 2, type: "tesis", title: "Revisión pendiente", desc: "El tesista Kevin Soto subió el Capítulo 2.", time: "Ayer", color: "#f59e0b", icon: FileText, action: "Revisar Tesis" },
        { id: 3, type: "fondo", title: "Comprobación próxima", desc: "Te quedan 15 días para comprobar $24,000 del Fondo CONAHCYT.", time: "Hace 2 días", color: "#ef4444", icon: AlertCircle, action: "Ir a Finanzas" }
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const handleAlertAction = (type: string, id: number) => {
    // Fricción Cero: Desaparece la alerta optimistamente y luego navega
    setAlertas(prev => prev.filter(a => a.id !== id));
    
    if(type === 'cita') router.push('/investigacion/radar');
    if(type === 'tesis') router.push('/investigacion/tesis');
    if(type === 'fondo') router.push('/investigacion/financiamiento');
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px", animation: "fadeIn 0.5s ease-out" }}>
      
      {/* 1. BIENVENIDA CON EL ESTILO DORADO ACADÉMICO */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
              Mundo Dorado
            </span>
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#94a3b8", fontSize: "0.75rem", fontWeight: "700" }}>
                <Loader2 size={12} className="animate-spin" /> Sincronizando...
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#10b981", fontSize: "0.75rem", fontWeight: "800", backgroundColor: "#ecfdf5", padding: "4px 8px", borderRadius: "6px" }}>
                <CheckCircle2 size={12} /> Red Global Conectada
              </span>
            )}
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>
            Mi Escritorio
          </h1>
          <p style={{ color: "#d97706", fontSize: "1.1rem", fontWeight: "700", marginTop: "4px", display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#fffbeb", padding: "8px 16px", borderRadius: "12px", width: "fit-content" }}>
            <Sparkles size={18} /> ¡Tu Índice H acaba de subir a 14! Excelente trabajo.
          </p>
        </div>
        
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={() => router.push('/investigacion/config')} style={{ backgroundColor: "white", border: "1px solid #e2e8f0", color: "#1B396A", padding: "14px 24px", borderRadius: "14px", fontWeight: "800", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
            Mi Perfil
          </button>
          <button onClick={() => router.push('/investigacion/canvas')} style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "14px 24px", borderRadius: "14px", fontWeight: "900", cursor: "pointer", boxShadow: "0 10px 25px -5px rgba(27, 57, 106, 0.3)", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
            <Plus size={20} /> Nuevo Manuscrito
          </button>
        </div>
      </header>

      {/* 2. MÉTRICAS DE IMPACTO INTERACTIVAS */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
        <MetricCard label="Índice H" value={14} icon={TrendingUp} color="#f59e0b" onClick={() => router.push('/investigacion/radar')} />
        <MetricCard label="Citas Totales" value={842} icon={Award} color="#3b82f6" onClick={() => router.push('/investigacion/radar')} />
        <MetricCard label="Publicaciones" value={28} icon={BookOpen} color="#10b981" onClick={() => router.push('/investigacion/literatura')} />
        <MetricCard label="Tesistas Activos" value={5} icon={Users} color="#8b5cf6" onClick={() => router.push('/investigacion/tesis')} />
      </div>

      {/* 3. GRID DE ACTIVIDAD Y PROYECTOS */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "32px", alignItems: "start" }}>
        
        {/* Proyectos Recientes */}
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
             <h2 style={{ fontSize: "1.4rem", color: "#1B396A", fontWeight: "900", margin: 0 }}>Proyectos Activos</h2>
             <button onClick={() => router.push('/investigacion/proyectos')} style={{ background: "none", border: "none", color: "#3b82f6", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.9rem" }}>Ver todos <ArrowRight size={16}/></button>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { id: 1, t: "Algoritmos Genéticos para Agricultura", p: "75%", c: "#f59e0b", due: "Próx. Hito: 15 Abr" },
              { id: 2, t: "IoT en Redes Locales de Yucatán", p: "40%", c: "#3b82f6", due: "Próx. Hito: 20 May" }
            ].map((proj) => (
              <div 
                key={proj.id} 
                onClick={() => router.push('/investigacion/proyectos')}
                style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = proj.c; e.currentTarget.style.transform = "translateX(4px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.transform = "translateX(0)"; }}
              >
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 12px 0", color: "#1B396A", fontSize: "1.1rem", fontWeight: "800" }}>{proj.t}</h4>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "250px", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: proj.p, height: "100%", backgroundColor: proj.c, transition: "width 1s ease-out" }} />
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "700" }}>{proj.p} Avance</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                   <span style={{ fontSize: "0.75rem", backgroundColor: "#f8fafc", color: "#64748b", padding: "4px 10px", borderRadius: "8px", fontWeight: "700" }}>{proj.due}</span>
                   <div style={{ backgroundColor: "#f1f5f9", padding: "8px", borderRadius: "50%", color: "#94a3b8" }}><ArrowUpRight size={18} /></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Notificaciones Académicas Accionables */}
        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 10px 25px -5px rgba(27, 57, 106, 0.05)" }}>
          <h2 style={{ fontSize: "1.2rem", color: "#1B396A", fontWeight: "900", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" }}>
            <BellRing size={20} color="#ef4444" /> Bandeja de Acción
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {loading ? (
               <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><Loader2 className="animate-spin text-slate-300" size={32}/></div>
            ) : alertas.length === 0 ? (
               <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0", fontWeight: "600", fontSize: "0.9rem" }}>Estás al día. No hay pendientes.</div>
            ) : (
              alertas.map((alerta) => {
                const IconComponent = alerta.icon;
                return (
                  <div key={alerta.id} style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "16px", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                      <div style={{ width: "45px", height: "45px", borderRadius: "14px", backgroundColor: `${alerta.color}15`, color: alerta.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <IconComponent size={22}/>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: "0 0 4px 0", fontSize: "0.95rem", fontWeight: "800", color: "#1e293b" }}>{alerta.title}</p>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: "1.4" }}>{alerta.desc}</p>
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: "61px" }}>
                       <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>{alerta.time}</span>
                       <button 
                         onClick={() => handleAlertAction(alerta.type, alerta.id)}
                         style={{ backgroundColor: "white", color: alerta.color, border: `1px solid ${alerta.color}40`, padding: "6px 12px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "800", cursor: "pointer", transition: "all 0.2s" }}
                         onMouseEnter={e => e.currentTarget.style.backgroundColor = `${alerta.color}10`}
                         onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}
                       >
                         {alerta.action}
                       </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

      </div>
    </div>
  );
}