"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, RotateCcw, Loader2 } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import ActivityFormLeftColumn from "./_components/ActivityFormLeftColumn";
import ActivityFormRightColumn from "./_components/ActivityFormRightColumn";
import RubricSection from "./_components/RubricSection";
import TeamPickerModal from "./_components/TeamPickerModal";
import { useNuevaActividad } from "./_hooks/useNuevaActividad";

function NuevaActividadContent({ courseId, onRetry }: { courseId: string; onRetry: () => void }) {
  const router = useRouter();
  const {
    result,
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
  } = useNuevaActividad(courseId);

  if (!result.ok) return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {result.error}
        <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
      </div>
    </div>
  );

  const { units, teams, pastSessions } = result;

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "900", margin: "0", letterSpacing: "-0.02em" }}>Nueva Actividad</h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem", fontWeight: "600", marginTop: "4px", margin: 0 }}>Configura los parámetros y la rúbrica de Certeza AIA</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ExpandingButton icon={X} label="Cancelar" onClick={() => router.back()} variant="cancel" disabled={isSaving} size={42} radius={10} gap={10} padding="0 16px" fontWeight={600} fontSize="0.9rem" durationMs={300} />
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
          formData={formData}
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

export default function NuevaActividadPage() {
  const { id: courseId } = useParams() as { id: string };
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <Suspense fallback={
      <div style={{ padding: "40px", display: "flex", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={32} color="#1B396A" />
      </div>
    }>
      <NuevaActividadContent key={reloadKey} courseId={courseId} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
