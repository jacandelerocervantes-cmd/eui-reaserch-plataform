"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, CheckCircle2, Clock, AlertCircle, 
  Search, Eye, Save, Sparkles, BarChart3, Send, Loader2, ChevronRight
} from "lucide-react";

// --- COMPONENTE: ExpandingButton (Diseño Premium EUI) ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", small = false, disabled = false, loading = false }: any) => {
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
      onClick={onClick} disabled={disabled || loading}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: (isHovered || loading) && !disabled ? "8px" : "0px",
        backgroundColor: (isHovered || loading) && !disabled ? style.hoverBg : style.bg, color: style.text, 
        border: `1px solid ${style.border}`, borderRadius: "12px", padding: "0 16px", height: small ? "38px" : "48px",
        fontWeight: "700", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer"
      }}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : (Icon && <Icon size={small ? 16 : 20} />)}
      <span style={{ maxWidth: (isHovered || loading) ? "250px" : "0px", opacity: (isHovered || loading) ? 1 : 0, transition: "0.4s" }}>
        {label}
      </span>
    </button>
  );
};

export default function RevisionExamenPage() {
  const params = useParams();
  const router = useRouter();
  const { id: courseId, examId } = params;

  const [alumnos, setAlumnos] = useState<any[]>([]);
  const [examInfo, setExamInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (examId) fetchData();
  }, [examId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: exam } = await supabase.from('evaluations').select('*, units(name)').eq('id', examId).single();
      setExamInfo(exam);

      // Cargar alumnos y sus respuestas
      const { data: students } = await supabase
        .from('enrollments')
        .select(`
          student_id,
          students (id, matricula, nombres, apellido_paterno, apellido_materno),
          evaluation_responses (id, score_ia, final_score, status, metadata)
        `)
        .eq('course_id', courseId);

      if (students) {
        const formatted = students.map((s: any) => ({
          id: s.students.id,
          matricula: s.students.matricula,
          nombre: `${s.students.apellido_paterno} ${s.students.apellido_materno} ${s.students.nombres}`,
          entregado: s.evaluation_responses.length > 0,
          score_ia: s.evaluation_responses[0]?.score_ia || 0,
          final_score: s.evaluation_responses[0]?.final_score || 0,
          revisado: s.evaluation_responses[0]?.status === 'completed',
          responseId: s.evaluation_responses[0]?.id
        }));
        setAlumnos(formatted);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- ACCIÓN 1: Revisión Masiva IA (Edge Function) ---
  const handleBulkIA = async () => {
    setIsAIProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-evaluate-exams', {
        body: { examId, studentIds: alumnos.filter(a => a.entregado).map(a => a.id) }
      });
      if (error) throw error;
      fetchData(); // Recargar datos tras procesar
    } catch (e: any) { alert("Certeza AIA: " + e.message); }
    finally { setIsAIProcessing(false); }
  };

  // --- ACCIÓN 2: Sincronizar con Sábana (Apps Script Router) ---
  const handleSyncGrades = async () => {
    setIsSyncing(true);
    try {
      const ROUTER_URL = "TU_URL_DEL_ROUTER_PRINCIPAL";
      await fetch(ROUTER_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          action: 'actualizarSabanaNotas', // Esta acción llama a tu función de GAS
          payload: {
            googleSheetId: examInfo?.google_sheet_id, // Si lo tienes guardado
            dataMatrix: {
              unidades: [{ numero: examInfo?.units?.unit_number, nombre: examInfo?.units?.name, criterios: [{ nombre: "Examen", valor: 100 }] }],
              alumnos: alumnos.map(a => ({
                matricula: a.matricula,
                nombre: a.nombre,
                unidades: [{
                  notas: [a.final_score],
                  promedioUnidad: a.final_score
                }],
                promedioFinal: a.final_score
              }))
            }
          }
        })
      });
      alert("Sábana de notas actualizada en Google Sheets.");
    } catch (e) { alert("Error al sincronizar."); }
    finally { setIsSyncing(false); }
  };

  const filteredAlumnos = alumnos.filter(a => 
    a.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.matricula.includes(searchTerm)
  );

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={48} color="#1B396A" />
    </div>
  );

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", backgroundColor: "#F8FAFC", minHeight: "100vh" }}>
      
      {/* HEADER: INFO EXAMEN */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button onClick={() => router.back()} style={{ background: "white", border: "1px solid #e2e8f0", padding: "10px", borderRadius: "12px", cursor: "pointer", color: "#64748b", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}><ArrowLeft size={20}/></button>
          <div>
            <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>{examInfo?.title}</h1>
            <div style={{ display: "flex", gap: "20px", marginTop: "8px", fontSize: "0.9rem", color: "#64748b", fontWeight: "600" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><BarChart3 size={16} /> {examInfo?.units?.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><CheckCircle2 size={16} color="#10b981" /> {alumnos.filter(a => a.entregado).length} / {alumnos.length} Entregas</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={Sparkles} label="Revisión Masiva IA" variant="ai" onClick={handleBulkIA} loading={isAIProcessing} />
          <ExpandingButton icon={Send} label="Notificar Resultados" variant="notify" />
          <ExpandingButton icon={Save} label="Sincronizar Sábana" onClick={handleSyncGrades} variant="success" loading={isSyncing} />
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ backgroundColor: "white", padding: "20px 30px", borderRadius: "20px", border: "1px solid #e2e8f0", marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <div style={{ position: "relative", width: "450px" }}>
          <Search size={20} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o matrícula..." 
            style={{ width: "100%", padding: "14px 14px 14px 48px", borderRadius: "14px", border: "1px solid #e2e8f0", outline: "none", fontSize: "1rem", fontWeight: "500" }} 
          />
        </div>
        <select style={{ padding: "14px 20px", borderRadius: "14px", border: "1px solid #e2e8f0", backgroundColor: "white", color: "#1B396A", fontWeight: "700", outline: "none" }}>
          <option>Todos los alumnos</option>
          <option>Pendientes de entrega</option>
          <option>Por revisar manual</option>
        </select>
      </div>

      {/* TABLA DE REVISIÓN OPERATIVA */}
      <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#F8FAFC", textAlign: "left" }}>
            <tr>
              <th style={{ padding: "20px 30px", color: "#64748b", fontSize: "0.75rem", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.05em" }}>Alumno / Matrícula</th>
              <th style={{ padding: "20px 30px", color: "#64748b", fontSize: "0.75rem", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.05em" }}>Estado</th>
              <th style={{ padding: "20px 30px", color: "#64748b", fontSize: "0.75rem", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.05em" }}>Score IA</th>
              <th style={{ padding: "20px 30px", color: "#64748b", fontSize: "0.75rem", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.05em" }}>Calif. Final</th>
              <th style={{ padding: "20px 30px", color: "#64748b", fontSize: "0.75rem", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlumnos.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: a.entregado ? "white" : "#fafafa", transition: "0.2s" }}>
                <td style={{ padding: "22px 30px" }}>
                  <div style={{ color: "#1B396A", fontWeight: "800", fontSize: "1.05rem" }}>{a.nombre}</div>
                  <div style={{ color: "#94a3b8", fontSize: "0.8rem", fontFamily: "monospace", fontWeight: "600", marginTop: "2px" }}>{a.matricula}</div>
                </td>
                <td style={{ padding: "22px 30px" }}>
                  {a.entregado ? (
                    <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem", fontWeight: "800" }}>
                      <CheckCircle2 size={18} /> Entregado
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem", fontWeight: "800" }}>
                      <Clock size={18} /> Pendiente
                    </span>
                  )}
                </td>
                <td style={{ padding: "22px 30px", color: "#1B396A", fontWeight: "800", fontSize: "1.1rem" }}>
                  {a.entregado ? <span style={{ backgroundColor: "#f0f7ff", padding: "4px 10px", borderRadius: "8px", color: "#2563eb" }}>{a.score_ia}</span> : "--"}
                </td>
                <td style={{ padding: "22px 30px" }}>
                  {a.entregado ? (
                    <input 
                      type="number" 
                      defaultValue={a.final_score} 
                      style={{ width: "80px", padding: "10px", borderRadius: "10px", border: a.revisado ? "1px solid #e2e8f0" : "2px solid #f59e0b", textAlign: "center", fontWeight: "900", color: "#1B396A", fontSize: "1.1rem", outline: "none" }} 
                    />
                  ) : "--"}
                </td>
                <td style={{ padding: "22px 30px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", alignItems: "center" }}>
                    <ExpandingButton small icon={Sparkles} label="Feedback" variant="ai" disabled={!a.entregado} />
                    <ExpandingButton small icon={Eye} label="Revisar" onClick={() => router.push(`${params.examId}/revision/${a.id}`)} variant="secondary" disabled={!a.entregado} />
                    {a.entregado && !a.revisado && (
                      <div title="Requiere validación manual" style={{ color: "#f59e0b", display: "flex", alignItems: "center" }}>
                        <AlertCircle size={22} />
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}