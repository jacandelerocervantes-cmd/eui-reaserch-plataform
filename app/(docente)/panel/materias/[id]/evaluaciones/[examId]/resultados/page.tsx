"use client";

import React, { use, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle2, AlertCircle,
  TrendingUp, ArrowLeft, Download, Sparkles,
  Search, Eye, MessageSquare, Loader2, X, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

type ExamData = { title: string; course_units: { unit_number: number } | null };

type AlumnoResultado = {
  id: string;
  nombre: string;
  matricula: string;
  score: number;
  status: 'Calificado' | 'Pendiente';
  feedback: string;
  // Tendencia Kalman de examen (compute-student-risk-signals) — punto 3.3 de
  // qa-05a-doublecheck-03/04-RECOMENDACIONES-IA-DOCENTE.md: mostrar la
  // tendencia suavizada en la MISMA vista donde se revisa el resultado
  // puntual, no solo en un panel de riesgo separado. null si aún no hay
  // suficiente historial (confianza_insuficiente) o la señal no corrió.
  tendenciaExamenes: number | null;
  tendenciaOutlier: boolean;
};

type FetchResult = { ok: true; examData: ExamData | null; alumnos: AlumnoResultado[] } | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchResultados(courseId: string, examId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    // 1. Datos del examen (tabla correcta: exams)
    const { data: exam } = await supabase
      .from('exams')
      .select('*, course_units(*)')
      .eq('id', examId)
      .single();

    // 2. Alumnos inscritos
    const { data: studentsListRaw } = await supabase
      .from('students')
      .select('id, matricula, nombres, apellido_paterno, apellido_materno')
      .eq('course_id', courseId)
      .order('apellido_paterno', { ascending: true });
    const studentsList = studentsListRaw as {
      id: string; matricula: string; nombres: string; apellido_paterno: string; apellido_materno: string | null;
    }[] | null;

    let alumnos: AlumnoResultado[] = [];
    if (studentsList) {
      const studentIds = studentsList.map((s) => s.id);

      // 3. Respuestas por separado
      const { data: evResponsesRaw } = await supabase
        .from('evaluation_responses')
        .select('student_id, final_score, score_ia, status, feedback_ia')
        .eq('exam_id', examId)
        .in('student_id', studentIds);
      const evResponses = evResponsesRaw as {
        student_id: string; final_score: number | null; score_ia: number | null; status: string; feedback_ia: string | null;
      }[] | null;

      // Tendencia Kalman de examen — kalman_states no es legible directo por
      // el cliente (RLS sin policies para authenticated, service-role-only),
      // así que se reusa compute-student-risk-signals (ya expone
      // promedio_examenes_suavizado/outlier por alumno del curso completo,
      // no solo de este examen — es la tendencia agregada de exámenes, el
      // dato correcto para contrastar contra ESTE resultado puntual).
      // Best-effort: si falla, la tabla sigue mostrando el resto sin tendencia.
      let riskByStudent = new Map<string, { suavizado: number | null; outlier: boolean }>();
      try {
        const { data: riskData } = await supabase.functions.invoke('compute-student-risk-signals', {
          body: { course_id: courseId }
        });
        const riskStudents = riskData?.data?.students as {
          student_id: string; promedio_examenes_suavizado: number | null; promedio_examenes_outlier: boolean;
        }[] | undefined;
        if (riskStudents) {
          riskByStudent = new Map(riskStudents.map((r) => [r.student_id, { suavizado: r.promedio_examenes_suavizado, outlier: r.promedio_examenes_outlier }]));
        }
      } catch (e) { console.error("No se pudo cargar la tendencia Kalman de exámenes:", e); }

      alumnos = studentsList.map((s) => {
        const resp = evResponses?.find((r) => r.student_id === s.id);
        const tendencia = riskByStudent.get(s.id);
        return {
          id:       s.id,
          nombre:   `${s.apellido_paterno} ${s.apellido_materno ?? ''} ${s.nombres}`.trim(),
          matricula: s.matricula,
          score:    resp?.final_score ?? 0,
          status:   resp?.status === 'completed' ? 'Calificado' : 'Pendiente',
          feedback: resp?.feedback_ia ?? "Sin retroalimentación.",
          tendenciaExamenes: tendencia?.suavizado ?? null,
          tendenciaOutlier: tendencia?.outlier ?? false,
        };
      });
    }

    return { ok: true, examData: exam ?? null, alumnos };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudieron cargar los resultados del examen." };
  }
}

function ResultadosContent({ resource, courseId, examId, onRetry }: { resource: Promise<FetchResult>; courseId: string; examId: string; onRetry: () => void }) {
  const result = use(resource);
  const router = useRouter();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiInsight, setAiInsight] = useState("Haz clic en 'Análisis Grupal IA' para obtener conclusiones pedagógicas.");
  const [feedbackModal, setFeedbackModal] = useState<AlumnoResultado | null>(null);

  if (!result.ok) return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444" }}>
      <p style={{ fontWeight: "700" }}>{result.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { examData, alumnos } = result;

  // --- LÓGICA: ANÁLISIS IA ---
  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-exam-group-results', {
        body: { examId }
      });
      if (error) throw error;
      setAiInsight(data.insight);
    } catch (e) { setAiInsight("Error al generar análisis: " + (e instanceof Error ? e.message : String(e))); }
    finally { setIsAnalyzing(false); }
  };

  // --- LÓGICA: EXPORTAR A SHEET (Via edge function) ---
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { error } = await supabase.functions.invoke('sync-grading-matrix', {
        body: {
          courseId,
          matrixData: {
            unidades: [{
              numero: examData?.course_units?.unit_number ?? 1,
              nombre: examData?.title ?? "Examen",
              criterios: [{ nombre: examData?.title ?? "Examen", valor: 100 }],
            }],
            alumnos: alumnos.map(a => ({
              matricula: a.matricula,
              nombre: a.nombre,
              unidades: [{ notas: [a.score], promedioUnidad: a.score }],
              promedioFinal: a.score,
            })),
          },
        }
      });
      if (error) throw error;
      alert("✅ Sábana de Notas actualizada exitosamente.");
    } catch (e) { alert("Error al exportar: " + (e instanceof Error ? e.message : String(e))); }
    finally { setIsExporting(false); }
  };

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
          <ExpandingButton icon={Download} label="Actualizar Sábana" onClick={handleExport} loading={isExporting} variant="secondary" size={44} smallSize={36} radius={10} gap={8} padding="0 12px" fontWeight={700} durationMs={300} />
          <ExpandingButton icon={Sparkles} label="Análisis Grupal IA" onClick={handleAIAnalysis} loading={isAnalyzing} variant="ai" size={44} smallSize={36} radius={10} gap={8} padding="0 12px" fontWeight={700} durationMs={300} />
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
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800" }} title="Tendencia suavizada (Kalman) de exámenes del alumno en todo el curso, no solo este examen">TENDENCIA</th>
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
                <td style={{ padding: "18px 25px" }}>
                  {a.tendenciaExamenes === null ? (
                    <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Sin historial suficiente</span>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#334155", fontSize: "0.9rem" }}>
                      {a.tendenciaExamenes.toFixed(1)}
                      {a.tendenciaOutlier && (
                        <span title="Esta calificación rompe con la tendencia suavizada del alumno — vale la pena revisarla" style={{ color: "#f59e0b" }}>
                          <AlertCircle size={14} />
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td style={{ padding: "18px 25px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <ExpandingButton small smallSize={36} icon={MessageSquare} label="Ver Feedback" variant="secondary" onClick={() => setFeedbackModal(a)} disabled={!a.feedback || a.feedback === "Sin retroalimentación."} radius={10} gap={8} padding="0 12px" fontWeight={700} durationMs={300} />
                    <ExpandingButton small smallSize={36} icon={Eye} label="Revisar" variant="secondary" onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/${examId}/revision/${a.id}`)} radius={10} gap={8} padding="0 12px" fontWeight={700} durationMs={300} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {feedbackModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) setFeedbackModal(null); }}>
          <div style={{ backgroundColor: "white", borderRadius: "20px", padding: "30px", maxWidth: "480px", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "800" }}>{feedbackModal.nombre}</h3>
              <button onClick={() => setFeedbackModal(null)} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <p style={{ color: "#334155", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{feedbackModal.feedback}</p>
          </div>
        </div>
      )}

      <style jsx>{` @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; } `}</style>
    </div>
  );
}

// Sub-componente para las tarjetas
const StatCard = ({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) => (
  <div style={{ backgroundColor: "white", padding: "25px", borderRadius: "20px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "20px" }}>
    <div style={{ backgroundColor: `${color}10`, color: color, padding: "12px", borderRadius: "12px" }}><Icon size={28} /></div>
    <div>
      <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", fontWeight: "700" }}>{label}</p>
      <h2 style={{ margin: 0, color: "#1B396A", fontSize: "1.8rem", fontWeight: "900" }}>{value}</h2>
    </div>
  </div>
);

export default function ResultadosExamen() {
  const { id: courseId, examId } = useParams() as { id: string; examId: string };
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchResultados(courseId, examId, reloadKey), [courseId, examId, reloadKey]);

  return (
    <Suspense fallback={<div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="animate-spin" size={48} color="#1B396A" /></div>}>
      <ResultadosContent resource={resource} courseId={courseId} examId={examId} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
