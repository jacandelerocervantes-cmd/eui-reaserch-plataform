"use client";

import { useState } from "react";
import {
  BookOpen, PlusCircle, Target, Edit3, AlertTriangle,
  CheckCircle2, Trash2, Lock, FileSpreadsheet,
  GraduationCap, ChevronDown, ChevronUp, Pencil, FileText, Award, Save
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { Unit, Activity, Assignment, Exam } from "./types";

interface UnitCardProps {
  unit: Unit;
  unitActs: Activity[];
  unitAssignments: Assignment[];
  unitExams: Exam[];
  assignmentWeights: Record<string, number>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onUpdatePillars: (unitId: string, assist: number, activ: number, evalw: number) => Promise<void>;
  onUpdateAssignmentWeight: (asgnId: string, weight: number) => Promise<void>;
  onOpenCapture: (unit: Unit) => void;
}

function UnitCard({
  unit, unitActs, unitAssignments, unitExams, assignmentWeights,
  isCollapsed, onToggleCollapse, onUpdatePillars, onUpdateAssignmentWeight, onOpenCapture
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

  const [assistWeight, setAssistWeight] = useState<number>(assistAct?.weight_percentage ?? 10);
  const [activWeight, setActivWeight] = useState<number>(activAct?.weight_percentage ?? 50);
  const [evalWeight, setEvalWeight] = useState<number>(evalAct?.weight_percentage ?? 40);

  // Micro pesos locales de actividades
  const defaultAsgnWeight = unitAssignments.length > 0 ? Math.round(activWeight / unitAssignments.length) : 0;
  const [localAsgnWeights, setLocalAsgnWeights] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    unitAssignments.forEach(a => {
      map[a.id] = assignmentWeights[a.id] ?? defaultAsgnWeight;
    });
    return map;
  });

  const totalMacro = Number(assistWeight) + Number(activWeight) + Number(evalWeight);
  const isPerfect = totalMacro === 100;
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdatePillars(unit.id, Number(assistWeight), Number(activWeight), Number(evalWeight));
      for (const asgn of unitAssignments) {
        if (localAsgnWeights[asgn.id] !== undefined) {
          await onUpdateAssignmentWeight(asgn.id, Number(localAsgnWeights[asgn.id]));
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const sumAsgnWeights = unitAssignments.reduce((acc, a) => acc + (localAsgnWeights[a.id] ?? defaultAsgnWeight), 0);

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "16px",
        border: `1px solid ${unit.is_closed ? "#cbd5e1" : "#e2e8f0"}`,
        overflow: "hidden",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
        opacity: unit.is_closed ? 0.85 : 1,
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-6px)";
        e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.05)";
      }}
    >
      <div
        onClick={onToggleCollapse}
        style={{
          cursor: "pointer",
          padding: "18px 20px",
          backgroundColor: unit.is_closed ? "#f1f5f9" : "#f8fafc",
          borderBottom: isCollapsed ? "none" : "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          transition: "background-color 0.2s"
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = unit.is_closed ? "#e2e8f0" : "#f1f5f9"}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = unit.is_closed ? "#f1f5f9" : "#f8fafc"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ color: "#94a3b8", display: "flex", alignItems: "center" }}>
            {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
              {unit.is_closed && <Lock size={12} />} Unidad {unit.unit_number} {unit.is_closed && "(Cerrada)"}
            </span>
            <h3 style={{ margin: "4px 0 0 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>{unit.name}</h3>
          </div>
        </div>

        {!unit.is_closed && (
          <div style={{ padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px", backgroundColor: isPerfect ? "#ecfdf5" : "#fffbeb", color: isPerfect ? "#10b981" : "#f59e0b" }}>
            {isPerfect ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} Total: {totalMacro}%
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Pilares Macro */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>
              Ponderación Macro de la Unidad (Suma = 100%)
            </div>

            {/* Asistencia */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ color: "#1B396A", fontWeight: "700", fontSize: "0.9rem" }}>🎓 Asistencia</div>
                <div style={{ color: "#64748b", fontSize: "0.75rem" }}>Ponderación de pases de lista</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="number" min="0" max="100"
                  disabled={unit.is_closed}
                  value={assistWeight}
                  onChange={(e) => setAssistWeight(Number(e.target.value))}
                  style={{ width: "60px", padding: "6px", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "800", color: "#1B396A", outline: "none" }}
                />
                <span style={{ fontWeight: "700", color: "#64748b" }}>%</span>
              </div>
            </div>

            {/* Actividades */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", backgroundColor: "#eff6ff", borderRadius: "10px", border: "1px solid #bfdbfe" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#1e40af", fontWeight: "700", fontSize: "0.9rem" }}>📝 Actividades y Tareas</div>
                  <div style={{ color: "#3b82f6", fontSize: "0.75rem" }}>{unitAssignments.length} actividades creadas</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number" min="0" max="100"
                    disabled={unit.is_closed}
                    value={activWeight}
                    onChange={(e) => setActivWeight(Number(e.target.value))}
                    style={{ width: "60px", padding: "6px", borderRadius: "8px", border: "1px solid #93c5fd", textAlign: "center", fontWeight: "800", color: "#1e40af", outline: "none", backgroundColor: "white" }}
                  />
                  <span style={{ fontWeight: "700", color: "#1e40af" }}>%</span>
                </div>
              </div>

              {/* Desglose de actividades individuales */}
              {unitAssignments.length > 0 && (
                <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px dashed #bfdbfe", paddingTop: "8px" }}>
                  <div style={{ fontSize: "0.7rem", color: "#1e40af", fontWeight: "700", display: "flex", justifyContent: "space-between" }}>
                    <span>Desglose por actividad:</span>
                    <span>Suma: {sumAsgnWeights}% / {activWeight}%</span>
                  </div>
                  {unitAssignments.map(asgn => (
                    <div key={asgn.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: "6px 10px", borderRadius: "6px", border: "1px solid #dbeafe" }}>
                      <span style={{ fontSize: "0.8rem", color: "#334155", fontWeight: "600" }}>{asgn.title}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <input
                          type="number" min="0" max="100"
                          disabled={unit.is_closed}
                          value={localAsgnWeights[asgn.id] ?? defaultAsgnWeight}
                          onChange={(e) => setLocalAsgnWeights({ ...localAsgnWeights, [asgn.id]: Number(e.target.value) })}
                          style={{ width: "45px", padding: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "700", fontSize: "0.8rem" }}
                        />
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evaluaciones */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", backgroundColor: "#fffbeb", borderRadius: "10px", border: "1px solid #fde68a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#92400e", fontWeight: "700", fontSize: "0.9rem" }}>📋 Evaluaciones / Exámenes</div>
                  <div style={{ color: "#d97706", fontSize: "0.75rem" }}>{unitExams.length} exámenes creados</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number" min="0" max="100"
                    disabled={unit.is_closed}
                    value={evalWeight}
                    onChange={(e) => setEvalWeight(Number(e.target.value))}
                    style={{ width: "60px", padding: "6px", borderRadius: "8px", border: "1px solid #fcd34d", textAlign: "center", fontWeight: "800", color: "#92400e", outline: "none", backgroundColor: "white" }}
                  />
                  <span style={{ fontWeight: "700", color: "#92400e" }}>%</span>
                </div>
              </div>

              {unitExams.length > 0 && (
                <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px dashed #fde68a", paddingTop: "8px" }}>
                  {unitExams.map(ex => (
                    <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: "6px 10px", borderRadius: "6px", border: "1px solid #fef3c7" }}>
                      <span style={{ fontSize: "0.8rem", color: "#334155", fontWeight: "600" }}>{ex.title}</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#92400e" }}>{evalWeight}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "14px", marginTop: "4px" }}>
            {!unit.is_closed ? (
              <ExpandingButton icon={Save} label={isSaving ? "Guardando..." : "Guardar Ponderación"} onClick={handleSave} variant="secondary" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.85rem" durationMs={300} shadow="hover" />
            ) : <div />}
            <ExpandingButton icon={Edit3} label="Calificar Unidad" variant="primary" onClick={() => onOpenCapture(unit)} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.85rem" durationMs={300} shadow="hover" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnitsView({
  units, activities, assignments = [], exams = [], loading, collapsedUnits, setCollapsedUnits,
  openNewUnitModal, handleOpenSabana, handleOpenFinalGrades,
  handleUpdateUnitPillars, handleUpdateAssignmentWeight, handleOpenCapture, assignmentWeights = {},
}: {
  units: Unit[];
  activities: Activity[];
  assignments?: Assignment[];
  exams?: Exam[];
  loading: boolean;
  collapsedUnits: { [key: string]: boolean };
  setCollapsedUnits: (fn: (prev: { [key: string]: boolean }) => { [key: string]: boolean }) => void;
  openNewUnitModal: () => void;
  handleOpenSabana: () => void;
  handleOpenFinalGrades: () => void;
  handleUpdateUnitPillars: (unitId: string, assist: number, activ: number, evalw: number) => Promise<void>;
  handleUpdateAssignmentWeight: (asgnId: string, weight: number) => Promise<void>;
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "24px", alignItems: "start" }}>
          {units.map((unit) => {
            const unitActs = activities.filter(a => a.unit_id === unit.id);
            const unitAssignments = assignments.filter(a => a.unit_id === unit.id);
            const unitExams = exams.filter(e => e.unit_id === unit.id);
            const isCollapsed = collapsedUnits[unit.id];

            return (
              <UnitCard
                key={unit.id}
                unit={unit}
                unitActs={unitActs}
                unitAssignments={unitAssignments}
                unitExams={unitExams}
                assignmentWeights={assignmentWeights}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setCollapsedUnits(prev => ({ ...prev, [unit.id]: !prev[unit.id] }))}
                onUpdatePillars={handleUpdateUnitPillars}
                onUpdateAssignmentWeight={handleUpdateAssignmentWeight}
                onOpenCapture={handleOpenCapture}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
