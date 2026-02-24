"use client";

import React, { useState, useEffect } from "react";
import { 
  Globe, TrendingUp, Award, Share2, Zap, 
  Sparkles, ArrowUpRight, BarChart3, Users,
  Loader2, Activity
} from "lucide-react";

export default function RadarAcademico() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Estados para Animaciones y Datos
  const [citations, setCitations] = useState(0);
  const targetCitations = 1240;
  const [isScanning, setIsScanning] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    // Simular carga de API (Scopus / Scholar / Supabase)
    setTimeout(() => {
      setLoading(false);
      animateCounter();
    }, 800);
  }, []);

  // Animación del contador de citas
  const animateCounter = () => {
    let current = 0;
    const increment = Math.ceil(targetCitations / 50);
    const timer = setInterval(() => {
      current += increment;
      if (current >= targetCitations) {
        setCitations(targetCitations);
        clearInterval(timer);
      } else {
        setCitations(current);
      }
    }, 30);
  };

  const handleScanTrends = () => {
    setIsScanning(true);
    setAiReport(null);
    setTimeout(() => {
      setIsScanning(false);
      setAiReport("🚨 Alerta Temprana: Se ha detectado un pico inusual del 300% en publicaciones sobre 'TinyML aplicado a Agricultura' en los últimos 5 días en la base de datos de IEEE. Te sugerimos orientar tu próximo paper en esta dirección para asegurar publicación rápida.");
    }, 2500);
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>
      
      {/* HEADER MUNDO DORADO */}
      <header style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
              Mundo Dorado
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#10b981", fontSize: "0.75rem", fontWeight: "800", backgroundColor: "#ecfdf5", padding: "4px 8px", borderRadius: "6px" }}>
               <Activity size={12} /> Sync: Scholar & Scopus
            </span>
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.4rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Radar Académico</h1>
          <p style={{ color: "#64748b", fontSize: "1.05rem", fontWeight: "500", marginTop: "4px" }}>Análisis de impacto global, métricas H y tendencias en tu área de investigación.</p>
        </div>
        <button style={{ backgroundColor: "white", color: "#1B396A", border: "1px solid #e2e8f0", padding: "12px 20px", borderRadius: "14px", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
          <Share2 size={18} /> Compartir Perfil
        </button>
      </header>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} className="animate-spin" /> Conectando con bases de datos globales...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "32px" }}>
          
          {/* COLUMNA IZQUIERDA: MÉTRICAS DUSTRAS Y CITAS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            
            {/* Hero Card de Impacto */}
            <div style={{ backgroundColor: "#1B396A", borderRadius: "32px", padding: "40px", color: "white", position: "relative", overflow: "hidden", boxShadow: "0 10px 25px rgba(27, 57, 106, 0.2)" }}>
              <Globe size={150} color="rgba(255,255,255,0.05)" style={{ position: "absolute", right: "-30px", top: "-30px" }} />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", position: "relative", zIndex: 1 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                    <TrendingUp color="#10b981" size={24} />
                    <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800", opacity: 0.9 }}>Citas Totales</h2>
                  </div>
                  <div style={{ fontSize: "5rem", fontWeight: "900", marginBottom: "10px", lineHeight: "1", letterSpacing: "-0.03em" }}>
                    {citations.toLocaleString()}
                  </div>
                  <p style={{ opacity: 0.7, fontSize: "0.9rem", margin: 0 }}>+45 esta semana (Google Scholar)</p>
                </div>

                <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "30px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <Award color="#f59e0b" size={20} />
                    <span style={{ fontSize: "1rem", fontWeight: "800", opacity: 0.9 }}>Índice H</span>
                  </div>
                  <div style={{ fontSize: "3rem", fontWeight: "900", lineHeight: "1" }}>18</div>
                  <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <BarChart3 color="#38bdf8" size={20} />
                    <span style={{ fontSize: "1rem", fontWeight: "800", opacity: 0.9 }}>Índice i10</span>
                  </div>
                  <div style={{ fontSize: "3rem", fontWeight: "900", lineHeight: "1" }}>24</div>
                </div>
              </div>
            </div>

            {/* Muro de Impacto (Papers recientes que te citaron) */}
            <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
              <h3 style={{ margin: "0 0 24px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "900", display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={20} /> Investigadores que te han citado recientemente
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {[
                  { author: "Wang, L.", from: "MIT", paper: "Next-Gen Sensor Networks", date: "Hace 2 días" },
                  { author: "García, R.", from: "UNAM", paper: "IoT en Zonas Áridas", date: "Hace 1 semana" },
                  { author: "Dubois, M.", from: "Sorbonne", paper: "Ethical AI Models", date: "Hace 2 semanas" }
                ].map((cite, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: i !== 2 ? "1px solid #f1f5f9" : "none" }}>
                    <div>
                      <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "1rem", display: "flex", alignItems: "center", gap: "6px" }}>
                        {cite.author} <span style={{ backgroundColor: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: "6px", fontSize: "0.7rem" }}>{cite.from}</span>
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>En: <i>{cite.paper}</i></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>{cite.date}</span>
                      <button style={{ color: "#3b82f6", background: "none", border: "none", fontSize: "0.8rem", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>Leer <ArrowUpRight size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* COLUMNA DERECHA: IA Y TENDENCIAS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* AI Scanner */}
            <div style={{ backgroundColor: "#fffbeb", borderRadius: "24px", border: "1px solid #fde68a", padding: "32px", position: "relative", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <Sparkles size={24} color="#d97706" />
                <h3 style={{ margin: 0, color: "#92400e", fontSize: "1.2rem", fontWeight: "900" }}>Certeza AI Radar</h3>
              </div>
              <p style={{ color: "#b45309", fontSize: "0.95rem", lineHeight: "1.5", marginBottom: "24px", fontWeight: "500" }}>
                Escanea publicaciones de la última semana en Q1/Q2 para descubrir hacia dónde se mueve tu campo.
              </p>
              
              {aiReport ? (
                <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "16px", fontSize: "0.9rem", color: "#475569", lineHeight: "1.6", border: "1px solid #fde68a", animation: "slideUp 0.4s ease-out" }}>
                  {aiReport}
                </div>
              ) : (
                <button 
                  onClick={handleScanTrends}
                  disabled={isScanning}
                  style={{ width: "100%", backgroundColor: "#d97706", color: "white", padding: "14px", borderRadius: "14px", fontWeight: "800", border: "none", cursor: isScanning ? "wait" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", transition: "all 0.2s", boxShadow: "0 4px 10px rgba(217, 119, 6, 0.3)" }}
                  onMouseEnter={e => {if(!isScanning) e.currentTarget.style.backgroundColor = "#b45309"}}
                  onMouseLeave={e => {if(!isScanning) e.currentTarget.style.backgroundColor = "#d97706"}}
                >
                  {isScanning ? <><Loader2 size={18} className="animate-spin" /> Escaneando Scopus...</> : "Escanear Tendencias Globales"}
                </button>
              )}
            </div>

            {/* Hot Topics */}
            <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
              <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.1rem", display: "flex", gap: "8px", fontWeight: "800" }}>
                <Zap size={20} color="#f59e0b" /> Hot Topics (Tu Red)
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "20px" }}>Keywords más frecuentes en los papers que te citan.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {[
                  { tag: "Edge Computing", w: "1.2rem", bg: "#eff6ff", color: "#3b82f6" },
                  { tag: "IoT Security", w: "1.4rem", bg: "#fef2f2", color: "#ef4444" },
                  { tag: "TinyML", w: "1.6rem", bg: "#ecfdf5", color: "#10b981" },
                  { tag: "Genetic Algorithms", w: "1rem", bg: "#f3f0ff", color: "#7c3aed" },
                  { tag: "Precision Ag", w: "1.1rem", bg: "#fffbeb", color: "#d97706" }
                ].map((item, i) => (
                  <span key={i} style={{ backgroundColor: item.bg, color: item.color, padding: "8px 16px", borderRadius: "12px", fontSize: item.w, fontWeight: "900", cursor: "pointer", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                    #{item.tag}
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}