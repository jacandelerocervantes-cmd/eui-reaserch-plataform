"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, CheckCircle2, Clock, AlertCircle, 
  Search, Eye, Save, Sparkles, BarChart3, Send
} from "lucide-react";

// --- COMPONENTE: ExpandingButton ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", small = false, disabled = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", border: "transparent" };
      case "secondary": return { bg: "white", hoverBg: "#f8fafc", text: "#1B396A", border: "#cbd5e1" };
      case "ai": return { bg: "#f0f7ff", hoverBg: "#e0efff", text: "#2563eb", border: "#bfdbfe" };
      case "success": return { bg: "#10b981", hoverBg: "#059669", text: "white", border: "transparent" };
      case "notify": return { bg: "#f59e0b", hoverBg: "#d97706", text: "white", border: "transparent" };
      default: return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", border: "#cbd5e1" };
    }
  };
  const style = getStyles();
  return (
    <button
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      onClick={onClick} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: isHovered && !disabled ? "8px" : "0px",
        backgroundColor: isHovered && !disabled ? style.hoverBg : style.bg, color: style.text, 
        border: `1px solid ${style.border}`, borderRadius: "10px", padding: "0 12px", height: small ? "36px" : "44px",
        fontWeight: "600", transition: "all 0.3s", overflow: "hidden", whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer"
      }}
    >
      {Icon && <Icon size={small ? 16 : 18} />}
      <span style={{ maxWidth: isHovered ? "200px" : "0px", opacity: isHovered ? 1 : 0, transition: "0.3s" }}>{label}</span>
    </button>
  );
};

export default function RevisionExamenPage() {
  const params = useParams();
  const router = useRouter();

  const [alumnos, setAlumnos] = useState([
    { id: "1", matricula: "19080123", nombre: "Candelero Cervantes Juan Antonio", entregado: true, score_ia: 85, final_score: 85, revisado: false },
    { id: "2", matricula: "19080124", nombre: "López García María Elena", entregado: true, score_ia: 92, final_score: 92, revisado: true },
    { id: "3", matricula: "19080125", nombre: "Pérez Ruíz Ricardo", entregado: false, score_ia: 0, final_score: 0, revisado: false },
  ]);

  const handleSyncGrades = () => {
    alert("Enviando estas calificaciones a la columna 'EVAL' de la Sábana General...");
  };

  const handleMassNotify = () => {
    if(confirm("¿Deseas enviar los resultados finales y el feedback de IA por correo a todos los alumnos calificados?")) {
      alert("Resultados enviados exitosamente.");
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", backgroundColor: "#F8FAFC", minHeight: "100vh" }}>
      
      {/* HEADER: INFO EXAMEN */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><ArrowLeft /></button>
          <div>
            <h1 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "900", margin: 0 }}>Resultados: Parcial 1 SQL</h1>
            <div style={{ display: "flex", gap: "15px", marginTop: "5px", fontSize: "0.85rem", color: "#64748b" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><BarChart3 size={14} /> Unidad 1</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><Clock size={14} /> 60 Minutos</span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><CheckCircle2 size={14} color="#10b981" /> 2 / 3 Entregados</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <ExpandingButton icon={Sparkles} label="Revisión Masiva IA" variant="ai" />
          <ExpandingButton icon={Send} label="Notificar al Grupo" onClick={handleMassNotify} variant="notify" />
          <ExpandingButton icon={Save} label="Guardar en Sábana" onClick={handleSyncGrades} variant="success" />
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div style={{ backgroundColor: "white", padding: "15px 25px", borderRadius: "16px", border: "1px solid #e2e8f0", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ position: "relative", width: "400px" }}>
          <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input placeholder="Buscar por nombre o matrícula..." style={{ width: "100%", padding: "10px 15px 10px 40px", borderRadius: "10px", border: "1px solid #e2e8f0", outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <select style={{ padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", backgroundColor: "white", color: "#1B396A", fontWeight: "600" }}>
            <option>Todos los alumnos</option>
            <option>Pendientes de entrega</option>
            <option>Por revisar manual</option>
          </select>
        </div>
      </div>

      {/* TABLA DE REVISIÓN OPERATIVA */}
      <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#F8FAFC", textAlign: "left" }}>
            <tr>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.75rem", fontWeight: "800" }}>ALUMNO / MATRÍCULA</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.75rem", fontWeight: "800" }}>ESTADO DE ENTREGA</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.75rem", fontWeight: "800" }}>SCORE IA</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.75rem", fontWeight: "800" }}>CALIF. FINAL (100)</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.75rem", fontWeight: "800", textAlign: "right" }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: a.entregado ? "white" : "#fafafa" }}>
                <td style={{ padding: "18px 25px" }}>
                  <div style={{ color: "#1B396A", fontWeight: "700" }}>{a.nombre}</div>
                  <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{a.matricula}</div>
                </td>
                <td style={{ padding: "18px 25px" }}>
                  {a.entregado ? (
                    <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "5px", fontSize: "0.85rem", fontWeight: "700" }}>
                      <CheckCircle2 size={16} /> Entregado
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "5px", fontSize: "0.85rem", fontWeight: "700" }}>
                      <Clock size={16} /> Pendiente
                    </span>
                  )}
                </td>
                <td style={{ padding: "18px 25px", color: "#64748b", fontWeight: "700" }}>
                  {a.entregado ? `${a.score_ia}/100` : "--"}
                </td>
                <td style={{ padding: "18px 25px" }}>
                  {a.entregado ? (
                    <input 
                      type="number" 
                      defaultValue={a.final_score} 
                      style={{ width: "70px", padding: "8px", borderRadius: "8px", border: a.revisado ? "1px solid #e2e8f0" : "2px solid #f59e0b", textAlign: "center", fontWeight: "800", color: "#1B396A" }} 
                    />
                  ) : "--"}
                </td>
                <td style={{ padding: "18px 25px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                    <ExpandingButton small icon={Sparkles} label="Feedback IA" variant="ai" disabled={!a.entregado} />
                    <ExpandingButton small icon={Eye} label="Revisar Reactivos" onClick={() => {}} variant="secondary" disabled={!a.entregado} />
                    {a.entregado && !a.revisado && (
                      <span title="Requiere revisión manual" style={{ display: "flex", alignItems: "center" }}>
                        <AlertCircle size={18} color="#f59e0b" />
                      </span>
                    )}
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