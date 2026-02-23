"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, TrendingUp, BookOpen, Users, 
  ChevronRight, ArrowUpRight, Clock, Star,
  Award, FileText, Share2
} from "lucide-react";

// --- MINI COMPONENTE DE MÉTRICA ---
const MetricCard = ({ label, value, icon: Icon, color }: any) => (
  <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "24px", border: "1px solid #e2e8f0", flex: 1, display: "flex", alignItems: "center", gap: "20px" }}>
    <div style={{ backgroundColor: `${color}15`, color: color, padding: "12px", borderRadius: "14px" }}>
      <Icon size={24} />
    </div>
    <div>
      <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>{label}</p>
      <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: "900", color: "#1B396A" }}>{value}</p>
    </div>
  </div>
);

export default function EscritorioInvestigacion() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {/* 1. BIENVENIDA CON EL ESTILO DORADO ACADÉMICO */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.5rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>
            Mi Escritorio de Investigación
          </h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={18} color="#f59e0b" /> Tienes 2 papers listos para revisión y una nueva cita en tu artículo Q1.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button style={{ backgroundColor: "white", border: "1px solid #e2e8f0", color: "#1B396A", padding: "12px 24px", borderRadius: "14px", fontWeight: "700", cursor: "pointer" }}>Ver ORCID</button>
          <button style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "12px 24px", borderRadius: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(27, 57, 106, 0.2)" }}>Nuevo Manuscrito</button>
        </div>
      </header>

      {/* 2. MÉTRICAS DE IMPACTO (DIFERENCIADOR) */}
      <div style={{ display: "flex", gap: "20px" }}>
        <MetricCard label="Índice H" value="14" icon={TrendingUp} color="#f59e0b" />
        <MetricCard label="Citas Totales" value="842" icon={Award} color="#3b82f6" />
        <MetricCard label="Publicaciones" value="28" icon={BookOpen} color="#10b981" />
        <MetricCard label="Colaboradores" value="12" icon={Users} color="#8b5cf6" />
      </div>

      {/* 3. GRID DE ACTIVIDAD Y PROYECTOS */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "32px" }}>
        
        {/* Proyectos Recientes */}
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h2 style={{ fontSize: "1.3rem", color: "#1B396A", fontWeight: "800", margin: 0 }}>Proyectos en Curso</h2>
          {[
            { t: "Algoritmos Genéticos para Agricultura", p: "75%", c: "#f59e0b" },
            { t: "IoT en Redes Locales de Yucatán", p: "40%", c: "#3b82f6" }
          ].map((proj, i) => (
            <div key={i} style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ margin: "0 0 8px 0", color: "#1B396A" }}>{proj.t}</h4>
                <div style={{ width: "200px", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: proj.p, height: "100%", backgroundColor: proj.c }} />
                </div>
              </div>
              <ArrowUpRight size={20} color="#94a3b8" />
            </div>
          ))}
        </section>

        {/* Notificaciones Académicas */}
        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
          <h2 style={{ fontSize: "1.1rem", color: "#1B396A", fontWeight: "800", marginBottom: "20px" }}>Alertas Académicas</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "12px" }}>
               <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#fffbeb", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Share2 size={20}/></div>
               <div>
                 <p style={{ margin: "0 0 4px 0", fontSize: "0.9rem", fontWeight: "700" }}>Nueva cita detectada</p>
                 <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Tu paper sobre 'IoT' fue citado en Nature Journal.</p>
               </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}