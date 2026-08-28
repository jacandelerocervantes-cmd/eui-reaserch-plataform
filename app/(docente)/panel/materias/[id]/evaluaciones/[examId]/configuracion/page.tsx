"use client";

import { useParams } from "next/navigation";
import { Sparkles, Save, Loader2, AlertCircle, AlertTriangle, ExternalLink, FileSpreadsheet } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { QuestionCard } from "../../_components/QuestionCard";
import { AudienceSelector } from "../../_components/AudienceSelector";
import { ScoreBar } from "../../_components/ScoreBar";
import { SecuritySettings } from "../../_components/SecuritySettings";
import { ExamHeaderNav } from "../../_components/ExamHeaderNav";
import { EmptyQuestionsState } from "../../_components/EmptyQuestionsState";
import type { EditQuestion } from "../../_components/questionMapping";
import { useConfiguracionExamen } from "./_hooks/useConfiguracionExamen";

export default function ConfiguracionExamenPage() {
  const params = useParams();
  const courseId = params?.id as string;
  const examId = params?.examId as string;
  const e = useConfiguracionExamen(courseId, examId);

  if (e.loading) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="animate-spin" size={48} color="#1B396A" /></div>;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#F8FAFC", overflow: "hidden" }}>
      <div style={{ flex: 1, padding: "30px 40px", overflowY: "auto" }}>

        <ExamHeaderNav unitId={e.unitId} setUnitId={e.setUnitId} units={e.units} />

        {e.status !== 'draft' && (
          <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "14px", padding: "14px 20px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", color: "#92400e", fontWeight: "700" }}>
            <AlertTriangle size={18} /> Este examen ya está en estado &quot;{e.status}&quot;. Editar los reactivos puede afectar entregas o calificaciones ya existentes.
          </div>
        )}

        <div style={{ backgroundColor: "white", padding: "12px 20px", borderRadius: "18px", display: "flex", gap: "15px", border: "1px solid #e2e8f0", marginBottom: "20px", alignItems: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.03)" }}>
          <Sparkles color="#2563eb" size={20} />
          <input
            value={e.search}
            onChange={(ev) => e.setSearch(ev.target.value)}
            placeholder="Gemini: 'Genera 3 preguntas más sobre X' o 'Corrige la pregunta 2'..."
            style={{ flex: 1, border: "none", outline: "none", fontWeight: "600", fontSize: "1rem", color: "#1B396A" }}
          />
          <ExpandingButton icon={Sparkles} label="Generar" variant="ai" onClick={e.handleGenerateAI} loading={e.isGenerating} size={44} smallSize={36} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} iconSize={20} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Título de la Evaluación</label>
          <input
            value={e.examConfig.title} onChange={(ev) => e.setExamConfig({...e.examConfig, title: ev.target.value})}
            style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #cbd5e1", outline: "none", fontSize: "1rem", color: "#1B396A", fontWeight: "600" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Inicio</label>
            <input
              type="datetime-local" value={e.examConfig.startAt} onChange={(ev) => e.setExamConfig({...e.examConfig, startAt: ev.target.value})}
              style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #cbd5e1", outline: "none", fontSize: "1rem", color: "#1B396A", fontWeight: "600" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Fin</label>
            <input
              type="datetime-local" value={e.examConfig.endAt} onChange={(ev) => e.setExamConfig({...e.examConfig, endAt: ev.target.value})}
              min={e.examConfig.startAt || undefined}
              style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #cbd5e1", outline: "none", fontSize: "1rem", color: "#1B396A", fontWeight: "600" }}
            />
          </div>
        </div>

        <ScoreBar total={e.total} questions={e.questions} setQuestions={e.setQuestions} onAddManual={e.handleAddManualQuestion} />

        <div style={{ display: "flex", flexDirection: "column", gap: "15px", paddingBottom: "100px" }}>
          {e.questions.map((q, idx) => (
            <QuestionCard
              key={q.id ?? `new-${idx}`}
              question={q}
              index={idx}
              onUpdate={(patch: Partial<EditQuestion>) => e.updateQuestion(idx, patch)}
              onDelete={() => e.handleRemoveQuestion(idx)}
            />
          ))}
          {e.questions.length === 0 && (
            <EmptyQuestionsState message="Este examen no tiene reactivos." />
          )}
        </div>
      </div>

      <div style={{ width: "320px", backgroundColor: "white", borderLeft: "1px solid #e2e8f0", padding: "35px", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "28px" }}>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Google Forms</label>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "8px", backgroundColor: e.deploymentMethod === "google_forms" ? "#f0f7ff" : "#f1f5f9", color: e.deploymentMethod === "google_forms" ? "#2563eb" : "#64748b", fontSize: "0.7rem", fontWeight: "800", marginBottom: "12px" }}>
              Modo actual: {e.deploymentMethod === "google_forms" ? "Google Forms" : "Interno"}
            </div>
            {e.googleFormUrl ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <a href={e.googleFormUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #bfdbfe", backgroundColor: "#f0f7ff", color: "#1B396A", fontWeight: "700", fontSize: "0.85rem", textDecoration: "none" }}>
                  <ExternalLink size={16} /> Ver Formulario
                </a>
                {e.googleFormEditUrl && (
                  <a href={e.googleFormEditUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", color: "#64748b", fontWeight: "700", fontSize: "0.85rem", textDecoration: "none" }}>
                    <FileSpreadsheet size={16} /> Editar en Forms
                  </a>
                )}
                <ExpandingButton icon={Sparkles} label="Regenerar Formulario" loadingLabel="Generando..." variant="ai" small onClick={e.handlePublishForm} loading={e.isPublishingForm} size={44} smallSize={36} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} />
                <p style={{ fontSize: "0.7rem", color: "#94a3b8", margin: 0 }}>Regenerar crea un Form nuevo; el anterior queda huérfano en tu Drive (no se borra solo).</p>
              </div>
            ) : (
              <ExpandingButton icon={Sparkles} label="Generar Google Form" loadingLabel="Generando..." variant="ai" onClick={e.handlePublishForm} loading={e.isPublishingForm} disabled={e.questions.length === 0} size={44} smallSize={36} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} iconSize={20} />
            )}
          </div>

          <SecuritySettings
            randomizeQuestions={e.randomizeQuestions} setRandomizeQuestions={e.setRandomizeQuestions}
            randomizeOptions={e.randomizeOptions} setRandomizeOptions={e.setRandomizeOptions}
            showAllQuestions={e.showAllQuestions} setShowAllQuestions={e.setShowAllQuestions}
          />

          <AudienceSelector
            students={e.students} restrictAudience={e.restrictAudience} setRestrictAudience={e.setRestrictAudience}
            selectedStudentIds={e.selectedStudentIds} toggleStudent={(id: string) => e.setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" }}>
          <ExpandingButton icon={Save} label="Guardar Cambios" loadingLabel="Guardando..." onClick={e.handleSave} variant="primary" loading={e.isSaving} disabled={e.total !== 100 || !e.examConfig.title || !e.unitId || !e.examConfig.startAt || !e.examConfig.endAt} size={44} smallSize={36} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} iconSize={20} />
          {e.total !== 100 && e.questions.length > 0 && (
            <div style={{ color: "#dc2626", fontSize: "0.75rem", textAlign: "center", fontWeight: "900", backgroundColor: "#fef2f2", padding: "10px", borderRadius: "10px", border: "1px solid #fee2e2" }}>
              <AlertCircle size={14} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
              Faltan {Math.abs(100 - e.total).toFixed(1)} pts para el total.
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
