"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { RotateCcw, GraduationCap, Users, BookOpen } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import CaptureView from "./_components/CaptureView";
import FinalGradesView from "./_components/FinalGradesView";
import { useCalificaciones } from "./_hooks/useCalificaciones";

export default function CalificacionesPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;
  const c = useCalificaciones(courseId);

  const [activeTab, setActiveTab] = useState<'units' | 'final'>('units');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const currentUnit = useMemo(() => {
    if (!c.units || c.units.length === 0) return null;
    return c.units.find(u => u.id === selectedUnitId) || c.units.find(u => !u.is_closed) || c.units[0];
  }, [c.units, selectedUnitId]);

  const handleOpenCapture = c.handleOpenCapture;
  useEffect(() => {
    if (currentUnit) {
      handleOpenCapture(currentUnit);
    }
  }, [currentUnit, handleOpenCapture]);

  const handleSelectUnit = (unitId: string) => {
    setSelectedUnitId(unitId);
  };

  if (c.error) {
    return (
      <div style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444", minHeight: "60vh" }}>
        <p style={{ fontWeight: "700" }}>{c.error}</p>
        <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={c.fetchData} variant="secondary" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} />
      </div>
    );
  }

  return (
    <div style={{ padding: "30px 40px", width: "100%", flex: 1, maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", position: "relative" }}>
      {/* Encabezado y Selector de Vista Principal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 4px 0" }}>
            Ponderación de Unidad y Calificaciones
          </h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.9rem", fontWeight: "500" }}>
            Captura operativa de notas por unidad y acta final con recuperaciones.
          </p>
        </div>

        {/* Tabs Principales */}
        <div style={{ display: "flex", gap: "6px", backgroundColor: "#e2e8f0", padding: "4px", borderRadius: "10px" }}>
          <button
            onClick={() => setActiveTab('units')}
            style={{
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: "700",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: activeTab === 'units' ? "#ffffff" : "transparent",
              color: activeTab === 'units' ? "#1B396A" : "#64748b",
              boxShadow: activeTab === 'units' ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s"
            }}
          >
            <Users size={16} /> Calificaciones por Unidad
          </button>
          <button
            onClick={() => {
              setActiveTab('final');
              c.handleOpenFinalGrades();
            }}
            style={{
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: "700",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: activeTab === 'final' ? "#ffffff" : "transparent",
              color: activeTab === 'final' ? "#1B396A" : "#64748b",
              boxShadow: activeTab === 'final' ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s"
            }}
          >
            <GraduationCap size={16} /> Track Final y Recuperaciones
          </button>
        </div>
      </div>

      {/* CONTENIDO 1: CALIFICACIONES POR UNIDAD */}
      {activeTab === 'units' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {c.units.length === 0 ? (
            <div style={{ backgroundColor: "white", padding: "60px 20px", borderRadius: "16px", border: "1px dashed #cbd5e1", textAlign: "center" }}>
              <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
              <h3 style={{ color: "#1B396A", margin: "0 0 8px 0", fontSize: "1.2rem" }}>No hay unidades creadas</h3>
              <p style={{ color: "#64748b", margin: "0 0 20px 0", fontSize: "0.95rem" }}>
                Las unidades y sus ponderaciones se configuran en el módulo de Unidades.
              </p>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <ExpandingButton
                  icon={BookOpen}
                  label="Ir al Módulo de Unidades"
                  onClick={() => router.push(`/panel/materias/${courseId}/unidades`)}
                  variant="primary"
                  size={40} radius={10} gap={8} padding="0 14px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Pills / Selector de Unidades */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#475569" }}>Unidad:</span>
                {c.units.map(u => {
                  const isSelected = u.id === selectedUnitId;
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUnit(u.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: "700",
                        border: isSelected ? "2px solid #1B396A" : "1px solid #cbd5e1",
                        backgroundColor: isSelected ? "#1B396A" : "white",
                        color: isSelected ? "white" : "#475569",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      U{u.unit_number}: {u.name} {u.is_closed && "🔒"}
                    </button>
                  );
                })}
              </div>

              {/* Matriz de Captura Operativa */}
              {currentUnit && (
                <CaptureView
                  selectedUnit={currentUnit}
                  activities={c.activities}
                  assignments={c.assignments}
                  exams={c.exams}
                  assignmentWeights={c.assignmentWeights}
                  examWeights={c.examWeights}
                  students={c.students}
                  grades={c.grades}
                  setGrades={c.setGrades}
                  isSaving={c.isSaving}
                  handleMagicAttendance={c.handleMagicAttendance}
                  handleSaveGrades={c.handleSaveGrades}
                  handleToggleCloseUnit={c.handleToggleCloseUnit}
                  inputStyle={c.inputStyle}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* CONTENIDO 2: TRACK FINAL Y RECUPERACIONES */}
      {activeTab === 'final' && (
        <FinalGradesView
          loading={c.loading}
          units={c.units}
          activities={c.activities}
          students={c.students}
          allGrades={c.allGrades}
          grades={c.grades}
          setGrades={c.setGrades}
          isSaving={c.isSaving}
          handleSaveGrades={c.handleSaveGrades}
          setCurrentView={() => setActiveTab('units')}
          handleExportToSheets={c.handleExportToSheets}
        />
      )}
    </div>
  );
}
