"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Users, CheckCircle2, Wand2, Search, 
  Zap, FileText, ShieldAlert, X, 
  Filter, ChevronRight 
} from "lucide-react";

// --- COMPONENTE PREMIUM ---
const StatCard = ({ label, value, icon: Icon, color }: any) => (
  <div style={{ 
    backgroundColor: "white", padding: "24px", borderRadius: "24px", 
    border: "1px solid #e2e8f0", flex: 1, display: "flex", 
    alignItems: "center", gap: "20px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" 
  }}>
    <div style={{ backgroundColor: `${color}15`, color: color, padding: "14px", borderRadius: "16px" }}>
      <Icon size={24} />
    </div>
    <div>
      <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#1B396A" }}>{value}</div>
    </div>
  </div>
);

export default function DashboardEntregas() {
  const params = useParams();
  const router = useRouter();
  const { id: courseId, assignmentId } = params;
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const submissions = [
    { id: "1", name: "García López, María", status: "ai_draft", score: null, isLate: false },
    { id: "2", name: "Pérez Martínez, Juan", status: "pending_ai", score: null, isLate: true },
    { id: "3", name: "Rodríguez Sosa, Ana", status: "completed", score: 95, isLate: false },
    { id: "4", name: "Canto Dzib, Luis", status: "no_submission", score: null, isLate: false },
  ];

  const eligibleSubmissions = submissions.filter(s => s.status !== 'no_submission');

  // --- LÓGICA DE SELECCIÓN (FIX ONCHANGE) ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(eligibleSubmissions.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {/* HEADER (Limpio) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.03em" }}>Control de Entregas</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Auditoría de evidencias para esta actividad</p>
        </div>

        <div style={{ backgroundColor: "white", padding: "12px 20px", borderRadius: "16px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>Créditos IA</div>
            <div style={{ fontSize: "1.1rem", fontWeight: "900", color: "#1B396A" }}>38 / 50</div>
          </div>
          <Zap size={22} fill="#D4AF37" color="#D4AF37" />
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: "flex", gap: "24px" }}>
        <StatCard label="Alumnos" value="40" icon={Users} color="#1B396A" />
        <StatCard label="Entregas" value="32" icon={FileText} color="#3b82f6" />
        <StatCard label="Borradores IA" value="12" icon={Wand2} color="#8b5cf6" />
        <StatCard label="Calificados" value="20" icon={CheckCircle2} color="#10b981" />
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
          <input 
            type="text" 
            placeholder="Buscar alumno..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "350px", padding: "14px 16px 14px 48px", borderRadius: "16px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none", backgroundColor: "white" }}
          />
        </div>
        <button style={{ backgroundColor: "white", border: "1px solid #e2e8f0", padding: "14px 20px", borderRadius: "16px", color: "#1B396A", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700" }}>
          <Filter size={18} /> Filtrar Lista
        </button>
      </div>

      {/* TABLA DE ALUMNOS */}
      <div style={{ backgroundColor: "white", borderRadius: "28px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "20px 24px", width: "50px" }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.length === eligibleSubmissions.length && eligibleSubmissions.length > 0}
                  onChange={handleSelectAll}
                  style={{ width: "20px", height: "20px", cursor: "pointer" }} 
                />
              </th>
              <th style={{ padding: "20px 24px", textAlign: "left", color: "#1B396A", fontSize: "0.8rem", fontWeight: "800", textTransform: "uppercase" }}>Estudiante</th>
              <th style={{ padding: "20px 24px", textAlign: "left", color: "#1B396A", fontSize: "0.8rem", fontWeight: "800", textTransform: "uppercase" }}>Estado Revisión</th>
              <th style={{ padding: "20px 24px", textAlign: "center", color: "#1B396A", fontSize: "0.8rem", fontWeight: "800", textTransform: "uppercase" }}>Nota</th>
              <th style={{ padding: "20px 24px", width: "40px" }}></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => {
              const isSelected = selectedIds.includes(s.id);
              const isNoSubmission = s.status === 'no_submission';

              return (
                <tr 
                  key={s.id} 
                  onClick={() => !isNoSubmission && router.push(`/panel/materias/${courseId}/actividades/${assignmentId}/auditoria/${s.id}`)}
                  style={{ 
                    borderBottom: "1px solid #f1f5f9", 
                    cursor: isNoSubmission ? "default" : "pointer", 
                    backgroundColor: isSelected ? "#f0f7ff" : "transparent",
                    opacity: isNoSubmission ? 0.6 : 1,
                    transition: "all 0.2s"
                  }}
                >
                  <td style={{ padding: "20px 24px" }} onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      disabled={isNoSubmission}
                      checked={isSelected} 
                      onChange={() => handleToggleSelect(s.id)} 
                      style={{ width: "20px", height: "20px", cursor: isNoSubmission ? "default" : "pointer" }} 
                    />
                  </td>
                  <td style={{ padding: "20px 24px" }}>
                    <div style={{ fontWeight: "800", color: "#1B396A", fontSize: "1.1rem" }}>{s.name}</div>
                    {s.isLate && <div style={{ color: "#ef4444", fontSize: "0.7rem", fontWeight: "950", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}><ShieldAlert size={12}/> ENTREGA TARDÍA</div>}
                  </td>
                  <td style={{ padding: "20px 24px" }}>
                    <span style={{ 
                      backgroundColor: s.status === 'completed' ? "#dcfce7" : s.status === 'ai_draft' ? "#f3e8ff" : "#f1f5f9", 
                      color: s.status === 'completed' ? "#166534" : s.status === 'ai_draft' ? "#6b21a8" : "#64748b", 
                      padding: "6px 14px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "800" 
                    }}>
                      {s.status === 'completed' ? "● Calificado" : s.status === 'ai_draft' ? "✨ Borrador IA" : s.status === 'pending_ai' ? "En cola IA" : "Sin entrega"}
                    </span>
                  </td>
                  <td style={{ padding: "20px 24px", textAlign: "center" }}>
                    <div style={{ fontWeight: "1000", color: "#1B396A", fontSize: "1.4rem" }}>{s.score || "--"}</div>
                  </td>
                  <td style={{ padding: "20px 24px" }}>
                    {!isNoSubmission && <ChevronRight size={20} color="#cbd5e1" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* PÍLDORA DE ACCIÓN FLOTANTE */}
      {selectedIds.length > 0 && (
        <div style={{ position: "fixed", bottom: "40px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B396A", padding: "12px 12px 12px 24px", borderRadius: "100px", display: "flex", alignItems: "center", gap: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)", zIndex: 1000, border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ backgroundColor: "#D4AF37", color: "#1B396A", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "950" }}>{selectedIds.length}</div>
            <span style={{ color: "white", fontWeight: "700", fontSize: "0.95rem" }}>Seleccionados</span>
          </div>
          <button style={{ backgroundColor: "#8b5cf6", color: "white", border: "none", padding: "12px 28px", borderRadius: "100px", fontWeight: "900", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", transition: "transform 0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            <Wand2 size={18} /> Procesar con IA
          </button>
          <button onClick={() => setSelectedIds([])} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "white", padding: "10px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={20} /></button>
        </div>
      )}
    </div>
  );
}