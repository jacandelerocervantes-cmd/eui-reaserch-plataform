"use client";

import { useParams, useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import ActivityFormLeftColumn from "./_components/ActivityFormLeftColumn";
import ActivityFormRightColumn from "./_components/ActivityFormRightColumn";
import RubricSection from "./_components/RubricSection";
import TeamPickerModal from "./_components/TeamPickerModal";
import { useNuevaActividad } from "./_hooks/useNuevaActividad";

export default function NuevaActividadPage() {
  const { id: courseId } = useParams() as { id: string };
  const router = useRouter();
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
          <button type="button" onClick={onRetry} style={{ padding: "8px 16px", backgroundColor: "#991b1b", color: "white", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer" }}>
            Reintentar
          </button>
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
          <ExpandingButton expanded icon={X} label="Cancelar" onClick={() => router.back()} variant="cancel" disabled={isSaving} size={42} radius={10} gap={10} padding="0 16px" fontWeight={600} fontSize="0.9rem" durationMs={300} />
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
    </div>
  );
}
