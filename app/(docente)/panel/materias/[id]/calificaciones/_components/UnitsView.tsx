"use client";

import {
  BookOpen, PlusCircle, Target, Edit3, AlertTriangle,
  CheckCircle2, Lock, FileSpreadsheet, GraduationCap
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { Unit, Activity, Assignment, Exam } from "./types";

interface UnitCardProps {
  unit: Unit;
  unitActs: Activity[];
  unitAssignments: Assignment[];
  unitExams: Exam[];
  assignmentWeights: Record<string, number>;
  onOpenCapture: (unit: Unit) => void;
}

function UnitCard({
  unit, unitActs, unitAssignments, unitExams, onOpenCapture
}: UnitCardProps) {
  const assistAct = unitActs.find(a => a.name.toLowerCase().includes("asist"));
  const activAct = unitActs.find(a =>
    a.name.toLowerCase().includes("activ") ||
    a.name.toLowerCase().includes("tarea") ||
    a.name.toLowerCase().includes("práct") ||
    a.name.toLowerCase().includes("pract") ||
    a.name.toLowerCase().includes("trabaj")
  );
  const evalAct = unitActs.find(a =>
    a.name.toLowerCase().includes("eval") ||
    a.name.toLowerCase().includes("examen") ||
    a.name.toLowerCase().includes("cuest")
  );

  const assistWeight = assistAct?.weight_percentage ?? 10;
  const activWeight = activAct?.weight_percentage ?? 50;
  const evalWeight = evalAct?.weight_percentage ?? 40;
  const totalMacro = Number(assistWeight) + Number(activWeight) + Number(evalWeight);
  const isPerfect = totalMacro === 100;

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "14px",
        border: `1px solid ${unit.is_closed ? "#cbd5e1" : "#e2e8f0"}`,
        overflow: "hidden",
        boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
        opacity: unit.is_closed ? 0.9 : 1,
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        padding: "20px",
        gap: "16px"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
              Unidad {unit.unit_number} {unit.is_closed && "(Cerrada)"}
            </span>
            {unit.is_closed && <Lock size={13} color="#94a3b8" />}
          </div>
          <h3 style={{ margin: "4px 0 0 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>
            {unit.name}
          </h3>
        </div>

        <div
          style={{
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "0.8rem",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            backgroundColor: isPerfect ? "#f0fdf4" : "#fffbeb",
            color: isPerfect ? "#166534" : "#92400e",
            border: `1px solid ${isPerfect ? "#bbf7d0" : "#fde68a"}`
          }}
        >
          {isPerfect ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {totalMacro}%
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "0.8rem" }}>
        <span style={{ backgroundColor: "#eff6ff", color: "#1e40af", padding: "4px 10px", borderRadius: "6px", fontWeight: "600" }}>
          Asistencia: {assistWeight}%
        </span>
        <span style={{ backgroundColor: "#f0fdf4", color: "#166534", padding: "4px 10px", borderRadius: "6px", fontWeight: "600" }}>
          Actividades: {activWeight}% ({unitAssignments.length} tareas)
        </span>
        <span style={{ backgroundColor: "#fffbeb", color: "#92400e", padding: "4px 10px", borderRadius: "6px", fontWeight: "600" }}>
          Evaluaciones: {evalWeight}% ({unitExams.length} exámenes)
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
        <button
          onClick={() => onOpenCapture(unit)}
          style={{
            backgroundColor: "#1B396A",
            color: "white",
            border: "none",
            padding: "8px 18px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: "700",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "background-color 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#244b8a"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#1B396A"}
        >
          <Edit3 size={15} /> Editar
        </button>
      </div>
    </div>
  );
}

export default function UnitsView({
  units, activities, assignments = [], exams = [], loading,
  openNewUnitModal, handleOpenSabana, handleOpenFinalGrades,
  handleOpenCapture, assignmentWeights = {},
}: {
  units: Unit[];
  activities: Activity[];
  assignments?: Assignment[];
  exams?: Exam[];
  loading: boolean;
  openNewUnitModal: () => void;
  handleOpenSabana: () => void;
  handleOpenFinalGrades: () => void;
  handleOpenCapture: (unit: Unit) => void;
  assignmentWeights?: Record<string, number>;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0" }}>Configuración de Evaluación</h1>
          <p style={{ color: "#64748b", margin: 0, fontWeight: "500", display: "flex", alignItems: "center", gap: "8px" }}>
            <Target size={18} /> Ponderación Macro (Asistencia + Actividades + Evaluaciones = 100%) y Desglose Individual
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <ExpandingButton icon={PlusCircle} label="Nueva Unidad" onClick={openNewUnitModal} variant="secondary" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
          <ExpandingButton icon={FileSpreadsheet} label="Sábana de Calificaciones" onClick={handleOpenSabana} variant="success" disabled={units.length === 0} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
          <ExpandingButton icon={GraduationCap} label="Ver Promedios Finales" onClick={handleOpenFinalGrades} variant="primary" disabled={units.length === 0} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Cargando rúbricas y ponderaciones...</div>
      ) : units.length === 0 ? (
        <div style={{ backgroundColor: "white", padding: "60px 20px", borderRadius: "16px", border: "1px dashed #cbd5e1", textAlign: "center" }}>
          <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ color: "#1B396A", margin: "0 0 8px 0", fontSize: "1.2rem" }}>Aún no hay unidades</h3>
          <p style={{ color: "#64748b", margin: "0 0 20px 0", fontSize: "0.95rem" }}>Comienza creando tu Unidad 1 para configurar las ponderaciones.</p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ExpandingButton icon={PlusCircle} label="Crear Primera Unidad" onClick={openNewUnitModal} variant="primary" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "24px", alignItems: "start" }}>
          {units.map((unit) => {
            const unitActs = activities.filter(a => a.unit_id === unit.id);
            const unitAssignments = assignments.filter(a => a.unit_id === unit.id);
            const unitExams = exams.filter(e => e.unit_id === unit.id);

            return (
              <UnitCard
                key={unit.id}
                unit={unit}
                unitActs={unitActs}
                unitAssignments={unitAssignments}
                unitExams={unitExams}
                assignmentWeights={assignmentWeights}
                onOpenCapture={handleOpenCapture}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
