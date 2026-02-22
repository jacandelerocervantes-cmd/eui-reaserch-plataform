"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  BarChart3, Users, CheckCircle2, AlertCircle, 
  TrendingUp, ArrowLeft, Download, Sparkles, 
  Search, Eye, MessageSquare
} from "lucide-react";

// --- COMPONENTE: ExpandingButton (Para mantener tu estándar) ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", small = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const getStyles = () => {
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", border: "transparent" };
      case "secondary": return { bg: "white", hoverBg: "#f8fafc", text: "#1B396A", border: "#cbd5e1" };
      case "ai": return { bg: "#f0f7ff", hoverBg: "#e0efff", text: "#2563eb", border: "#bfdbfe" };
      default: return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", border: "#cbd5e1" };
    }
  };
  const style = getStyles();
  return (
    <button
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: isHovered ? "8px" : "0px",
        backgroundColor: isHovered ? style.hoverBg : style.bg, color: style.text, 
        border: `1px solid ${style.border}`, borderRadius: "10px", padding: "0 12px", height: small ? "36px" : "44px",
        fontWeight: "600", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", whiteSpace: "nowrap", cursor: "pointer"
      }}
    >
      {Icon && <Icon size={small ? 16 : 18} />}
      <span style={{ maxWidth: isHovered ? "150px" : "0px", opacity: isHovered ? 1 : 0, transition: "0.3s" }}>{label}</span>
    </button>
  );
};

export default function ResultadosExamen() {
  const params = useParams();
  const router = useRouter();

  // MOCK: Datos de desempeño del grupo
  const stats = [
    { label: "Promedio Grupal", value: "84.2", icon: TrendingUp, color: "#2563eb" },
    { label: "Aprobados", value: "28/32", icon: CheckCircle2, color: "#10b981" },
    { label: "Por Calificar", value: "4", icon: AlertCircle, color: "#f59e0b" },
  ];

  const alumnos = [
    { id: 1, nombre: "Candelero Cervantes Juan Antonio", score: 95, status: "Calificado", feedback: "Excelente dominio de SQL." },
    { id: 2, nombre: "García López María", score: 88, status: "Calificado", feedback: "Bien, cuidado con la Normalización." },
    { id: 3, nombre: "Ramírez Ortiz Pedro", score: 0, status: "Pendiente", feedback: "Requiere revisión manual (Pregunta Abierta)." },
  ];

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", backgroundColor: "#F8FAFC", minHeight: "100vh" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><ArrowLeft /></button>
          <div>
            <h1 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "900", margin: 0 }}>Resultados: Examen Parcial U1</h1>
            <p style={{ color: "#64748b", margin: 0 }}>Análisis detallado de rendimiento y retroalimentación IA.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <ExpandingButton icon={Download} label="Exportar Reporte" variant="secondary" />
          <ExpandingButton icon={Sparkles} label="Análisis Grupal IA" variant="ai" />
        </div>
      </div>

      {/* STATS CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "40px" }}>
        {stats.map((s, i) => (
          <div key={i} style={{ backgroundColor: "white", padding: "25px", borderRadius: "20px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "20px" }}>
            <div style={{ backgroundColor: `${s.color}10`, color: s.color, padding: "12px", borderRadius: "12px" }}>
              <s.icon size={28} />
            </div>
            <div>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", fontWeight: "700" }}>{s.label}</p>
              <h2 style={{ margin: 0, color: "#1B396A", fontSize: "1.8rem", fontWeight: "900" }}>{s.value}</h2>
            </div>
          </div>
        ))}
      </div>

      {/* AI INSIGHTS BOX */}
      <div style={{ backgroundColor: "#f0f7ff", padding: "25px", borderRadius: "20px", border: "1px solid #bfdbfe", marginBottom: "40px", display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <div style={{ backgroundColor: "#2563eb", color: "white", padding: "10px", borderRadius: "50%" }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h4 style={{ margin: "0 0 8px 0", color: "#1B396A", fontWeight: "800" }}>Resumen de Inteligencia Artificial</h4>
          <p style={{ margin: 0, color: "#1e293b", fontSize: "0.95rem", lineHeight: "1.5" }}>
            El grupo muestra un fuerte dominio en la <strong>Competencia 1 (Teoría)</strong>, pero un 40% de los alumnos tuvo dificultades con la pregunta práctica de <strong>Normalización</strong>. Se recomienda dedicar 20 minutos de la siguiente clase a repasar la 3ra Forma Normal.
          </p>
        </div>
      </div>

      {/* TABLA DE ALUMNOS */}
      <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "20px 25px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "800" }}>Lista de Alumnos</h3>
          <div style={{ position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input placeholder="Buscar alumno..." style={{ padding: "10px 15px 10px 40px", borderRadius: "10px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem" }} />
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#F8FAFC", textAlign: "left" }}>
            <tr>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800" }}>NOMBRE DEL ALUMNO</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800" }}>ESTADO</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800" }}>CALIFICACIÓN</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800", textAlign: "right" }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "18px 25px", color: "#1B396A", fontWeight: "600" }}>{a.nombre}</td>
                <td style={{ padding: "18px 25px" }}>
                  <span style={{ 
                    padding: "4px 10px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "700",
                    backgroundColor: a.status === 'Calificado' ? "#ecfdf5" : "#fffbeb",
                    color: a.status === 'Calificado' ? "#10b981" : "#b45309"
                  }}>
                    {a.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: "18px 25px", color: "#1B396A", fontWeight: "800", fontSize: "1.1rem" }}>
                  {a.score > 0 ? a.score : "--"}
                </td>
                <td style={{ padding: "18px 25px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <ExpandingButton small icon={MessageSquare} label="Ver Feedback" variant="secondary" />
                    <ExpandingButton small icon={Eye} label="Revisar" variant="secondary" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}