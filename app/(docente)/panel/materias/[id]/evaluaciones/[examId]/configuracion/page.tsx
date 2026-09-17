"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Sparkles, Save, Loader2, AlertCircle, AlertTriangle, ExternalLink, FileSpreadsheet, X, Copy, Check, Radio, Play } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import DateTimeFieldMX from "@/components/ui/DateTimeFieldMX";
import { QuestionCard } from "../../_components/QuestionCard";
import { AudienceSelector } from "../../_components/AudienceSelector";
import { ScoreBar } from "../../_components/ScoreBar";
import { SecuritySettings } from "../../_components/SecuritySettings";
import { ExamHeaderNav } from "../../_components/ExamHeaderNav";
import { EmptyQuestionsState } from "../../_components/EmptyQuestionsState";
import type { EditQuestion } from "../../_components/questionMapping";
import { useConfiguracionExamen } from "./_hooks/useConfiguracionExamen";
import DuplicateExamModal from "./_components/DuplicateExamModal";

export default function ConfiguracionExamenPage() {
  const params = useParams();
  const courseId = params?.id as string;
  const examId = params?.examId as string;
  const e = useConfiguracionExamen(courseId, examId);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [copiedFormUrl, setCopiedFormUrl] = useState(false);

  const handleCopyFormUrl = () => {
    if (!e.googleFormUrl) return;
    navigator.clipboard.writeText(e.googleFormUrl);
    setCopiedFormUrl(true);
    setTimeout(() => setCopiedFormUrl(false), 2000);
  };

  if (e.loading) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="animate-spin" size={48} color="#1B396A" /></div>;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#F8FAFC", overflow: "hidden" }}>
      {e.feedback && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 1000, maxWidth: "420px",
          backgroundColor: e.feedback.type === "success" ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${e.feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          color: e.feedback.type === "success" ? "#166534" : "#991b1b",
          padding: "14px 18px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
        }}>
          <span>{e.feedback.message}</span>
          <button
            type="button"
            onClick={() => e.setFeedback(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", lineHeight: 0, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ flex: 1, padding: "30px 40px", overflowY: "auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <ExpandingButton
            icon={Copy}
            label="Duplicar a otra materia"
            onClick={() => setShowDuplicateModal(true)}
            variant="secondary"
            size={40}
            radius={10}
            gap={8}
            padding="0 16px"
            fontWeight={600}
            fontSize="0.85rem"
            durationMs={300}
          />
          <ExamHeaderNav unitId={e.unitId} setUnitId={e.setUnitId} units={e.units} style={{ marginBottom: 0 }} />
        </div>

        {e.status !== 'draft' && (
          <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "14px", padding: "14px 20px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", color: "#92400e", fontWeight: "700" }}>
            <AlertTriangle size={18} /> Este examen ya está en estado &quot;{e.status}&quot;. Editar los reactivos puede afectar entregas o calificaciones ya existentes.
          </div>
        )}

        <div style={{ backgroundColor: "white", padding: "12px 20px", borderRadius: "18px", display: "flex", gap: "15px", border: "1px solid #e2e8f0", marginBottom: "20px", alignItems: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.03)" }}>
          <Sparkles color="#1B396A" size={20} />
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
            <DateTimeFieldMX value={e.examConfig.startAt} onChange={(v) => e.setExamConfig({...e.examConfig, startAt: v})} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", textTransform: "uppercase", margin: 0 }}>Fin</label>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                {[30, 50, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      if (!e.examConfig.startAt) return;
                      const startDate = new Date(e.examConfig.startAt);
                      if (isNaN(startDate.getTime())) return;
                      const endDate = new Date(startDate.getTime() + mins * 60 * 1000);
                      const y = endDate.getFullYear();
                      const mo = String(endDate.getMonth() + 1).padStart(2, "0");
                      const d = String(endDate.getDate()).padStart(2, "0");
                      const h = String(endDate.getHours()).padStart(2, "0");
                      const m = String(endDate.getMinutes()).padStart(2, "0");
                      e.setExamConfig({ ...e.examConfig, endAt: `${y}-${mo}-${d}T${h}:${m}` });
                    }}
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: "700",
                      padding: "2px 6px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "white",
                      color: "#1B396A",
                      cursor: e.examConfig.startAt ? "pointer" : "not-allowed",
                      opacity: e.examConfig.startAt ? 1 : 0.5,
                    }}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
            </div>
            <DateTimeFieldMX value={e.examConfig.endAt} onChange={(v) => e.setExamConfig({...e.examConfig, endAt: v})} />
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
            <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Método de Aplicación</label>
            <div style={{ display: "flex", gap: "6px", backgroundColor: "#f1f5f9", padding: "5px", borderRadius: "14px", marginBottom: "12px" }}>
              <button
                type="button"
                onClick={() => e.setDeploymentMethod("interno")}
                style={{
                  flex: 1, padding: "10px", borderRadius: "10px", border: "none",
                  fontSize: "0.75rem", fontWeight: "900", cursor: "pointer",
                  backgroundColor: e.deploymentMethod === "interno" ? "white" : "transparent",
                  boxShadow: e.deploymentMethod === "interno" ? "0 4px 6px rgba(0,0,0,0.05)" : "none",
                  color: e.deploymentMethod === "interno" ? "#1B396A" : "#64748b",
                  transition: "0.2s"
                }}
              >INTERNO</button>
              <button
                type="button"
                onClick={() => e.setDeploymentMethod("google_forms")}
                style={{
                  flex: 1, padding: "10px", borderRadius: "10px", border: "none",
                  fontSize: "0.75rem", fontWeight: "900", cursor: "pointer",
                  backgroundColor: e.deploymentMethod === "google_forms" ? "white" : "transparent",
                  boxShadow: e.deploymentMethod === "google_forms" ? "0 4px 6px rgba(0,0,0,0.05)" : "none",
                  color: e.deploymentMethod === "google_forms" ? "#1B396A" : "#64748b",
                  transition: "0.2s"
                }}
              >GOOGLE FORMS</button>
            </div>

            {e.deploymentMethod === "google_forms" && (
              e.googleFormUrl ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleCopyFormUrl}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: copiedFormUrl ? "1px solid #86efac" : "1px solid #1B396A",
                      backgroundColor: copiedFormUrl ? "#f0fdf4" : "#1B396A",
                      color: copiedFormUrl ? "#166534" : "white",
                      fontWeight: "700",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {copiedFormUrl ? <Check size={16} /> : <Copy size={16} />}
                    {copiedFormUrl ? "¡Liga copiada al portapapeles!" : "Copiar liga para alumnos"}
                  </button>
                  <a href={e.googleFormUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #1B396A25", backgroundColor: "#1B396A10", color: "#1B396A", fontWeight: "700", fontSize: "0.85rem", textDecoration: "none" }}>
                    <ExternalLink size={16} /> Ver Formulario
                  </a>
                  {e.googleFormEditUrl && (
                    <a href={e.googleFormEditUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", color: "#64748b", fontWeight: "700", fontSize: "0.85rem", textDecoration: "none" }}>
                      <FileSpreadsheet size={16} /> Editar en Forms
                    </a>
                  )}
                  <ExpandingButton icon={Sparkles} label="Regenerar Formulario" loadingLabel="Generando..." variant="ai" small onClick={() => e.handlePublishForm(false)} loading={e.isPublishingForm} size={44} smallSize={36} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} />
                </div>
              ) : (
                <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "12px", fontSize: "0.78rem", color: "#1e40af", fontWeight: "600", display: "flex", alignItems: "flex-start", gap: "8px", lineHeight: "1.4" }}>
                  <Sparkles size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>El Google Form se creará automáticamente en Google Drive al presionar <strong>Guardar Cambios</strong>.</span>
                </div>
              )
            )}
          </div>

          <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Radio size={14} color="#0284c7" />
                <span style={{ fontSize: "0.75rem", fontWeight: "900", color: "#0f172a", textTransform: "uppercase" }}>Relay Programado</span>
              </div>
              <span style={{
                fontSize: "0.68rem",
                fontWeight: "800",
                padding: "2px 8px",
                borderRadius: "6px",
                backgroundColor: e.status === "published" ? "#dcfce7" : e.status === "closed" ? "#f1f5f9" : "#fef3c7",
                color: e.status === "published" ? "#166534" : e.status === "closed" ? "#475569" : "#b45309",
              }}>
                {e.status === "published" ? "En curso" : e.status === "closed" ? "Finalizado" : "Programado"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.75rem", color: "#475569", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#64748b" }}>Aviso previo:</span>
                <span style={{ fontWeight: "700", color: e.startNotifiedAt ? "#166534" : "#64748b" }}>
                  {e.startNotifiedAt ? `Enviado (${new Date(e.startNotifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : "10 min antes"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#64748b" }}>Apertura:</span>
                <span style={{ fontWeight: "700", color: "#0f172a" }}>
                  {e.examConfig.startAt ? new Date(e.examConfig.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Sin definir"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#64748b" }}>Cierre:</span>
                <span style={{ fontWeight: "700", color: "#0f172a" }}>
                  {e.examConfig.endAt ? new Date(e.examConfig.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Sin definir"}
                </span>
              </div>
            </div>
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
          <ExpandingButton
            icon={Save}
            label={e.deploymentMethod === "google_forms" && !e.googleFormUrl ? "Guardar y Crear Google Form" : "Guardar Cambios"}
            loadingLabel={e.deploymentMethod === "google_forms" && !e.googleFormUrl ? "Guardando y Creando Form..." : "Guardando..."}
            onClick={e.handleSave}
            variant="primary"
            loading={e.isSaving || e.isPublishingForm}
            disabled={e.total !== 100 || !e.examConfig.title || !e.unitId || !e.examConfig.startAt || !e.examConfig.endAt}
            size={44}
            smallSize={36}
            radius={12}
            gap={8}
            padding="0 14px"
            fontWeight={600}
            durationMs={300}
            iconSize={20}
          />
          {e.total !== 100 && e.questions.length > 0 && (
            <div style={{ color: "#dc2626", fontSize: "0.75rem", textAlign: "center", fontWeight: "900", backgroundColor: "#fef2f2", padding: "10px", borderRadius: "10px", border: "1px solid #fee2e2" }}>
              <AlertCircle size={14} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
              Faltan {Math.abs(100 - e.total).toFixed(1)} pts para el total.
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN: Ya Publicado (Regenerar Formulario) */}
      {e.showRePublishConfirm && (
        <div
          style={{
            position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
          }}
          onClick={(ev) => { if (ev.target === ev.currentTarget) e.setShowRePublishConfirm(false); }}
        >
          <div style={{ backgroundColor: "white", borderRadius: "20px", padding: "30px", maxWidth: "480px", width: "90%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <AlertTriangle size={22} color="#d97706" />
                <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "800", fontSize: "1.15rem" }}>
                  ¿Regenerar Google Form?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => e.setShowRePublishConfirm(false)}
                style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ color: "#334155", lineHeight: "1.6", margin: "0 0 24px 0", fontSize: "0.95rem" }}>
              Este examen ya tiene un Google Form vinculado. Si creas uno nuevo, el formulario anterior quedará huérfano y las respuestas previas de los alumnos no estarán vinculadas a esta plataforma. ¿Deseas recrearlo de todas formas?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => e.setShowRePublishConfirm(false)}
                style={{
                  padding: "10px 18px", borderRadius: "10px", border: "1px solid #cbd5e1",
                  backgroundColor: "white", color: "#64748b", fontWeight: "700", cursor: "pointer", fontSize: "0.9rem"
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => e.handlePublishForm(true)}
                style={{
                  padding: "10px 20px", borderRadius: "10px", border: "none",
                  backgroundColor: "#d97706", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.9rem"
                }}
              >
                Sí, regenerar formulario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Duplicar Examen a Otra Materia */}
      {showDuplicateModal && (
        <DuplicateExamModal
          currentCourseId={courseId}
          exam={{
            title: e.examConfig.title,
            randomize_questions: e.randomizeQuestions,
            randomize_options: e.randomizeOptions,
            show_all_questions: e.showAllQuestions,
            deployment_method: e.deploymentMethod,
            google_form_url: e.googleFormUrl,
          }}
          questions={e.questions}
          onClose={() => setShowDuplicateModal(false)}
        />
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
