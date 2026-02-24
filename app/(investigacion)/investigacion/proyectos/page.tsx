"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Plus, Search, Briefcase, Users, 
  Calendar, FileText, Globe, Star, 
  ArrowUpRight, Clock, ShieldCheck, ChevronDown, Sparkles, Loader2, ArrowRight
} from "lucide-react";
import { useRouter } from "next/navigation";

// --- TARJETA DE PROYECTO INVESTIGADOR (EXPANSIBLE & ACTIVA) ---
const ResearchProjectCard = ({ project, onUpdateStatus }: { project: any, onUpdateStatus: (id: number, newStatus: string) => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const router = useRouter();

  const handleGeneratePitch = () => {
    setIsGeneratingPitch(true);
    setTimeout(() => {
      setIsGeneratingPitch(false);
      alert(`🤖 Pitch Generado para "${project.title}":\n\n"Este proyecto aborda un problema crítico utilizando innovación tecnológica de frontera, con un mercado potencial enorme y un equipo altamente capacitado. Buscamos escalar los resultados a la Fase 2."\n\n(Copiado al portapapeles)`);
    }, 2000);
  };

  // Ciclar estado con un clic (Optimistic UI)
  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const mapStatus: any = {
      'Propuesta': 'En Ejecución',
      'En Ejecución': 'Finalizado',
      'Finalizado': 'Propuesta'
    };
    onUpdateStatus(project.id, mapStatus[project.status]);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'En Ejecución': return '#f59e0b'; // Ambar
      case 'Finalizado': return '#10b981'; // Verde
      case 'Propuesta': return '#3b82f6'; // Azul
      default: return '#94a3b8';
    }
  };

  const statusColor = getStatusColor(project.status);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0",
        boxShadow: isHovered ? `0 20px 25px -5px ${statusColor}20` : "0 4px 6px -1px rgba(0,0,0,0.05)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", 
        display: "flex", flexDirection: "column", position: "relative",
        transform: isHovered ? "translateY(-6px)" : "translateY(0)"
      }}
    >
      {/* Indicador de Status con Color Dinámico */}
      <div style={{ height: "6px", width: "100%", backgroundColor: statusColor, transition: "background-color 0.3s" }} />

      <div style={{ padding: "24px", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
          
          {/* Badge interactivo de Status */}
          <button 
            onClick={handleStatusClick}
            style={{ 
              fontSize: "0.7rem", fontWeight: "900", color: statusColor, backgroundColor: `${statusColor}15`, 
              padding: "4px 10px", borderRadius: "8px", textTransform: "uppercase", border: "none",
              cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "4px"
            }}
            title="Clic para cambiar estado"
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            {project.status} <ChevronDown size={12}/>
          </button>
          
          <div style={{ display: "flex", gap: "8px" }}>
             {project.isPublic && (
               <span title="Publicado" style={{ display: "flex", backgroundColor: "#f1f5f9", padding: "4px", borderRadius: "6px" }}>
                 <Globe size={16} color="#64748b" />
               </span>
             )}
             {project.hasFunding && (
               <span title="Fondos Asignados" style={{ display: "flex", backgroundColor: "#ecfdf5", padding: "4px", borderRadius: "6px" }}>
                 <ShieldCheck size={16} color="#10b981" />
               </span>
             )}
          </div>
        </div>

        <h3 style={{ margin: "0 0 16px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "900", lineHeight: "1.3" }}>
          {project.title}
        </h3>
        
        <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#64748b", fontSize: "0.85rem", fontWeight: "700" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#f8fafc", padding: "4px 10px", borderRadius: "8px" }}><Users size={14} /> {project.teamCount}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#f8fafc", padding: "4px 10px", borderRadius: "8px" }}><Clock size={14} /> {project.lastUpdate}</div>
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
        <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>Próximo Hito de Avance</div>
          <div style={{ fontSize: "0.9rem", fontWeight: "800", color: "#1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {project.nextMilestone}
            <span style={{ color: "#d97706", backgroundColor: "#fef3c7", padding: "2px 8px", borderRadius: "6px", fontSize: "0.8rem" }}>{project.milestoneDate}</span>
          </div>
        </div>

        {/* Acciones del Mundo Dorado */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <button 
            onClick={handleGeneratePitch}
            disabled={isGeneratingPitch}
            style={{ flex: 1, backgroundColor: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", padding: "10px", borderRadius: "12px", fontWeight: "800", fontSize: "0.85rem", cursor: isGeneratingPitch ? "wait" : "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", transition: "all 0.2s" }}
            onMouseEnter={e => {if(!isGeneratingPitch) e.currentTarget.style.backgroundColor = "#fef3c7"}}
            onMouseLeave={e => {if(!isGeneratingPitch) e.currentTarget.style.backgroundColor = "#fffbeb"}}
          >
            {isGeneratingPitch ? <Loader2 size={16} className="animate-spin" /> : <><Sparkles size={16} /> Pitch IA</>}
          </button>
        </div>

        <button 
          onClick={() => router.push(`/investigacion/canvas`)} // Te lleva al Canvas Mágico
          style={{ width: "100%", backgroundColor: "#1B396A", color: "white", padding: "12px", borderRadius: "12px", fontWeight: "800", fontSize: "0.9rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", border: "none", cursor: "pointer", transition: "background 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = "#152c54"}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = "#1B396A"}
        >
          Abrir en Canvas AI <ArrowRight size={18} />
        </button>

      </div>
    </div>
  );
};

export default function MisProyectosInvestigacion() {
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    fetchProyectos();
  }, []);

  const fetchProyectos = async () => {
    setLoading(true);
    // Simulación de Supabase Data Fetch
    setTimeout(() => {
      setProyectos([
        { id: 1, title: "Optimización de Algoritmos Genéticos para Agricultura de Precisión", status: "En Ejecución", teamCount: 5, lastUpdate: "Ayer", isPublic: false, hasFunding: true, nextMilestone: "Entrega de Prototipo", milestoneDate: "15 Abr" },
        { id: 2, title: "Impacto Socioeconómico de la IA en la Educación Superior", status: "Finalizado", teamCount: 3, lastUpdate: "Hace 2 semanas", isPublic: true, hasFunding: false, nextMilestone: "Publicación Journal Q1", milestoneDate: "Completado" },
        { id: 3, title: "Resiliencia Hídrica en el Estado de Yucatán: Modelado Estocástico", status: "Propuesta", teamCount: 2, lastUpdate: "Hoy", isPublic: false, hasFunding: true, nextMilestone: "Aprobación Ética", milestoneDate: "12 Mar" },
        { id: 4, title: "Diseño de Nodos IoT para Monitoreo de Arrecifes de Coral", status: "En Ejecución", teamCount: 4, lastUpdate: "Hace 3 días", isPublic: false, hasFunding: false, nextMilestone: "Prueba Submarina", milestoneDate: "20 May" }
      ]);
      setLoading(false);
    }, 600);
  };

  // Lógica Optimista para cambiar estados
  const handleUpdateStatus = (id: number, newStatus: string) => {
    setProyectos(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    // Aquí iría: supabase.from('proyectos').update({status: newStatus}).eq('id', id);
  };

  // Motor de Búsqueda y Filtrado en Vivo
  const filteredProyectos = proyectos.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    if (activeFilter === 'En curso') matchesFilter = p.status === 'En Ejecución';
    if (activeFilter === 'Publicados') matchesFilter = p.isPublic === true;
    if (activeFilter === 'Con Fondos') matchesFilter = p.hasFunding === true;

    return matchesSearch && matchesFilter;
  });

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px", animation: "fadeIn 0.5s ease-out" }}>
      
      {/* HEADER INVESTIGADOR */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
              Mundo Dorado
            </span>
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>
            Portafolio de Investigación
          </h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>
            Gestiona tus protocolos, financiamientos y producción científica en un solo lugar.
          </p>
        </div>
        <button style={{ backgroundColor: "#1B396A", color: "white", padding: "14px 24px", borderRadius: "14px", fontWeight: "900", display: "flex", alignItems: "center", gap: "10px", border: "none", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(27, 57, 106, 0.2)", transition: "transform 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <Plus size={20} /> Nuevo Proyecto
        </button>
      </header>

      {/* BARRA DE BÚSQUEDA Y FILTROS ACADÉMICOS EN VIVO */}
      <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "300px", maxWidth: "500px" }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
          <input 
            type="text" 
            placeholder="Buscar por título, DOI o investigador..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "14px 16px 14px 48px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none", backgroundColor: "white", color: "#1B396A", fontWeight: "600", transition: "border 0.2s" }} 
            onFocus={(e) => e.target.style.borderColor = "#f59e0b"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
          />
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {["Todos", "En curso", "Publicados", "Con Fondos"].map(tag => {
            const isActive = activeFilter === tag || (tag === "Todos" && activeFilter === null);
            return (
              <button 
                key={tag} 
                onClick={() => setActiveFilter(tag === "Todos" ? null : tag)}
                style={{ 
                  padding: "10px 16px", borderRadius: "12px", border: "none", fontSize: "0.85rem", fontWeight: "800", cursor: "pointer", transition: "all 0.2s",
                  backgroundColor: isActive ? "#1B396A" : "white",
                  color: isActive ? "white" : "#64748b",
                  boxShadow: isActive ? "0 4px 10px rgba(27, 57, 106, 0.2)" : "0 2px 4px rgba(0,0,0,0.02)"
                }}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>

      {/* GRID DE PROYECTOS */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} className="animate-spin" /> Consultando Base de Datos...
        </div>
      ) : filteredProyectos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "1px dashed #cbd5e1" }}>
          <Briefcase size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#64748b" }}>No se encontraron proyectos</h3>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>Intenta cambiar los filtros o los términos de búsqueda.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "24px", alignItems: "start" }}>
          {filteredProyectos.map(proj => (
            <ResearchProjectCard key={proj.id} project={proj} onUpdateStatus={handleUpdateStatus} />
          ))}
        </div>
      )}

    </div>
  );
}