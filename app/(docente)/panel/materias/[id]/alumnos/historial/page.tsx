"use client";

import { useState, useMemo, Suspense } from "react";
import { useParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import AttendanceToolbar from "./_components/AttendanceToolbar";
import AttendanceTable from "./_components/AttendanceTable";
import EditAttendanceModal from "./_components/EditAttendanceModal";
import { fetchHistorial, type FetchResult } from "./_services/fetchHistorial";
import { useHistorial } from "./_hooks/useHistorial";

function HistorialContent({ resource, courseId, onReload }: { resource: Promise<FetchResult>; courseId: string; onReload: () => void }) {
  const h = useHistorial({ resource, courseId, onReload });

  if (!h.ok) return (
    <div style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px", color: "#ef4444" }}>
      <p style={{ fontWeight: "700" }}>{h.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onReload} variant="secondary" size={40} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  return (
    <div style={{ padding: "40px", maxWidth: "100%", margin: "0 auto" }}>
      <AttendanceToolbar
        selectedUnitData={h.selectedUnitData}
        units={h.units}
        selectedUnitNumber={h.selectedUnitNumber}
        setSelectedUnitNumber={h.setSelectedUnitNumber}
        isSelectedUnitActive={h.isSelectedUnitActive}
        activeUnit={h.activeUnit}
        isClosingUnit={h.isClosingUnit}
        isUpdating={h.isUpdating}
        cerrarUnidad={h.cerrarUnidad}
        syncWithSheets={h.syncWithSheets}
        searchTerm={h.searchTerm}
        setSearchTerm={h.setSearchTerm}
      />

      <AttendanceTable
        uniqueDates={h.uniqueDates}
        filteredStudents={h.filteredStudents}
        getRecord={h.getRecord}
        setSelectedRecord={h.setSelectedRecord}
        setShowEditModal={h.setShowEditModal}
      />

      {h.showEditModal && h.selectedRecord && (
        <EditAttendanceModal
          selectedRecord={h.selectedRecord}
          setSelectedRecord={h.setSelectedRecord}
          selectedUnitData={h.selectedUnitData}
          setShowEditModal={h.setShowEditModal}
          fileToUpload={h.fileToUpload}
          setFileToUpload={h.setFileToUpload}
          handleDeleteRecord={h.handleDeleteRecord}
          handleUpdate={h.handleUpdate}
          isUpdating={h.isUpdating}
        />
      )}
    </div>
  );
}

export default function HistorialAsistencia() {
  const { id: courseId } = useParams() as { id: string };
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchHistorial(courseId, reloadKey), [courseId, reloadKey]);

  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "#64748b" }}>Cargando historial...</div>}>
      <HistorialContent resource={resource} courseId={courseId} onReload={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
