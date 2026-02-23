"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, Search, Briefcase, Users, 
  Calendar, FileText, Globe, Star, 
  ArrowUpRight, Clock, ShieldCheck, ChevronDown
} from "lucide-react";

// --- TARJETA DE PROYECTO INVESTIGADOR (EXPANSIBLE) ---
const ResearchProjectCard = ({ project }: { project: any }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0",
        boxShadow: isHovered ? "0 20px 25px -5px rgba(245, 158, 11, 0.15)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", 
        display: "flex", flexDirection: "column", position: "relative",
        transform: isHovered ? "translateY(-6px)" : "translateY(0)"
      }}
    >
      {/* Indicador de Status con Color Dinámico */}
      <div style={{ height: "6px", width: "100%", backgroundColor: project.statusColor }} />

      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: "900", color: "#f59e0b", backgroundColor: "#fffbeb", padding: "4px 10px", borderRadius: "8px", textTransform: "uppercase" }}>
            {project.status}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
             {project.isPublic && (
               <span title="Publicado" style={{ display: "flex" }}>
                 <Globe size={16} color="#94a3b8" />
               </span>
             )}
             {project.hasFunding && (
               <span title="Financiado" style={{ display: "flex" }}>
                 <ShieldCheck size={16} color="#10b981" />
               </span>
             )}
          </div>
        </div>

        <h3 style={{ margin: "0 0 12px 0", color: "#1B396A", fontSize: "1.25rem", fontWeight: "900", lineHeight: "1.3" }}>
          {project.title}
        </h3>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#64748b", fontSize: "0.85rem", fontWeight: "600" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><Users size={14} /> {project.teamCount} Miembros</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={14} /> {project.lastUpdate}</div>
        </div>
      </div>

      {/* CONTENIDO EXPANDIBLE AL HOVER */}
      <div style={{ 
        maxHeight: isHovered ? "350px" : "0px", opacity: isHovered ? 1 : 0, 
        padding: isHovered ? "0 24px 24px 24px" : "0 24px", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", margin: "4px 0 16px 0" }} />
        
        {/* Próximo Hito (Milestone) */}
        <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", marginBottom: "20px" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>Próximo Hito</div>
          <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#1e293b", display: "flex", justifyContent: "space-between" }}>
            {project.nextMilestone}
            <span style={{ color: "#f59e0b" }}>{project.milestoneDate}</span>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button style={{ flex: 2, backgroundColor: "#1B396A", color: "white", padding: "12px", borderRadius: "12px", fontWeight: "800", fontSize: "0.9rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", border: "none", cursor: "pointer" }}>
            Gestionar Proyecto <ArrowUpRight size={18} />
          </button>
          <button style={{ flex: 1, backgroundColor: "white", color: "#1B396A", border: "1px solid #e2e8f0", padding: "12px", borderRadius: "12px", fontWeight: "700", fontSize: "0.9rem", cursor: "pointer" }}>
            Editar
          </button>
        </div>
      </div>
    </div>
  );
};

export default function MisProyectosInvestigacion() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const proyectos = [
    { 
      id: 1, 
      title: "Optimización de Algoritmos Genéticos para Agricultura de Precisión", 
      status: "En Ejecución", 
      statusColor: "#f59e0b",
      teamCount: 5, 
      lastUpdate: "Ayer", 
      isPublic: false, 
      hasFunding: true,
      nextMilestone: "Entrega de Prototipo", 
      milestoneDate: "15 Abr"
    },
    { 
      id: 2, 
      title: "Impacto Socioeconómico de la IA en la Educación Superior", 
      status: "Finalizado", 
      statusColor: "#10b981",
      teamCount: 3, 
      lastUpdate: "Hace 2 semanas", 
      isPublic: true, 
      hasFunding: false,
      nextMilestone: "Publicación Journal Q1", 
      milestoneDate: "Completado"
    },
    { 
      id: 3, 
      title: "Resiliencia Hídrica en el Estado de Yucatán: Modelado Estocástico", 
      status: "Propuesta", 
      statusColor: "#3b82f6",
      teamCount: 2, 
      lastUpdate: "Hoy", 
      isPublic: false, 
      hasFunding: true,
      nextMilestone: "Aprobación Ética", 
      milestoneDate: "12 Mar"
    }
  ];

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {/* HEADER INVESTIGADOR */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>
            Portafolio de Investigación
          </h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>
            Gestiona tus protocolos, financiamientos y producción científica.
          </p>
        </div>
        <button style={{ backgroundColor: "#1B396A", color: "white", padding: "14px 24px", borderRadius: "14px", fontWeight: "800", display: "flex", alignItems: "center", gap: "10px", border: "none", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(27, 57, 106, 0.2)" }}>
          <Plus size={20} /> Registrar Nuevo Proyecto
        </button>
      </header>

      {/* BARRA DE BÚSQUEDA Y FILTROS ACADÉMICOS */}
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: "500px" }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
          <input 
            type="text" placeholder="Buscar por título, DOI o investigador..." 
            style={{ width: "100%", padding: "14px 16px 14px 48px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none", backgroundColor: "white" }} 
          />
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {["En curso", "Publicados", "Con Fondos"].map(tag => (
            <span key={tag} style={{ padding: "8px 16px", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontWeight: "700", color: "#64748b", cursor: "pointer" }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* GRID DE PROYECTOS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "24px", alignItems: "start" }}>
        {proyectos.map(proj => (
          <ResearchProjectCard key={proj.id} project={proj} />
        ))}
      </div>

    </div>
  );
}