"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatStudentName } from "@/lib/formatStudentName";
import {
  CheckCircle2, AlertCircle,
  TrendingUp, Download, Sparkles,
  Search, Eye, MessageSquare, Loader2, X, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import StatCard from "@/components/ui/StatCard";

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
  // Isolation Forest sobre features de la entrega (violaciones/min, relación
  // de duración, tiempos entre respuesta) — señal COMPLEMENTARIA a la
  // tendencia de arriba, nunca bloquea nada, solo marca qué revisar con más
  // atención. null si esta entrega no tiene datos de timing (previas al
  // cambio en useExamSession.ts) o si aún no hay suficientes entregas para
  // correr el bosque.
  anomalyScore: number | null;
  anomalySuspicious: boolean;
};

type FetchResult = { ok: true; examData: ExamData | null; alumnos: AlumnoResultado[] } | { ok: false; error: string };

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

      // Anomalías de ESTE examen puntual (Isolation Forest) — a diferencia
      // de la tendencia de arriba (agregada de todo el curso), esta señal es
      // específica de esta entrega. Best-effort: si falla o no hay
      // suficientes entregas con timing, la tabla sigue mostrando el resto
      // sin marca de anomalía (nunca rompe la pantalla).
      let anomalyByStudent = new Map<string, { score: number; suspicious: boolean }>();
      try {
        const { data: anomalyData } = await supabase.functions.invoke('detect-exam-anomalies', {
          body: { exam_id: examId }
        });
        const anomalyResults = anomalyData?.data?.results as
          { student_id: string; score: number; suspicious: boolean }[] | undefined;
        if (anomalyData?.data?.ran && anomalyResults) {
          anomalyByStudent = new Map(anomalyResults.map((r) => [r.student_id, { score: r.score, suspicious: r.suspicious }]));
        }
      } catch (e) { console.error("No se pudo correr la detección de anomalías del examen:", e); }

      alumnos = studentsList.map((s) => {
        const resp = evResponses?.find((r) => r.student_id === s.id);
        const tendencia = riskByStudent.get(s.id);
        const anomaly = anomalyByStudent.get(s.id);
        return {
          id:       s.id,
          nombre:   formatStudentName(s),
          matricula: s.matricula,
          score:    resp?.final_score ?? 0,
          status:   resp?.status === 'completed' ? 'Calificado' : 'Pendiente',
          feedback: resp?.feedback_ia ?? "Sin retroalimentación.",
          tendenciaExamenes: tendencia?.suavizado ?? null,
          tendenciaOutlier: tendencia?.outlier ?? false,
          anomalyScore: anomaly?.score ?? null,
          anomalySuspicious: anomaly?.suspicious ?? false,
        };
      });
    }

    return { ok: true, examData: exam ?? null, alumnos };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudieron cargar los resultados del examen." };
  }
}

function ResultadosContent({ courseId, examId, reloadKey, onRetry }: { courseId: string; examId: string; reloadKey: number; onRetry: () => void }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FetchResult>({ ok: false, error: "" });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiInsight, setAiInsight] = useState("Haz clic en 'Análisis Grupal IA' para obtener conclusiones pedagógicas.");
  const [feedbackModal, setFeedbackModal] = useState<AlumnoResultado | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionToast, setActionToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!actionToast) return;
    const t = setTimeout(() => setActionToast(null), 4000);
    return () => clearTimeout(t);
  }, [actionToast]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchResultados(courseId, examId, reloadKey).then((r) => {
      if (!isMounted) return;
      setResult(r);
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [courseId, examId, reloadKey]);

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={48} color="#1B396A" />
    </div>
  );

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
      setActionToast({ type: 'success', message: "Sábana de Notas actualizada exitosamente." });
    } catch (e) { setActionToast({ type: 'error', message: "Error al exportar: " + (e instanceof Error ? e.message : String(e)) }); }
    finally { setIsExporting(false); }
  };

  const promedioGrupal = alumnos.length > 0 ? (alumnos.reduce((acc, a) => acc + a.score, 0) / alumnos.length).toFixed(1) : 0;
  const aprobados = alumnos.filter(a => a.score >= 70).length;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const alumnosFiltrados = normalizedQuery
    ? alumnos.filter((a) => a.nombre.toLowerCase().includes(normalizedQuery) || a.matricula.toLowerCase().includes(normalizedQuery))
    : alumnos;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", backgroundColor: "#F8FAFC", minHeight: "100vh" }}>
      {actionToast && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 1000, maxWidth: "420px",
          backgroundColor: actionToast.type === "success" ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${actionToast.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          color: actionToast.type === "success" ? "#166534" : "#991b1b",
          padding: "14px 18px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
        }}>
          <span>{actionToast.message}</span>
          <button
            type="button"
            onClick={() => setActionToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", lineHeight: 0, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "900", margin: 0 }}>Resultados: {examData?.title}</h1>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <ExpandingButton icon={Download} label="Actualizar Sábana" onClick={handleExport} loading={isExporting} variant="secondary" size={44} smallSize={36} radius={10} gap={8} padding="0 12px" fontWeight={700} durationMs={300} />
          <ExpandingButton icon={Sparkles} label="Análisis Grupal IA" onClick={handleAIAnalysis} loading={isAnalyzing} variant="ai" size={44} smallSize={36} radius={10} gap={8} padding="0 12px" fontWeight={700} durationMs={300} />
        </div>
      </div>

      {/* STATS CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "40px" }}>
        <StatCard label="Promedio Grupal" value={promedioGrupal} icon={TrendingUp} color="#1B396A" />
        <StatCard label="Aprobados" value={`${aprobados}/${alumnos.length}`} icon={CheckCircle2} color="#10b981" />
        <StatCard label="Por Calificar" value={alumnos.filter(a => a.status !== 'Calificado').length} icon={AlertCircle} color="#f59e0b" />
      </div>

      {/* AI INSIGHTS BOX */}
      <div style={{ backgroundColor: "#1B396A10", padding: "25px", borderRadius: "20px", border: "1px solid #1B396A25", marginBottom: "40px", display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <div style={{ backgroundColor: "#1B396A", color: "white", padding: "10px", borderRadius: "50%", flexShrink: 0 }}>
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
            <input
              placeholder="Buscar alumno..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: "10px 15px 10px 40px", borderRadius: "10px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem" }}
            />
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#F8FAFC", textAlign: "left" }}>
            <tr>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800" }}>NOMBRE DEL ALUMNO</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800" }}>ESTADO</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800" }}>CALIFICACIÓN</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800" }} title="Tendencia suavizada (Kalman) de exámenes del alumno en todo el curso, no solo este examen">TENDENCIA</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800" }} title="Isolation Forest sobre esta entrega puntual (violaciones/min, duración, tiempos de respuesta) — señal de alerta, no bloquea nada">ANOMALÍA</th>
              <th style={{ padding: "15px 25px", color: "#64748b", fontSize: "0.8rem", fontWeight: "800", textAlign: "right" }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {alumnosFiltrados.map((a) => (
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
                <td style={{ padding: "18px 25px" }}>
                  {a.anomalyScore === null ? (
                    <span style={{ color: "#cbd5e1", fontSize: "0.85rem" }}>—</span>
                  ) : (
                    <span
                      title="Score de Isolation Forest sobre esta entrega — no es prueba de nada, solo indica qué revisar primero"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "8px",
                        fontSize: "0.8rem", fontWeight: 700,
                        backgroundColor: a.anomalySuspicious ? "#fef2f2" : "#f8fafc",
                        color: a.anomalySuspicious ? "#dc2626" : "#94a3b8",
                      }}
                    >
                      {a.anomalySuspicious && <AlertCircle size={13} />}
                      {a.anomalyScore.toFixed(2)}
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

export default function ResultadosExamen() {
  const { id: courseId, examId } = useParams() as { id: string; examId: string };
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <ResultadosContent courseId={courseId} examId={examId} reloadKey={reloadKey} onRetry={() => setReloadKey((k) => k + 1)} />
  );
}
