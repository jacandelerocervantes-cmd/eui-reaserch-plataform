"use client";

import { useParams, useRouter } from "next/navigation";
import { X, Loader2, Gamepad2, Save, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import ActivityFormLeftColumn from "./_components/ActivityFormLeftColumn";
import ActivityFormRightColumn from "./_components/ActivityFormRightColumn";
import RubricSection from "./_components/RubricSection";
import TeamPickerModal from "./_components/TeamPickerModal";
import PuzzlePreviewModal from "./_components/PuzzlePreviewModal";
import { useNuevaActividad } from "./_hooks/useNuevaActividad";

export default function NuevaActividad() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const {
    loading,
    error,
    units,
    teams,
    pastSessions,
    isGenerating,
    isSaving,
    rubricSourceFile, setRubricSourceFile,
    selectedTeamIds, setSelectedTeamIds,
    showTeamPicker, setShowTeamPicker,
    teamSearchTerm, setTeamSearchTerm,
    requireAttendance, setRequireAttendance,
    selectedSessionId, setSelectedSessionId,
    formData, setFormData,
    rubrics,
    totalRubricWeight,
    isRubricValid,
    puzzleData,
    isGeneratingPuzzle,
    showPuzzlePreview, setShowPuzzlePreview,
    handleGeneratePuzzle,
    handleAddRubricRow,
    handleRemoveRubricRow,
    handleUpdateRubric,
    handleGenerateAI,
    handleSave,
    onRetry,
  } = useNuevaActividad(courseId);

  if (loading) {
    return (
      <div style={{ padding: "80px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", minHeight: "400px" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
        <p style={{ color: "#64748b", fontWeight: "700", fontSize: "1rem" }}>Cargando datos de la materia...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "16px 20px", borderRadius: "14px", fontWeight: "600", fontSize: "0.95rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="danger" size={40} radius={10} gap={8} padding="0 14px" fontWeight={700} durationMs={300} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "900", margin: "0", letterSpacing: "-0.02em" }}>Nueva Actividad</h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem", fontWeight: "600", marginTop: "4px", margin: 0 }}>Configura los parámetros y la rúbrica de Certeza AIA</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ExpandingButton icon={X} label="Cancelar" onClick={() => router.back()} variant="cancel" disabled={isSaving} size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
          <ActivityFormLeftColumn
            formData={formData}
            setFormData={setFormData}
            selectedTeamIds={selectedTeamIds}
            teams={teams}
            units={units}
            setShowTeamPicker={setShowTeamPicker}
            puzzleData={puzzleData}
            isGeneratingPuzzle={isGeneratingPuzzle}
            handleGeneratePuzzle={handleGeneratePuzzle}
            setShowPuzzlePreview={setShowPuzzlePreview}
          />
          <ActivityFormRightColumn
            formData={formData}
            setFormData={setFormData}
            requireAttendance={requireAttendance}
            setRequireAttendance={setRequireAttendance}
            selectedSessionId={selectedSessionId}
            setSelectedSessionId={setSelectedSessionId}
            pastSessions={pastSessions}
          />
        </div>

        {formData.submission_type.startsWith("puzzle_") ? (
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "24px",
              padding: "32px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  backgroundColor: "#eff6ff",
                  color: "#1B396A",
                  padding: "12px",
                  borderRadius: "16px",
                }}
              >
                <Gamepad2 size={32} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.15rem", fontWeight: "900" }}>
                  Evaluación Gamificada Automatizada
                </h3>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.9rem", fontWeight: "600" }}>
                  Esta actividad se califica automáticamente al 100% al resolver todos los conceptos del juego y registra el tiempo de resolución.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <ExpandingButton
                icon={Save}
                label="Guardar y Publicar"
                onClick={handleSave}
                variant="primary"
                loading={isSaving}
                loadingLabel="Guardando..."
                size={44}
                radius={12}
                gap={10}
                padding="0 20px"
                fontWeight={700}
                durationMs={300}
              />
            </div>
          </div>
        ) : (
          <RubricSection
            rubrics={rubrics}
            totalRubricWeight={totalRubricWeight}
            isRubricValid={isRubricValid}
            handleUpdateRubric={handleUpdateRubric}
            handleRemoveRubricRow={handleRemoveRubricRow}
            handleAddRubricRow={handleAddRubricRow}
            isGenerating={isGenerating}
            handleGenerateAI={handleGenerateAI}
            rubricSourceFile={rubricSourceFile}
            setRubricSourceFile={setRubricSourceFile}
            isSaving={isSaving}
            handleSave={handleSave}
          />
        )}
      </form>

      {showTeamPicker && (
        <TeamPickerModal
          teams={teams}
          selectedTeamIds={selectedTeamIds}
          setSelectedTeamIds={setSelectedTeamIds}
          teamSearchTerm={teamSearchTerm}
          setTeamSearchTerm={setTeamSearchTerm}
          setShowTeamPicker={setShowTeamPicker}
        />
      )}

      {showPuzzlePreview && puzzleData && (
        <PuzzlePreviewModal
          puzzleType={formData.submission_type as "puzzle_crossword" | "puzzle_wordsearch"}
          puzzleData={puzzleData}
          onClose={() => setShowPuzzlePreview(false)}
        />
      )}
    </div>
  );
}
