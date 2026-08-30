"use client";

import { useState } from "react";
import {
  BookOpen, PlusCircle, Target, Edit3, AlertTriangle,
  CheckCircle2, Lock, FileSpreadsheet,
  GraduationCap, ChevronDown, ChevronRight, Save, SlidersHorizontal
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

  const [mode, setMode] = useState<'percent' | 'points'>('percent');
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
        borderRadius: "14px",
        border: `1px solid ${unit.is_closed ? "#cbd5e1" : "#e2e8f0"}`,
        overflow: "hidden",
        boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
        opacity: unit.is_closed ? 0.9 : 1,
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.2s ease, border-color 0.2s ease"
      }}
    >
      {/* Header Compacto (Siempre Visible) */}
      <div
        style={{
          padding: "16px 20px",
          backgroundColor: unit.is_closed ? "#f8fafc" : "#ffffff",
          borderBottom: isCollapsed ? "none" : "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          cursor: "pointer",
        }}
        onClick={onToggleCollapse}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
          <div style={{ color: "#64748b", display: "flex", alignItems: "center" }}>
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                Unidad {unit.unit_number} {unit.is_closed && "(Cerrada)"}
              </span>
              {unit.is_closed && <Lock size={13} color="#94a3b8" />}
            </div>
            <h3 style={{ margin: "2px 0 0 0", color: "#1B396A", fontSize: "1.05rem", fontWeight: "700" }}>
              {unit.name}
            </h3>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
            {isPerfect ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {totalMacro} {mode === 'percent' ? '%' : 'pts'}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenCapture(unit);
            }}
            style={{
              backgroundColor: "#1B396A",
              color: "white",
              border: "none",
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "0.8rem",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#244b8a"}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#1B396A"}
          >
            <Edit3 size={14} /> Calificar
          </button>
        </div>
      </div>

      {/* Resumen Rápido cuando está Colapsado */}
      {isCollapsed && (
        <div style={{ padding: "10px 20px", backgroundColor: "#f8fafc", borderTop: "1px solid #f1f5f9", display: "flex", gap: "16px", fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>
          <span>Asistencia: {assistWeight}%</span>
          <span>•</span>
          <span>Actividades: {activWeight}% ({unitAssignments.length} tareas)</span>
          <span>•</span>
          <span>Evaluaciones: {evalWeight}% ({unitExams.length} exámenes)</span>
        </div>
      )}

      {/* Detalle Expandido */}
      {!isCollapsed && (
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", backgroundColor: "#fafafa" }}>
          {/* Barra de Control de Modo */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>
              Ponderación de la Unidad
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: "#e2e8f0", padding: "2px", borderRadius: "8px" }}>
              <button
                onClick={() => setMode('percent')}
                style={{
                  padding: "4px 10px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  backgroundColor: mode === 'percent' ? "#ffffff" : "transparent",
                  color: mode === 'percent' ? "#1B396A" : "#64748b",
                  boxShadow: mode === 'percent' ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Porcentaje (%)
              </button>
              <button
                onClick={() => setMode('points')}
                style={{
                  padding: "4px 10px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  backgroundColor: mode === 'points' ? "#ffffff" : "transparent",
                  color: mode === 'points' ? "#1B396A" : "#64748b",
                  boxShadow: mode === 'points' ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Puntos (pts)
              </button>
            </div>
          </div>

          {/* Pilares Macro */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* Asistencia */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ color: "#1B396A", fontWeight: "700", fontSize: "0.85rem" }}>Asistencia</div>
                <div style={{ color: "#64748b", fontSize: "0.75rem" }}>Pases de lista de la unidad</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="number" min="0" max="100"
                  disabled={unit.is_closed}
                  value={assistWeight}
                  onChange={(e) => setAssistWeight(Number(e.target.value))}
                  style={{ width: "55px", padding: "5px", borderRadius: "6px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "700", color: "#1B396A", outline: "none", fontSize: "0.85rem" }}
                />
                <span style={{ fontWeight: "700", color: "#64748b", fontSize: "0.8rem" }}>{mode === 'percent' ? '%' : 'pts'}</span>
              </div>
            </div>

            {/* Actividades */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#1B396A", fontWeight: "700", fontSize: "0.85rem" }}>Actividades y Tareas</div>
                  <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{unitAssignments.length} actividades vinculadas</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number" min="0" max="100"
                    disabled={unit.is_closed}
                    value={activWeight}
                    onChange={(e) => setActivWeight(Number(e.target.value))}
                    style={{ width: "55px", padding: "5px", borderRadius: "6px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "700", color: "#1B396A", outline: "none", fontSize: "0.85rem" }}
                  />
                  <span style={{ fontWeight: "700", color: "#64748b", fontSize: "0.8rem" }}>{mode === 'percent' ? '%' : 'pts'}</span>
                </div>
              </div>

              {/* Desglose individual de actividades */}
              {unitAssignments.length > 0 && (
                <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                  <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "700", display: "flex", justifyContent: "space-between" }}>
                    <span>Desglose por actividad:</span>
                    <span>Suma: {sumAsgnWeights} / {activWeight} {mode === 'percent' ? '%' : 'pts'}</span>
                  </div>
                  {unitAssignments.map(asgn => {
                    const currentPts = localAsgnWeights[asgn.id] ?? defaultAsgnWeight;
                    const percentOfPillar = activWeight > 0 ? ((currentPts / activWeight) * 100).toFixed(0) : "0";
                    return (
                      <div key={asgn.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                        <div>
                          <span style={{ fontSize: "0.8rem", color: "#334155", fontWeight: "600" }}>{asgn.title}</span>
                          <span style={{ fontSize: "0.7rem", color: "#64748b", marginLeft: "6px", fontWeight: "500" }}>
                            ({percentOfPillar}% del pilar)
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input
                            type="number" min="0" max="100"
                            disabled={unit.is_closed}
                            value={currentPts}
                            onChange={(e) => setLocalAsgnWeights({ ...localAsgnWeights, [asgn.id]: Number(e.target.value) })}
                            style={{ width: "45px", padding: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "700", fontSize: "0.8rem", backgroundColor: "white" }}
                          />
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{mode === 'percent' ? '%' : 'pts'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Evaluaciones */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#1B396A", fontWeight: "700", fontSize: "0.85rem" }}>Evaluaciones / Exámenes</div>
                  <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{unitExams.length} exámenes vinculados</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number" min="0" max="100"
                    disabled={unit.is_closed}
                    value={evalWeight}
                    onChange={(e) => setEvalWeight(Number(e.target.value))}
                    style={{ width: "55px", padding: "5px", borderRadius: "6px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "700", color: "#1B396A", outline: "none", fontSize: "0.85rem" }}
                  />
                  <span style={{ fontWeight: "700", color: "#64748b", fontSize: "0.8rem" }}>{mode === 'percent' ? '%' : 'pts'}</span>
                </div>
              </div>

              {unitExams.length > 0 && (
                <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                  {unitExams.map(ex => (
                    <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "0.8rem", color: "#334155", fontWeight: "600" }}>{ex.title}</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#1B396A" }}>{evalWeight} {mode === 'percent' ? '%' : 'pts'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
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
            const isCollapsed = collapsedUnits[unit.id] ?? true;

            return (
              <UnitCard
                key={unit.id}
                unit={unit}
                unitActs={unitActs}
                unitAssignments={unitAssignments}
                unitExams={unitExams}
                assignmentWeights={assignmentWeights}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setCollapsedUnits(prev => ({ ...prev, [unit.id]: !(prev[unit.id] ?? true) }))}
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
