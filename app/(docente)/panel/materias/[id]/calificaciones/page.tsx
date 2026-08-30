"use client";

import { useParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import UnitsView from "./_components/UnitsView";
import CaptureView from "./_components/CaptureView";
import FinalGradesView from "./_components/FinalGradesView";
import SabanaView from "./_components/SabanaView";
import NewUnitModal from "./_components/NewUnitModal";
import NewActivityModal from "./_components/NewActivityModal";
import { useCalificaciones } from "./_hooks/useCalificaciones";

export default function ConfiguracionCalificaciones() {
  const params = useParams();
  const courseId = params?.id as string;
  const c = useCalificaciones(courseId);

  if (c.error && c.currentView === 'units') {
    return (
      <div style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444", minHeight: "60vh" }}>
        <p style={{ fontWeight: "700" }}>{c.error}</p>
        <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={c.fetchData} variant="secondary" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} />
      </div>
    );
  }

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: c.currentView === 'sabana' ? "100%" : "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "30px", position: "relative" }}>

      {c.currentView === 'units' && (
        <UnitsView
          units={c.units}
          activities={c.activities}
          loading={c.loading}
          collapsedUnits={c.collapsedUnits}
          setCollapsedUnits={c.setCollapsedUnits}
          getUnitTotalWeight={c.getUnitTotalWeight}
          openNewUnitModal={c.openNewUnitModal}
          handleOpenSabana={c.handleOpenSabana}
          handleOpenFinalGrades={c.handleOpenFinalGrades}
          setActiveUnitId={c.setActiveUnitId}
          setShowActivityModal={c.setShowActivityModal}
          handleOpenCapture={c.handleOpenCapture}
          handleDeleteActivity={c.handleDeleteActivity}
        />
      )}

      {c.currentView === 'capture' && c.selectedUnit && (
        <CaptureView
          selectedUnit={c.selectedUnit}
          activities={c.activities}
          students={c.students}
          grades={c.grades}
          setGrades={c.setGrades}
          isSaving={c.isSaving}
          setCurrentView={c.setCurrentView}
          handleMagicAttendance={c.handleMagicAttendance}
          handleSaveGrades={c.handleSaveGrades}
          handleToggleCloseUnit={c.handleToggleCloseUnit}
          inputStyle={c.inputStyle}
        />
      )}

      {c.currentView === 'final' && (
        <FinalGradesView
          loading={c.loading}
          units={c.units}
          activities={c.activities}
          students={c.students}
          allGrades={c.allGrades}
          grades={c.grades}
          setCurrentView={c.setCurrentView}
          handleExportToSheets={c.handleExportToSheets}
        />
      )}

      {c.currentView === 'sabana' && (
        <SabanaView
          loading={c.loading}
          units={c.units}
          activities={c.activities}
          students={c.students}
          grades={c.grades}
          setGrades={c.setGrades}
          lockedUnits={c.lockedUnits}
          toggleLockSabana={c.toggleLockSabana}
          isSaving={c.isSaving}
          setCurrentView={c.setCurrentView}
          handleSaveGrades={c.handleSaveGrades}
          handleExportToSheets={c.handleExportToSheets}
          inputStyle={c.inputStyle}
        />
      )}

      {c.showUnitModal && c.currentView === 'units' && (
        <NewUnitModal
          newUnitName={c.newUnitName}
          setNewUnitName={c.setNewUnitName}
          unitCriteria={c.unitCriteria}
          isWeightValid={c.isWeightValid}
          totalWeight={c.totalWeight}
          handleUpdateUnitCriterion={c.handleUpdateUnitCriterion}
          handleRemoveUnitCriterion={c.handleRemoveUnitCriterion}
          handleAddUnitCriterion={c.handleAddUnitCriterion}
          handleAddUnit={c.handleAddUnit}
          setShowUnitModal={c.setShowUnitModal}
        />
      )}

      {c.showActivityModal && c.currentView === 'units' && (
        <NewActivityModal
          newActivity={c.newActivity}
          setNewActivity={c.setNewActivity}
          handleAddActivity={c.handleAddActivity}
          setShowActivityModal={c.setShowActivityModal}
        />
      )}
    </div>
  );
}
