"use client";

import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2, Clock, AlertCircle,
  Search, Eye, Save, Sparkles, BarChart3, Send, Loader2, X, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useEvaluacionDetalle, useEvaluacionDetalleContent } from "./_hooks/useEvaluacionDetalle";

function RevisionContent({ resource, courseId, examId, onReload }: { resource: ReturnType<typeof useEvaluacionDetalle>["resource"]; courseId: string; examId: string; onReload: () => void }) {
  const router = useRouter();
  const {
    result,
    examInfo,
    alumnos,
    filteredAlumnos,
    isAIProcessing,
    isSyncing,
    isNotifying,
    searchTerm, setSearchTerm,
    feedbackModal, setFeedbackModal,
    savingScoreId,
    handleBulkIA,
    handleSyncGrades,
    handleNotify,
    handleSaveScore,
  } = useEvaluacionDetalleContent(resource, courseId, examId, onReload);

  if (!result.ok) return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444" }}>
      <p style={{ fontWeight: "700" }}>{result.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onReload} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", backgroundColor: "#F8FAFC", minHeight: "100vh" }}>

      {/* HEADER: INFO EXAMEN */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>{examInfo?.title}</h1>
          <div style={{ display: "flex", gap: "20px", marginTop: "8px", fontSize: "0.9rem", color: "#64748b", fontWeight: "600" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><BarChart3 size={16} /> {examInfo?.course_units?.title}</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><CheckCircle2 size={16} color="#10b981" /> {alumnos.filter(a => a.entregado).length} / {alumnos.length} Entregas</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={Sparkles} label="Revisión Masiva IA" variant="ai" onClick={handleBulkIA} loading={isAIProcessing} size={48} smallSize={38} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={400} iconSize={20} expandedLabelMaxWidth="250px" />
          <ExpandingButton icon={Send} label="Notificar Resultados" variant="notify" onClick={handleNotify} loading={isNotifying} size={48} smallSize={38} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={400} iconSize={20} expandedLabelMaxWidth="250px" />
          <ExpandingButton icon={Save} label="Sincronizar Sábana" onClick={handleSyncGrades} variant="success" loading={isSyncing} size={48} smallSize={38} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={400} iconSize={20} expandedLabelMaxWidth="250px" />
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
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val !== a.final_score) handleSaveScore(a, val);
                      }}
                      disabled={savingScoreId === a.id}
                      style={{ width: "80px", padding: "10px", borderRadius: "10px", border: a.revisado ? "1px solid #e2e8f0" : "2px solid #f59e0b", textAlign: "center", fontWeight: "900", color: "#1B396A", fontSize: "1.1rem", outline: "none" }}
                    />
                  ) : "--"}
                </td>
                <td style={{ padding: "22px 30px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", alignItems: "center" }}>
                    <ExpandingButton small smallSize={38} icon={Sparkles} label="Feedback" variant="ai" disabled={!a.entregado} onClick={() => setFeedbackModal(a)} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={400} expandedLabelMaxWidth="250px" />
                    <ExpandingButton small smallSize={38} icon={Eye} label="Revisar" onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/${examId}/revision/${a.id}`)} variant="secondary" disabled={!a.entregado} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={400} expandedLabelMaxWidth="250px" />
                    {a.entregado && !a.revisado && (
                      <div title="Requiere validación manual" style={{ color: "#f59e0b", display: "flex", alignItems: "center" }}>
                        <AlertCircle size={22} />
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredAlumnos.length === 0 && (
              <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>No hay alumnos que coincidan, o este examen no tiene audiencia asignada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: feedback rápido sin salir de la página */}
      {feedbackModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) setFeedbackModal(null); }}>
          <div style={{ backgroundColor: "white", borderRadius: "20px", padding: "30px", maxWidth: "480px", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "800" }}>{feedbackModal.nombre}</h3>
              <button onClick={() => setFeedbackModal(null)} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <p style={{ color: "#334155", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{feedbackModal.feedback || "Sin retroalimentación generada todavía."}</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

export default function RevisionExamenPage() {
  const { id: courseId, examId } = useParams() as { id: string; examId: string };
  const { resource, reloadKey, onReload } = useEvaluacionDetalle(courseId, examId);

  return (
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={48} color="#1B396A" />
      </div>
    }>
      <RevisionContent key={reloadKey} resource={resource} courseId={courseId} examId={examId} onReload={onReload} />
    </Suspense>
  );
}
