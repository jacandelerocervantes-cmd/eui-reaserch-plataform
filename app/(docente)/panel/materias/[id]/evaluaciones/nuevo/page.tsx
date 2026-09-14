"use client";

import { useParams, useRouter } from "next/navigation";
import { MessageSquare, ArrowLeft, Loader2, X } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { QuestionCard } from "../_components/QuestionCard";
import { ScoreBar } from "../_components/ScoreBar";
import { ExamHeaderNav } from "../_components/ExamHeaderNav";
import { EmptyQuestionsState } from "../_components/EmptyQuestionsState";
import { type EditQuestion } from "../_components/questionMapping";
import SimulacionModal from "./_components/SimulacionModal";
import PropertiesPanel from "./_components/PropertiesPanel";
import ExamChatAssistant from "./_components/ExamChatAssistant";
import { useNuevaEvaluacion } from "./_hooks/useNuevaEvaluacion";

export default function ExamenWorkspace() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const {
    loading,
    viewMode,
    setViewMode,
    feedback,
    setFeedback,
    units,
    unitId, setUnitId,
    questions, setQuestions,
    students,
    restrictAudience, setRestrictAudience,
    selectedStudentIds,
    randomizeQuestions, setRandomizeQuestions,
    randomizeOptions, setRandomizeOptions,
    showAllQuestions, setShowAllQuestions,
    isSimulating, setIsSimulating,
    isPublishing,
    deployment, setDeployment,
    examConfig, setExamConfig,
    toggleStudentAudience,
    total,
    handleChatGenerate,
    handleChatTurn,
    handleRegenerateSingleQuestion,
    handleAddManualQuestion,
    updateQuestion,
    handlePublish,
  } = useNuevaEvaluacion(courseId);

  if (loading) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100vh", backgroundColor: "#F8FAFC", gap: "16px",
      }}>
        <Loader2 className="animate-spin" size={36} color="#1B396A" />
        <p style={{ color: "#64748b", fontWeight: "700", fontSize: "0.95rem" }}>
          Cargando entorno de evaluación...
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", position: "relative" }}>
      {/* ── TOAST NOTIFICATION FLOTANTE (REEMPLAZA ALERT NATIVOS) ────── */}
      {feedback && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 9999, maxWidth: "440px",
          backgroundColor: feedback.type === "success" ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          color: feedback.type === "success" ? "#166534" : "#991b1b",
          padding: "14px 18px", borderRadius: "12px", fontWeight: "700", fontSize: "0.9rem",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12)",
        }}>
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", lineHeight: 0, flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── VISTA 1: CHAT ASISTENTE DE CREACIÓN CON IA ───────────────── */}
      {viewMode === "chat" ? (
        <ExamChatAssistant
          courseId={courseId}
          units={units}
          unitId={unitId}
          setUnitId={setUnitId}
          questions={questions}
          totalPoints={total}
          onUpdateQuestion={updateQuestion}
          onDeleteQuestion={(idx) => setQuestions(questions.filter((_, i) => i !== idx))}
          onRegenerateQuestion={handleRegenerateSingleQuestion}
          onGenerateInitial={handleChatGenerate}
          onSendChatTurn={handleChatTurn}
          onGoToResult={() => setViewMode("resultado")}
          onCancel={() => router.back()}
        />
      ) : (
        /* ── VISTA 2: PANTALLA DE RESULTADO ("ASÍ QUEDÓ") ─────────────── */
        <div style={{ display: "flex", width: "100%", minHeight: "100vh", height: "100dvh", backgroundColor: "#F8FAFC", overflow: "hidden" }}>
          <div style={{ flex: 1, padding: "clamp(16px, 2.5vw, 32px)", overflowY: "auto", minWidth: 0 }}>
            {/* ENCABEZADO CON RETORNO AL CHAT */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "20px", flexWrap: "wrap", gap: "12px",
            }}>
              <ExamHeaderNav unitId={unitId} setUnitId={setUnitId} units={units} />

              <ExpandingButton
                icon={MessageSquare}
                label="Abrir Chat Asistente IA"
                onClick={() => setViewMode("chat")}
                variant="secondary"
                size={40}
                radius={10}
                gap={8}
                padding="0 14px"
                fontWeight={700}
                durationMs={300}
              />
            </div>

            <ScoreBar
              total={total}
              questions={questions}
              setQuestions={setQuestions}
              onAddManual={handleAddManualQuestion}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "15px", paddingBottom: "100px" }}>
              {questions.map((q, idx) => (
                <QuestionCard
                  key={idx}
                  question={q}
                  index={idx}
                  onUpdate={(patch: Partial<EditQuestion>) => updateQuestion(idx, patch)}
                  onDelete={() => setQuestions(questions.filter((_, i) => i !== idx))}
                />
              ))}
              {questions.length === 0 && (
                <EmptyQuestionsState message="Tu examen está vacío. Abre el Asistente IA para generar reactivos o agrégalos manualmente." />
              )}
            </div>
          </div>

          <PropertiesPanel
            examConfig={examConfig}
            setExamConfig={setExamConfig}
            deployment={deployment}
            setDeployment={setDeployment}
            randomizeQuestions={randomizeQuestions}
            setRandomizeQuestions={setRandomizeQuestions}
            randomizeOptions={randomizeOptions}
            setRandomizeOptions={setRandomizeOptions}
            showAllQuestions={showAllQuestions}
            setShowAllQuestions={setShowAllQuestions}
            students={students}
            restrictAudience={restrictAudience}
            setRestrictAudience={setRestrictAudience}
            selectedStudentIds={selectedStudentIds}
            toggleStudentAudience={toggleStudentAudience}
            questions={questions}
            setIsSimulating={setIsSimulating}
            router={router}
            handlePublish={handlePublish}
            isPublishing={isPublishing}
            unitId={unitId}
            total={total}
          />

          {isSimulating && (
            <SimulacionModal
              questions={questions}
              examTitle={examConfig.title || "Examen de Prueba"}
              onClose={() => setIsSimulating(false)}
            />
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
