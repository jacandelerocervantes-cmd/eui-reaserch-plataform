"use client";

import { useParams, useRouter } from "next/navigation";
import { QuestionCard } from "../_components/QuestionCard";
import { ScoreBar } from "../_components/ScoreBar";
import { ExamHeaderNav } from "../_components/ExamHeaderNav";
import { EmptyQuestionsState } from "../_components/EmptyQuestionsState";
import { type EditQuestion } from "../_components/questionMapping";
import SimulacionModal from "./_components/SimulacionModal";
import AIPromptBar from "./_components/AIPromptBar";
import PropertiesPanel from "./_components/PropertiesPanel";
import { useNuevaEvaluacion } from "./_hooks/useNuevaEvaluacion";

// --- COMPONENTE PRINCIPAL ---
export default function ExamenWorkspace() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const {
    units,
    unitId, setUnitId,
    questions, setQuestions,
    students,
    restrictAudience, setRestrictAudience,
    selectedStudentIds,
    randomizeQuestions, setRandomizeQuestions,
    randomizeOptions, setRandomizeOptions,
    showAllQuestions, setShowAllQuestions,
    search, setSearch,
    isSimulating, setIsSimulating,
    isGenerating,
    isExtracting,
    isPublishing,
    deployment, setDeployment,
    examConfig, setExamConfig,
    extractFile, setExtractFile,
    toggleStudentAudience,
    total,
    handleGenerateAI,
    handleExtractFromFile,
    handleAddManualQuestion,
    updateQuestion,
    handlePublish,
  } = useNuevaEvaluacion(courseId);

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#F8FAFC", overflow: "hidden" }}>

      <div style={{ flex: 1, padding: "30px 40px", overflowY: "auto" }}>

        <ExamHeaderNav unitId={unitId} setUnitId={setUnitId} units={units} />

        <AIPromptBar
          search={search}
          setSearch={setSearch}
          extractFile={extractFile}
          setExtractFile={setExtractFile}
          handleExtractFromFile={handleExtractFromFile}
          handleGenerateAI={handleGenerateAI}
          isGenerating={isGenerating}
          isExtracting={isExtracting}
        />

        <ScoreBar total={total} questions={questions} setQuestions={setQuestions} onAddManual={handleAddManualQuestion} />

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
            <EmptyQuestionsState message={'Tu examen está vacío. Pídele a Certeza AIA que genere los primeros reactivos, sube un archivo existente, o agrégalos manualmente.'} />
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

      {isSimulating && <SimulacionModal questions={questions} onClose={() => setIsSimulating(false)} />}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
