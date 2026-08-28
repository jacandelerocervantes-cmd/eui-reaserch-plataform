"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { Search, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import styles from "../alumnos.module.css";
import ExpandingButton from "@/components/ui/ExpandingButton";
import StudentPickerList from "./_components/StudentPickerList";
import TeamsGrid from "./_components/TeamsGrid";
import NameTeamModal, { FloatingCreatePill } from "./_components/NameTeamModal";
import EditTeamModal from "./_components/EditTeamModal";
import ImportIAModal from "./_components/ImportIAModal";
import { useEquiposContent, useEquiposResource, type FetchResult } from "./_hooks/useEquipos";

function EquiposContent({ resource, onReload }: { resource: Promise<FetchResult>; onReload: () => void }) {
  const courseId = useParams().id as string;
  const eq = useEquiposContent(resource, onReload, courseId);

  if (!eq.ok) return (
    <div className={styles.container}>
      <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {eq.error}
        <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onReload} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
      </div>
    </div>
  );

  return (
    <div className={styles.container} style={{ paddingBottom: eq.selectedStudentIds.length > 0 ? "100px" : "40px" }}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Equipos de Trabajo</h1>
          <p className={styles.pageSubtitle}>
            Total Equipos: <span className={styles.highlightCount}>{eq.teams.length}</span>
          </p>
        </div>
        <div className={styles.headerActions}>
          <ExpandingButton icon={Sparkles} label="Importar con Gemini" onClick={() => eq.setShowImportModal(true)} variant="ai" size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px" />
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} size={18} />
          <input
            type="text"
            placeholder="Buscar alumno para agrupar..."
            value={eq.searchTerm}
            onChange={(e) => eq.setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <StudentPickerList
        loading={false}
        filteredStudents={eq.filteredStudents}
        selectedStudentIds={eq.selectedStudentIds}
        toggleStudentSelection={eq.toggleStudentSelection}
      />

      <TeamsGrid
        teams={eq.teams}
        openEditModal={eq.openEditModal}
        handleDeleteTeam={eq.handleDeleteTeam}
        handleRemoveMember={eq.handleRemoveMember}
      />

      {eq.selectedStudentIds.length > 0 && (
        <FloatingCreatePill
          selectedStudentIds={eq.selectedStudentIds}
          setSelectedStudentIds={eq.setSelectedStudentIds}
          setShowNameModal={eq.setShowNameModal}
        />
      )}

      {eq.showNameModal && (
        <NameTeamModal
          selectedStudentIds={eq.selectedStudentIds}
          newTeamName={eq.newTeamName}
          setNewTeamName={eq.setNewTeamName}
          handleCreateTeamFromSelection={eq.handleCreateTeamFromSelection}
          isSubmitting={eq.isSubmitting}
          setShowNameModal={eq.setShowNameModal}
        />
      )}

      {eq.showEditModal && eq.editingTeam && (
        <EditTeamModal
          editTeamName={eq.editTeamName}
          setEditTeamName={eq.setEditTeamName}
          students={eq.students}
          editMemberIds={eq.editMemberIds}
          toggleEditMember={eq.toggleEditMember}
          handleSaveEdit={eq.handleSaveEdit}
          isSubmitting={eq.isSubmitting}
          setShowEditModal={eq.setShowEditModal}
        />
      )}

      {eq.showImportModal && (
        <ImportIAModal
          setShowImportModal={eq.setShowImportModal}
          importError={eq.importError}
          selectedFile={eq.selectedFile}
          setSelectedFile={eq.setSelectedFile}
          setImportError={eq.setImportError}
          importStatus={eq.importStatus}
          handleGeminiImport={eq.handleGeminiImport}
        />
      )}
    </div>
  );
}

export default function EquiposPage() {
  const { id: courseId } = useParams() as { id: string };
  const { resource, onReload } = useEquiposResource(courseId);

  return (
    <Suspense fallback={<div style={{ padding: "60px", textAlign: "center" }}><Loader2 className="animate-spin" size={32} color="#1B396A" style={{ margin: "0 auto" }} /></div>}>
      <EquiposContent resource={resource} onReload={onReload} />
    </Suspense>
  );
}
