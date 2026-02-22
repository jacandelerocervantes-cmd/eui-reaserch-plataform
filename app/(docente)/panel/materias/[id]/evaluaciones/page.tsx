"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Plus, Calendar, Eye, EyeOff, Edit2, Trash2, 
  ChevronDown, ChevronUp, Clock, BarChart3, 
  CheckSquare, MoreVertical, BookOpen
} from "lucide-react";

// --- COMPONENTE: ExpandingButton (Consistencia UI) ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", disabled = false, small = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", border: "transparent" };
      case "secondary": return { bg: "white", hoverBg: "#f8fafc", text: "#1B396A", border: "#cbd5e1" };
      case "danger": return { bg: "#fee2e2", hoverBg: "#ef4444", text: isHovered ? "white" : "#ef4444", border: "transparent" };
      default: return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", border: "#cbd5e1" };
    }
  };
  const style = getStyles();
  return (
    <button
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      onClick={onClick} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: isHovered ? "8px" : "0px",
        backgroundColor: isHovered && !disabled ? style.hoverBg : style.bg, color: style.text, 
        border: `1px solid ${style.border}`, borderRadius: "10px", padding: "0 12px", height: small ? "36px" : "44px",
        fontWeight: "600", fontSize: small ? "0.85rem" : "1rem", cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", whiteSpace: "nowrap"
      }}
    >
      {Icon && <Icon size={small ? 16 : 18} style={{ flexShrink: 0 }} />}
      <span style={{ maxWidth: isHovered ? "150px" : "0px", opacity: isHovered ? 1 : 0, transition: "0.3s", display: "inline-block" }}>
        {label}
      </span>
    </button>
  );
};

// --- COMPONENTE: ExamenCard (Diseño de Rejilla / Grid) ---
const ExamenCard = ({ examen, onEdit, onDelete }: any) => {
  return (
    <div style={{ 
      backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", 
      padding: "24px", display: "flex", flexDirection: "column", gap: "16px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.03)", transition: "transform 0.2s, box-shadow 0.2s",
      cursor: "default"
    }}>
      {/* Icono y Badge de Estado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ 
          width: "48px", height: "48px", borderRadius: "14px", backgroundColor: "#F0F7FF", 
          display: "flex", justifyContent: "center", alignItems: "center", color: "#2563eb" 
        }}>
          <CheckSquare size={26} />
        </div>
        {examen.publicado ? 
          <span style={{ fontSize: "0.65rem", color: "#10b981", fontWeight: "900", backgroundColor: "#ecfdf5", padding: "4px 10px", borderRadius: "8px", border: "1px solid #d1fae5" }}>PULICADO</span> : 
          <span style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: "900", backgroundColor: "#f8fafc", padding: "4px 10px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>BORRADOR</span>
        }
      </div>

      {/* Información del Examen */}
      <div>
        <h4 style={{ margin: "0 0 8px 0", color: "#1B396A", fontSize: "1.15rem", fontWeight: "800", lineHeight: "1.3" }}>
          {examen.titulo}
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "0.85rem" }}>
            <Calendar size={14} /> {examen.fecha}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "0.85rem" }}>
            <Clock size={14} /> {examen.hora}
          </div>
        </div>
      </div>

      {/* Stats e Indicador de Puntos */}
      <div style={{ 
        marginTop: "auto", paddingTop: "16px", borderTop: "1px solid #f1f5f9", 
        display: "flex", justifyContent: "space-between", alignItems: "center" 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1B396A", fontWeight: "700", fontSize: "0.9rem" }}>
          <BarChart3 size={16} /> {examen.puntos} pts
        </div>
        
        {/* Acciones Expandibles */}
        <div style={{ display: "flex", gap: "6px" }}>
          <ExpandingButton small icon={Edit2} label="Editar" onClick={onEdit} variant="secondary" />
          <ExpandingButton small icon={Trash2} label="Borrar" onClick={onDelete} variant="danger" />
        </div>
      </div>
    </div>
  );
};

export default function EvaluacionesPage() {
  const params = useParams();
  const router = useRouter();
  const [activeUnit, setActiveUnit] = useState<number | null>(1);

  const unidades = [
    { 
      numero: 1, 
      titulo: "Gestión de Proyectos de Software", 
      examenes: [
        { id: "1", titulo: "Examen Parcial: Metodologías Ágiles", fecha: "2026-03-12", hora: "09:00", publicado: true, puntos: 100 },
        { id: "2", titulo: "Quiz: Scrum vs Kanban", fecha: "2026-03-18", hora: "11:00", publicado: false, puntos: 100 }
      ] 
    },
    { numero: 2, titulo: "Modelado y Diseño UML", examenes: [] }
  ];

  return (
    <div style={{ padding: "40px", maxWidth: "1250px", margin: "0 auto" }}>
      
      {/* Header Estilo Materias */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.4rem", fontWeight: "900", margin: 0 }}>Evaluaciones</h1>
          <p style={{ color: "#64748b", marginTop: "4px", fontSize: "1.1rem" }}>Crea y gestiona los exámenes de tus alumnos.</p>
        </div>
        <ExpandingButton 
          icon={Plus} 
          label="Nuevo Examen" 
          onClick={() => router.push(`/panel/materias/${params.id}/evaluaciones/nuevo`)} 
        />
      </div>

      {/* Unidades con Grid Interno */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {unidades.map((u) => (
          <div key={u.numero} style={{ borderRadius: "24px", border: "1px solid #e2e8f0", backgroundColor: "white", overflow: "hidden" }}>
            
            {/* Cabecera Unidad */}
            <div 
              onClick={() => setActiveUnit(activeUnit === u.numero ? null : u.numero)}
              style={{ padding: "24px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", backgroundColor: activeUnit === u.numero ? "#F8FAFC" : "#fff" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "#1B396A", color: "white", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "900" }}>
                  {u.numero}
                </div>
                <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.3rem", fontWeight: "800" }}>{u.titulo}</h3>
              </div>
              {activeUnit === u.numero ? <ChevronUp color="#94a3b8" /> : <ChevronDown color="#94a3b8" />}
            </div>

            {/* Grid de Cards (Aquí está el cambio) */}
            {activeUnit === u.numero && (
              <div style={{ padding: "30px", borderTop: "1px solid #f1f5f9", backgroundColor: "#FCFDFE" }}>
                {u.examenes.length > 0 ? (
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", 
                    gap: "20px" 
                  }}>
                    {u.examenes.map(ex => (
                      <ExamenCard 
                        key={ex.id} 
                        examen={ex} 
                        onEdit={() => router.push(`/panel/materias/${params.id}/evaluaciones/nuevo`)}
                        onDelete={() => {}}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    No hay exámenes en esta unidad.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}