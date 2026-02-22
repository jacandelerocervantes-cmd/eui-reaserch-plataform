"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  FileText, Plus, Search, Filter, 
  Calendar, CheckCircle2, Clock, Users, ArrowRight, Pencil, Lock
} from "lucide-react";

// --- COMPONENTE PREMIUM: BOTÓN EXPANDIBLE (FIRMA DE CERTEZA AIA) ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", type = "button", disabled = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", hoverText: "white", border: "transparent" };
      case "magic": return { bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white", hoverText: "white", border: "transparent" };
      case "cancel":  return { bg: "white", hoverBg: "#fee2e2", text: "#64748b", hoverText: "#ef4444", border: isHovered ? "#ef4444" : "#cbd5e1" };
      default:        return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", hoverText: "#1B396A", border: "#cbd5e1" };
    }
  };
  const style = getStyles();

  return (
    <button
      type={type} onClick={onClick} disabled={disabled} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: isHovered && !disabled ? "10px" : "0px",
        backgroundColor: isHovered && !disabled ? style.hoverBg : style.bg, color: isHovered && !disabled ? style.hoverText : style.text, 
        border: `1px solid ${style.border}`, borderRadius: "10px", padding: "0 16px", height: "42px", fontWeight: "600", fontSize: "0.9rem", cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", whiteSpace: "nowrap",
        boxShadow: isHovered && !disabled && variant !== 'cancel' && variant !== 'default' ? "0 4px 6px rgba(0,0,0,0.15)" : "none"
      }}
    >
      {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
      <span style={{ maxWidth: isHovered && !disabled ? "200px" : "0px", opacity: isHovered && !disabled ? 1 : 0, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", display: "inline-block" }}>
        {label}
      </span>
    </button>
  );
};

// --- COMPONENTE DE ESTADÍSTICAS ---
const StatCard = ({ label, value, icon: Icon, color }: any) => (
  <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "24px", border: "1px solid #e2e8f0", flex: 1, display: "flex", alignItems: "center", gap: "20px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
    <div style={{ backgroundColor: `${color}15`, color: color, padding: "14px", borderRadius: "16px" }}>
      <Icon size={24} />
    </div>
    <div>
      <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#1B396A" }}>{value}</div>
    </div>
  </div>
);

export default function ListaActividadesPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id;
  
  const [searchTerm, setSearchTerm] = useState("");
  const [actividades, setActividades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- INTEGRACIÓN SUPABASE ---
  useEffect(() => {
    const fetchActividades = async () => {
      setIsLoading(true);
      try {
        // Mock data temporal mientras conectas Supabase
        const mockData = [
          { id: "act-1", title: "Investigación: Modelos OSI", description: "Análisis comparativo de las capas del modelo OSI vs TCP/IP.", dueDate: "2026-03-15T23:59:59", status: "activa", submissions: 15, totalStudents: 40 },
          { id: "act-2", title: "Práctica: Configuración Router", description: "Capturas de pantalla de la topología en Cisco Packet Tracer.", dueDate: "2026-03-20T23:59:59", status: "borrador", submissions: 0, totalStudents: 40 },
          { id: "act-3", title: "Cuestionario: Subnetting", description: "Resolución de problemas de división de subredes IPv4.", dueDate: "2026-02-15T23:59:59", status: "finalizada", submissions: 40, totalStudents: 40 },
        ];
        setActividades(mockData);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchActividades();
  }, [courseId]);

  const isEditable = (dateString: string) => new Date() < new Date(dateString);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {/* 1. HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Actividades</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Gestión del curso y evaluaciones</p>
        </div>
        
        {/* BOTÓN EXPANDIBLE PARA NUEVA ACTIVIDAD */}
        <div style={{ paddingBottom: "4px" }}>
          <ExpandingButton 
            icon={Plus} 
            label="Nueva Actividad" 
            onClick={() => router.push(`/panel/materias/${courseId}/actividades/nueva`)} 
            variant="primary" 
          />
        </div>
      </div>

      {/* 2. STATS */}
      <div style={{ display: "flex", gap: "24px" }}>
        <StatCard label="Total Actividades" value={actividades.length} icon={FileText} color="#1B396A" />
        <StatCard label="En Progreso" value={actividades.filter(a => a.status === 'activa').length} icon={Clock} color="#f59e0b" />
        <StatCard label="Finalizadas" value={actividades.filter(a => a.status === 'finalizada').length} icon={CheckCircle2} color="#10b981" />
      </div>

      {/* 3. BARRA DE BÚSQUEDA Y FILTRO */}
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)" }} />
          <input 
            type="text" placeholder="Buscar actividad..." 
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "14px 16px 14px 52px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none", transition: "border 0.2s" }}
            onFocus={(e) => e.target.style.borderColor = "#1B396A"}
            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
          />
        </div>
        <ExpandingButton icon={Filter} label="Filtros" variant="default" />
      </div>

      {/* 4. GRID DE TARJETAS */}
      {!isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "24px" }}>
          {actividades.map((act) => {
            const canEdit = isEditable(act.dueDate);

            return (
              <div key={act.id} style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.02)", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", position: "relative" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(0,0,0,0.02)"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <span style={{ backgroundColor: act.status === 'activa' ? '#eff6ff' : act.status === 'finalizada' ? '#f0fdf4' : '#f8fafc', color: act.status === 'activa' ? '#2563eb' : act.status === 'finalizada' ? '#16a34a' : '#64748b', padding: "6px 12px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "800", textTransform: "uppercase" }}>
                      {act.status}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: canEdit ? "#64748b" : "#ef4444", fontSize: "0.85rem", fontWeight: "700" }}>
                      <Calendar size={14} /> {formatDate(act.dueDate)}
                    </div>
                  </div>
                  <h3 style={{ margin: "0 0 12px 0", color: "#1B396A", fontSize: "1.4rem", fontWeight: "900", lineHeight: "1.2" }}>{act.title}</h3>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem", lineHeight: "1.5" }}>{act.description}</p>
                </div>

                <div style={{ marginTop: "32px", borderTop: "1px solid #f1f5f9", paddingTop: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1B396A", fontWeight: "800" }}>
                      <Users size={18} color="#94a3b8" />
                      <span>{act.submissions} <span style={{ color: "#94a3b8", fontWeight: "600" }}>/ {act.totalStudents} Entregas</span></span>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "12px" }}>
                    {/* Botón Evaluar */}
                    <button onClick={() => router.push(`/panel/materias/${courseId}/actividades/${act.id}`)}
                      style={{ flex: 1, backgroundColor: "#f8fafc", color: "#1B396A", border: "1px solid #e2e8f0", padding: "12px", borderRadius: "12px", fontWeight: "900", fontSize: "1rem", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", transition: "all 0.2s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1B396A"; e.currentTarget.style.color = "white"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.color = "#1B396A"; }}
                    >
                      Evaluar Entregas <ArrowRight size={18} />
                    </button>

                    {/* Botón Editar (Lleva a la ruta de edición) */}
                    <button 
                      onClick={() => router.push(`/panel/materias/${courseId}/actividades/${act.id}/editar`)} 
                      disabled={!canEdit} 
                      title={canEdit ? "Editar Configuración" : "Edición bloqueada (Fecha vencida)"}
                      style={{ width: "48px", height: "48px", backgroundColor: canEdit ? "white" : "#f1f5f9", color: canEdit ? "#94a3b8" : "#cbd5e1", border: "1px solid #e2e8f0", borderRadius: "12px", cursor: canEdit ? "pointer" : "not-allowed", display: "flex", justifyContent: "center", alignItems: "center", transition: "all 0.2s" }}
                      onMouseEnter={(e) => { if(canEdit){ e.currentTarget.style.color = "#1B396A"; e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.backgroundColor = "#f8fafc"; } }}
                      onMouseLeave={(e) => { if(canEdit){ e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.backgroundColor = "white"; } }}
                    >
                      {canEdit ? <Pencil size={20} /> : <Lock size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}