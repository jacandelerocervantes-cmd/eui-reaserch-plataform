"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Wand2, CheckCircle2, MessageSquare, Save, 
  ChevronLeft, ChevronRight, Loader2, ArrowLeft,
  AlertTriangle, Info, Check, X
} from "lucide-react";

// --- COMPONENTE PREMIUM: ExpandingButton (EUI Standard) ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", disabled = false, loading = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", text: "white" };
      case "success": return { bg: "#10b981", text: "white" };
      case "danger":  return { bg: "#ef4444", text: "white" };
      default:        return { bg: "white", text: "#1B396A" };
    }
  };
  const style = getStyles();
  const expanded = isHovered || loading;

  return (
    <button
      onClick={onClick} disabled={disabled || loading} 
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: expanded ? "10px" : "0px",
        backgroundColor: style.bg, color: style.text, borderRadius: "14px", border: "none",
        padding: expanded ? "0 20px" : "0", height: "52px", fontWeight: "900", cursor: "pointer",
        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)", overflow: "hidden", minWidth: "52px"
      }}
    >
      {loading ? <Loader2 size={22} className="animate-spin" /> : (Icon && <Icon size={22} />)}
      <span style={{ maxWidth: expanded ? "200px" : "0px", opacity: expanded ? 1 : 0, transition: "0.3s" }}>{label}</span>
    </button>
  );
};

export default function AuditoriaExamenIndividual() {
  const params = useParams();
  const router = useRouter();
  const { id: courseId, examId, studentId } = params;

  // ESTADOS DE CARGA Y DATOS
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exam, setExam] = useState<any>(null);
  const [response, setResponse] = useState<any>(null);
  
  // ESTADOS DE CALIFICACIÓN (ADN Actividades)
  const [questionScores, setQuestionScores] = useState<any>({});
  const [feedback, setFeedback] = useState("");
  const [manualAlert, setManualAlert] = useState(false);

  useEffect(() => {
    if (studentId && examId) fetchAuditData();
  }, [studentId, examId]);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      // 1. Traer datos del examen y sus reactivos
      const { data: ex } = await supabase.from('evaluations').select('*, units(name)').eq('id', examId).single();
      setExam(ex);

      // 2. Traer respuesta del alumno
      const { data: res } = await supabase.from('evaluation_responses')
        .select(`*, students(*)`)
        .eq('evaluation_id', examId)
        .eq('student_id', studentId)
        .single();

      if (res) {
        setResponse(res);
        setQuestionScores(res.metadata?.respuestas_puntos || {});
        setFeedback(res.feedback_manual || "");
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // CÁLCULO DINÁMICO (ADN Actividades)
  const totalGrade = useMemo(() => {
    const sum = Object.values(questionScores).reduce((a: any, b: any) => Number(a) + Number(b), 0);
    return Number(sum);
  }, [questionScores]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('evaluation_responses')
        .update({
          final_score: totalGrade,
          feedback_manual: feedback,
          metadata: { ...response.metadata, respuestas_puntos: questionScores },
          status: 'completed'
        })
        .eq('id', response.id);
      if (error) throw error;
      alert("Auditoría guardada exitosamente.");
    } catch (e) { alert("Error al guardar."); } finally { setIsSaving(false); }
  };

  if (loading) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="animate-spin" size={48} color="#1B396A" /></div>;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "white" }}>
      
      {/* HEADER DE NAVEGACIÓN (Switcher de Alumnos) */}
      <div style={{ height: "85px", padding: "0 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8h0", backgroundColor: "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button onClick={() => router.back()} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}><ArrowLeft /></button>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "950", color: "#1B396A" }}>{response?.students?.apellido_paterno}, {response?.students?.nombres}</h2>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "900", textTransform: "uppercase" }}>{response?.students?.matricula} • Auditoría Certeza AIA</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px", marginRight: "10px" }}>
             <button style={{ width: "48px", height: "48px", borderRadius: "14px", border: "1px solid #cbd5e1", background: "white", color: "#1B396A", cursor: "pointer" }}><ChevronLeft /></button>
             <button style={{ width: "48px", height: "48px", borderRadius: "14px", border: "1px solid #cbd5e1", background: "white", color: "#1B396A", cursor: "pointer" }}><ChevronRight /></button>
          </div>
          <ExpandingButton icon={Save} label="Guardar y Siguiente" onClick={handleSave} loading={isSaving} variant="primary" />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* PANEL CENTRAL: VISOR DE REACTIVOS (Evidencia) */}
        <div style={{ flex: 1, backgroundColor: "#f1f5f9", overflowY: "auto", padding: "40px" }}>
          <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "25px" }}>
            {exam?.reactivos_json?.map((q: any, idx: number) => {
              const resAlumno = response?.metadata?.respuestas?.[idx];
              const scoreActual = questionScores[idx] || 0;
              const esCorrecto = resAlumno === q.answer;

              return (
                <div key={idx} style={{ backgroundColor: "white", borderRadius: "24px", padding: "35px", border: "1px solid #e2e8f0", boxShadow: "0 4px 15px rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "25px" }}>
                    <span style={{ color: "#94a3b8", fontWeight: "900", fontSize: "0.8rem", textTransform: "uppercase" }}>Reactivo {idx + 1} • {q.type}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {esCorrecto ? <CheckCircle2 color="#10b981" size={18}/> : <AlertTriangle color="#f59e0b" size={18}/>}
                      <span style={{ fontWeight: "900", color: "#1B396A" }}>{scoreActual} / {q.points} PTS</span>
                    </div>
                  </div>

                  <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", lineHeight: 1.4 }}>{q.content}</h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
                    <div style={{ padding: "20px", backgroundColor: "#f8fafc", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase" }}>Respuesta Alumno</span>
                      <p style={{ margin: "8px 0 0", fontWeight: "700", color: "#1B396A" }}>{resAlumno || "(En blanco)"}</p>
                    </div>
                    <div style={{ padding: "20px", backgroundColor: "#f0fdf4", borderRadius: "16px", border: "1px solid #dcfce7" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: "900", color: "#10b981", textTransform: "uppercase" }}>Clave Correcta</span>
                      <p style={{ margin: "8px 0 0", fontWeight: "700", color: "#166534" }}>{q.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL DERECHO: CONSOLA DE AJUSTE (ADN Actividades) */}
        <div style={{ width: "450px", borderLeft: "1px solid #e2e8f0", backgroundColor: "#fdfdfd", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "40px" }}>
            
            <div style={{ backgroundColor: "#f5f3ff", padding: "20px", borderRadius: "20px", marginBottom: "40px", border: "1px solid #ddd6fe", display: "flex", gap: "15px", alignItems: "center" }}>
              <div style={{ backgroundColor: "#8b5cf6", padding: "10px", borderRadius: "12px", color: "white" }}><Wand2 size={24}/></div>
              <div>
                <div style={{ fontWeight: "900", color: "#6b21a8", fontSize: "0.95rem" }}>Sugerencia IA: {response?.score_ia}</div>
                <div style={{ fontSize: "0.75rem", color: "#7c3aed" }}>Análisis semántico completado</div>
              </div>
            </div>

            {/* SLIDERS DINÁMICOS POR REACTIVO */}
            <h4 style={{ color: "#1B396A", fontWeight: "900", marginBottom: "20px", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Ajuste por Reactivo</h4>
            {exam?.reactivos_json?.map((q: any, idx: number) => (
              <div key={idx} style={{ marginBottom: "25px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontWeight: "700", color: "#64748b", fontSize: "0.85rem" }}>R{idx + 1}</span>
                  <input 
                    type="number" value={questionScores[idx] || 0} 
                    onChange={(e) => setQuestionScores({...questionScores, [idx]: parseInt(e.target.value)})}
                    style={{ width: "50px", textAlign: "center", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: "800", color: "#1B396A" }}
                  />
                </div>
                <input 
                  type="range" min="0" max={q.points} value={questionScores[idx] || 0} 
                  onChange={(e) => setQuestionScores({...questionScores, [idx]: parseInt(e.target.value)})}
                  style={{ width: "100%", accentColor: "#1B396A", cursor: "pointer" }}
                />
              </div>
            ))}

            <div style={{ marginTop: "40px" }}>
              <div style={{ fontWeight: "900", color: "#1B396A", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}><MessageSquare size={18}/> Correcciones Técnicas</div>
              <textarea 
                value={feedback} onChange={(e) => setFeedback(e.target.value)}
                placeholder="Escribe la retroalimentación técnica..."
                style={{ width: "100%", height: "150px", padding: "20px", borderRadius: "20px", border: "2px solid #f1f5f9", outline: "none", resize: "none" }}
              />
            </div>

            {/* BOTÓN ROJO DE ALERTA (TU REQUERIMIENTO) */}
            <button 
              onClick={() => setManualAlert(!manualAlert)}
              style={{ width: "100%", marginTop: "20px", padding: "15px", borderRadius: "15px", border: "none", backgroundColor: manualAlert ? "#ef4444" : "#fef2f2", color: manualAlert ? "white" : "#ef4444", fontWeight: "800", cursor: "pointer", transition: "0.3s", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
            >
              <AlertTriangle size={18} /> {manualAlert ? "Entrega Marcada con Error" : "Marcar Error en Entrega"}
            </button>
          </div>

          {/* FOOTER DE NOTA FINAL */}
          <div style={{ padding: "35px", borderTop: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "900", textTransform: "uppercase" }}>Calificación Auditada</div>
                <div style={{ fontSize: "3rem", fontWeight: "1000", color: manualAlert ? "#ef4444" : "#1B396A" }}>{totalGrade.toFixed(1)}</div>
              </div>
              <ExpandingButton icon={CheckCircle2} label="Finalizar Auditoría" onClick={handleSave} variant="success" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}