"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { RotateCcw, X, AlertTriangle } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import AttendanceToolbar from "./_components/AttendanceToolbar";
import AttendanceTable from "./_components/AttendanceTable";
import EditAttendanceModal from "./_components/EditAttendanceModal";
import { useHistorial } from "./_hooks/useHistorial";

function HistorialContent({ courseId, reloadKey, onReload }: { courseId: string; reloadKey: number; onReload: () => void }) {
  const h = useHistorial({ courseId, reloadKey, onReload });

  if (h.loading) return (
    <div style={{ padding: "40px", color: "#64748b" }}>Cargando historial...</div>
  );

  if (!h.ok) return (
    <div style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px", color: "#ef4444" }}>
      <p style={{ fontWeight: "700" }}>{h.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onReload} variant="secondary" size={40} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  return (
    <div style={{ padding: "40px", maxWidth: "100%", margin: "0 auto" }}>
      {h.feedback && (
        <div style={{
          backgroundColor: h.feedback.type === "success" ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${h.feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          color: h.feedback.type === "success" ? "#166534" : "#991b1b",
          padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem",
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px",
        }}>
          {h.feedback.message}
          <button onClick={() => h.setFeedback(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", lineHeight: 0 }}><X size={16} /></button>
        </div>
      )}

      {h.showSealConfirm && h.activeUnit && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 200, backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "20px", width: "420px", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{ backgroundColor: "#fef2f2", color: "#dc2626", padding: "8px", borderRadius: "10px" }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ margin: 0, color: "#991b1b", fontWeight: "800", fontSize: "1.1rem" }}>Sellar Asistencia — Acción irreversible</h3>
            </div>
            <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 22px" }}>
              ¿Sellar definitivamente la asistencia de la <strong>Unidad {h.activeUnit.unit_number} — {h.activeUnit.title}</strong>? Se calcularán los porcentajes finales y se bloqueará el registro de nuevas asistencias en esta unidad. <strong>Esto NO afecta la captura ni edición de calificaciones</strong>, únicamente sella el pase de lista. Esta acción es irreversible y no se puede deshacer.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <ExpandingButton icon={X} label="Cancelar" onClick={() => h.setShowSealConfirm(false)} variant="default" size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300} colors={{ hoverText: "#64748b" }} />
              <ExpandingButton icon={AlertTriangle} label="Sellar de todos modos" onClick={h.confirmarCerrarUnidad} variant="danger" size={40} radius={10} gap={10} padding="0 12px" fontWeight={700} durationMs={300} colors={{ bg: "#dc2626", hoverBg: "#991b1b", text: "white", hoverText: "white" }} />
            </div>
          </div>
        </div>
      )}

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

  return (
    <HistorialContent courseId={courseId} reloadKey={reloadKey} onReload={() => setReloadKey((k) => k + 1)} />
  );
}
