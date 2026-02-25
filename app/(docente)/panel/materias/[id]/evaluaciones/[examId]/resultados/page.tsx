"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  BarChart3, Users, CheckCircle2, AlertCircle, 
  TrendingUp, ArrowLeft, Download, Sparkles, 
  Search, Eye, MessageSquare, Loader2
} from "lucide-react";

// --- COMPONENTE: ExpandingButton (EUI Standard) ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", small = false, loading = false, disabled = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
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
      onClick={onClick} disabled={disabled || loading}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: (isHovered || loading) && !disabled ? "8px" : "0px",
        backgroundColor: (isHovered || loading) && !disabled ? style.hoverBg : style.bg, color: style.text, 
        border: `1px solid ${style.border}`, borderRadius: "10px", padding: "0 12px", height: small ? "36px" : "44px",
        fontWeight: "700", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer"
      }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : (Icon && <Icon size={small ? 16 : 18} />)}
      <span style={{ maxWidth: (isHovered || loading) ? "200px" : "0px", opacity: (isHovered || loading) ? 1 : 0, transition: "0.3s" }}>{label}</span>
    </button>
  );
};

export default function ResultadosExamen() {
  const params = useParams();
  const router = useRouter();
  const { id: courseId, examId } = params;

  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [examData, setExamData] = useState<any>(null);
  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState("Haz clic en 'Análisis Grupal IA' para obtener conclusiones pedagógicas.");

  useEffect(() => {
    if (examId) fetchResultados();
  }, [examId]);

  const fetchResultados = async () => {
    setLoading(true);
    try {
      const { data: exam } = await supabase.from('evaluations').select('*, units(*)').eq('id', examId).single();
      setExamData(exam);

      const { data: responses } = await supabase
        .from('enrollments')
        .select(`
          student_id,
          students (id, matricula, nombres, apellido_paterno, apellido_materno),
          evaluation_responses (id, score_ia, final_score, status, feedback_ia)
        `)
        .eq('course_id', courseId);

      if (responses) {
        setAlumnos(responses.map((r: any) => ({
          id: r.students.id,
          nombre: `${r.students.apellido_paterno} ${r.students.apellido_materno} ${r.students.nombres}`,
          matricula: r.students.matricula,
          score: r.evaluation_responses[0]?.final_score || 0,
          status: r.evaluation_responses[0]?.status === 'completed' ? 'Calificado' : 'Pendiente',
          feedback: r.evaluation_responses[0]?.feedback_ia || "Sin retroalimentación."
        })));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- LÓGICA: ANÁLISIS IA ---
  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-exam-group-results', {
        body: { examId }
      });
      if (error) throw error;
      setAiInsight(data.insight);
    } catch (e: any) { setAiInsight("Error al generar análisis: " + e.message); }
    finally { setIsAnalyzing(false); }
  };

  // --- LÓGICA: EXPORTAR A SHEET (Via Router Principal) ---
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const ROUTER_URL = "URL_TU_ROUTER_PRINCIPAL";
      const payload = {
        googleSheetId: examData?.google_sheet_id || "ID_POR_DEFECTO",
        dataMatrix: {
          unidades: [{
            numero: examData?.units?.unit_number,
            nombre: examData?.units?.name,
            criterios: [{ nombre: "Examen", valor: 100 }]
          }],
          alumnos: alumnos.map(a => ({
            matricula: a.matricula,
            nombre: a.nombre,
            unidades: [{
              notas: [a.score],
              promedioUnidad: a.score
            }],
            promedioFinal: a.score
          }))
        }
      };

      await fetch(ROUTER_URL, {
        method: "POST", mode: "no-cors",
        body: JSON.stringify({ action: 'actualizarSabanaNotas', payload })
      });
      alert("✅ Sábana de Notas actualizada exitosamente.");
    } catch (e) { alert("Error al exportar."); }
    finally { setIsExporting(false); }
  };

  if (loading) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="animate-spin" size={48} color="#1B396A" /></div>;

  const promedioGrupal = alumnos.length > 0 ? (alumnos.reduce((acc, a) => acc + a.score, 0) / alumnos.length).toFixed(1) : 0;
  const aprobados = alumnos.filter(a => a.score >= 70).length;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", backgroundColor: "#F8FAFC", minHeight: "100vh" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><ArrowLeft /></button>
          <div>
            <h1 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "900", margin: 0 }}>Resultados: {examData?.title}</h1>
            <p style={{ color: "#64748b", margin: 0 }}>Análisis detallado de rendimiento y retroalimentación IA.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <ExpandingButton icon={Download} label="Actualizar Sábana" onClick={handleExport} loading={isExporting} variant="secondary" />
          <ExpandingButton icon={Sparkles} label="Análisis Grupal IA" onClick={handleAIAnalysis} loading={isAnalyzing} variant="ai" />
        </div>
      </div>

      

      {/* STATS CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "40px" }}>
        <StatCard label="Promedio Grupal" value={promedioGrupal} icon={TrendingUp} color="#2563eb" />
        <StatCard label="Aprobados" value={`${aprobados}/${alumnos.length}`} icon={CheckCircle2} color="#10b981" />
        <StatCard label="Por Calificar" value={alumnos.filter(a => a.status !== 'Calificado').length} icon={AlertCircle} color="#f59e0b" />
      </div>

      {/* AI INSIGHTS BOX */}
      <div style={{ backgroundColor: "#f0f7ff", padding: "25px", borderRadius: "20px", border: "1px solid #bfdbfe", marginBottom: "40px", display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <div style={{ backgroundColor: "#2563eb", color: "white", padding: "10px", borderRadius: "50%", flexShrink: 0 }}>
          {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
        </div>
        <div>
          <h4 style={{ margin: "0 0 8px 0", color: "#1B396A", fontWeight: "800" }}>Resumen de Inteligencia Artificial</h4>
          <p style={{ margin: 0, color: "#1e293b", fontSize: "0.95rem", lineHeight: "1.5" }}>{aiInsight}</p>
        </div>
      </div>

      {/* TABLA DE ALUMNOS */}
      <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
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
                <td style={{ padding: "18px 25px", color: "#1B396A", fontWeight: "600" }}>
                  {a.nombre}
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontFamily: "monospace" }}>{a.matricula}</div>
                </td>
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
      <style jsx>{` @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; } `}</style>
    </div>
  );
}

// Sub-componente para las tarjetas
const StatCard = ({ label, value, icon: Icon, color }: any) => (
  <div style={{ backgroundColor: "white", padding: "25px", borderRadius: "20px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "20px" }}>
    <div style={{ backgroundColor: `${color}10`, color: color, padding: "12px", borderRadius: "12px" }}><Icon size={28} /></div>
    <div>
      <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", fontWeight: "700" }}>{label}</p>
      <h2 style={{ margin: 0, color: "#1B396A", fontSize: "1.8rem", fontWeight: "900" }}>{value}</h2>
    </div>
  </div>
);