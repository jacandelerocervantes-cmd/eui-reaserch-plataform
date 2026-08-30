"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Edit3, X, Lock, Loader2, BookOpen, Save, CheckCircle2, AlertTriangle, Sliders } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import {
  useUnidades, useUnidadesLista,
  type CourseUnit, type UnitActivity, type UnitAssignment, type UnitExam, type UnitsResourceData
} from "./_hooks/useUnidades";

export default function UnidadesPage() {
  const { id: courseId } = useParams() as { id: string };
  const { resource, onReload } = useUnidades(courseId);

  return (
    <Suspense fallback={
      <div style={{ textAlign: "center", padding: "60px" }}>
        <Loader2 size={32} color="#1B396A" />
      </div>
    }>
      <UnidadesListInner resource={resource} courseId={courseId} onReload={onReload} />
    </Suspense>
  );
}

function UnitWeightingModal({
  unit,
  activities,
  assignments,
  exams,
  onClose,
  onSavePillars,
  onSaveAsgnWeight,
}: {
  unit: CourseUnit;
  activities: UnitActivity[];
  assignments: UnitAssignment[];
  exams: UnitExam[];
  onClose: () => void;
  onSavePillars: (unitId: string, assist: number, activ: number, evalw: number) => Promise<void>;
  onSaveAsgnWeight: (asgnId: string, weight: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<'percent' | 'points'>('points');

  const unitActs = activities.filter(a => a.unit_id === unit.id);
  const unitAssignments = assignments.filter(a => a.unit_id === unit.id);
  const unitExams = exams.filter(e => e.unit_id === unit.id);

  const assistAct = unitActs.find(a => a.name.toLowerCase().includes("asist"));
  const activAct = unitActs.find(a => a.name.toLowerCase().includes("activ") || a.name.toLowerCase().includes("tarea"));
  const evalAct = unitActs.find(a => a.name.toLowerCase().includes("eval") || a.name.toLowerCase().includes("examen"));

  const [assistWeight, setAssistWeight] = useState<number>(assistAct?.weight_percentage ?? 10);
  const [activWeight, setActivWeight] = useState<number>(activAct?.weight_percentage ?? 40);
  const [evalWeight, setEvalWeight] = useState<number>(evalAct?.weight_percentage ?? 50);

  const defaultAsgnW = unitAssignments.length > 0 ? Math.round(activWeight / unitAssignments.length) : 0;
  const [asgnWeights, setAsgnWeights] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    unitAssignments.forEach(asg => {
      map[asg.id] = asg.rubric_data?.weight_percentage ?? defaultAsgnW;
    });
    return map;
  });

  const totalMacro = Number(assistWeight) + Number(activWeight) + Number(evalWeight);
  const isPerfect = totalMacro === 100;
  const sumAsgnPts = unitAssignments.reduce((acc, asg) => acc + (asgnWeights[asg.id] ?? defaultAsgnW), 0);

  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSavePillars(unit.id, Number(assistWeight), Number(activWeight), Number(evalWeight));
      for (const asg of unitAssignments) {
        if (asgnWeights[asg.id] !== undefined) {
          await onSaveAsgnWeight(asg.id, Number(asgnWeights[asg.id]));
        }
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
    }}>
      <div style={{
        backgroundColor: "white", borderRadius: "16px", width: "100%", maxWidth: "680px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        display: "flex", flexDirection: "column", overflow: "hidden", animation: "fadeIn 0.15s ease-out"
      }}>
        {/* Modal Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #e2e8f0",
          display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Sliders size={20} color="#1B396A" />
            <div>
              <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.1rem", fontWeight: "800" }}>
                Ponderación: Unidad {unit.unit_number} — {unit.title}
              </h3>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Define el peso de cada criterio de evaluación para esta unidad (Suma = 100 pts / 100%)
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px", maxHeight: "75vh", overflowY: "auto" }}>
          {/* Barra de control y estado */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{
              padding: "4px 10px", borderRadius: "8px", fontSize: "0.8rem", fontWeight: "700",
              backgroundColor: isPerfect ? "#f0fdf4" : "#fffbeb",
              color: isPerfect ? "#166534" : "#92400e",
              border: `1px solid ${isPerfect ? "#bbf7d0" : "#fde68a"}`,
              display: "inline-flex", alignItems: "center", gap: "6px"
            }}>
              {isPerfect ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              Total de la Unidad: {totalMacro} {mode === 'percent' ? '%' : 'pts'}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "2px", backgroundColor: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
              <button
                onClick={() => setMode('points')}
                style={{
                  padding: "4px 12px", fontSize: "0.75rem", fontWeight: "700", border: "none",
                  borderRadius: "6px", cursor: "pointer",
                  backgroundColor: mode === 'points' ? "#ffffff" : "transparent",
                  color: mode === 'points' ? "#1B396A" : "#64748b",
                  boxShadow: mode === 'points' ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Puntos (pts)
              </button>
              <button
                onClick={() => setMode('percent')}
                style={{
                  padding: "4px 12px", fontSize: "0.75rem", fontWeight: "700", border: "none",
                  borderRadius: "6px", cursor: "pointer",
                  backgroundColor: mode === 'percent' ? "#ffffff" : "transparent",
                  color: mode === 'percent' ? "#1B396A" : "#64748b",
                  boxShadow: mode === 'percent' ? "0 1px 2px rgba(0,0,0,0.08)" : "none"
                }}
              >
                Porcentaje (%)
              </button>
            </div>
          </div>

          {/* Pilares Macro */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Asistencia */}
            <div style={{ backgroundColor: "white", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                  style={{ width: "55px", padding: "6px", borderRadius: "6px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "700", color: "#1B396A", outline: "none", fontSize: "0.85rem" }}
                />
                <span style={{ fontWeight: "700", color: "#64748b", fontSize: "0.8rem" }}>{mode === 'percent' ? '%' : 'pts'}</span>
              </div>
            </div>

            {/* Actividades */}
            <div style={{ backgroundColor: "#eff6ff", padding: "14px 16px", borderRadius: "10px", border: "1px solid #bfdbfe", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#1e40af", fontWeight: "700", fontSize: "0.85rem" }}>Actividades y Tareas</div>
                  <div style={{ color: "#3b82f6", fontSize: "0.75rem" }}>{unitAssignments.length} tareas vinculadas</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number" min="0" max="100"
                    disabled={unit.is_closed}
                    value={activWeight}
                    onChange={(e) => setActivWeight(Number(e.target.value))}
                    style={{ width: "55px", padding: "6px", borderRadius: "6px", border: "1px solid #93c5fd", textAlign: "center", fontWeight: "700", color: "#1e40af", outline: "none", fontSize: "0.85rem", backgroundColor: "white" }}
                  />
                  <span style={{ fontWeight: "700", color: "#1e40af", fontSize: "0.8rem" }}>{mode === 'percent' ? '%' : 'pts'}</span>
                </div>
              </div>

              {unitAssignments.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid #dbeafe", paddingTop: "8px" }}>
                  <div style={{ fontSize: "0.72rem", color: "#1e40af", display: "flex", justifyContent: "space-between", fontWeight: "700" }}>
                    <span>Desglose por tarea:</span>
                    <span>
                      {mode === 'points'
                        ? `Suma: ${sumAsgnPts} / ${activWeight} pts`
                        : `Suma: ${activWeight > 0 ? ((sumAsgnPts / activWeight) * 100).toFixed(0) : 0}% / 100%`}
                    </span>
                  </div>
                  {unitAssignments.map(asg => {
                    const currentPts = asgnWeights[asg.id] ?? defaultAsgnW;
                    const relPercent = activWeight > 0 ? Number(((currentPts / activWeight) * 100).toFixed(1)) : 0;

                    return (
                      <div key={asg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: "6px 10px", borderRadius: "6px", border: "1px solid #dbeafe" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", maxWidth: "60%" }}>
                          <span style={{ fontSize: "0.78rem", color: "#1e293b", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asg.title}</span>
                          <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "600" }}>
                            {mode === 'points'
                              ? `(${relPercent.toFixed(0)}% del pilar)`
                              : `(${currentPts.toFixed(1)} pts)`}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          {mode === 'points' ? (
                            <input
                              type="number" min="0" max={activWeight}
                              disabled={unit.is_closed}
                              value={currentPts}
                              onChange={(e) => setAsgnWeights({ ...asgnWeights, [asg.id]: Number(e.target.value) })}
                              style={{ width: "45px", padding: "4px", borderRadius: "4px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "700", fontSize: "0.78rem" }}
                            />
                          ) : (
                            <input
                              type="number" min="0" max="100"
                              disabled={unit.is_closed}
                              value={relPercent}
                              onChange={(e) => {
                                const newPct = Number(e.target.value);
                                const newPts = Math.round((newPct / 100) * activWeight);
                                setAsgnWeights({ ...asgnWeights, [asg.id]: newPts });
                              }}
                              style={{ width: "45px", padding: "4px", borderRadius: "4px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "700", fontSize: "0.78rem" }}
                            />
                          )}
                          <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: "700" }}>{mode === 'percent' ? '%' : 'pts'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Evaluaciones */}
            <div style={{ backgroundColor: "#fffbeb", padding: "14px 16px", borderRadius: "10px", border: "1px solid #fde68a", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#92400e", fontWeight: "700", fontSize: "0.85rem" }}>Evaluaciones / Exámenes</div>
                  <div style={{ color: "#d97706", fontSize: "0.75rem" }}>{unitExams.length} exámenes vinculados</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number" min="0" max="100"
                    disabled={unit.is_closed}
                    value={evalWeight}
                    onChange={(e) => setEvalWeight(Number(e.target.value))}
                    style={{ width: "55px", padding: "6px", borderRadius: "6px", border: "1px solid #fcd34d", textAlign: "center", fontWeight: "700", color: "#92400e", outline: "none", fontSize: "0.85rem", backgroundColor: "white" }}
                  />
                  <span style={{ fontWeight: "700", color: "#92400e", fontSize: "0.8rem" }}>{mode === 'percent' ? '%' : 'pts'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid #e2e8f0",
          display: "flex", justifyContent: "flex-end", gap: "10px", backgroundColor: "#f8fafc"
        }}>
          <ExpandingButton icon={X} label="Cancelar" onClick={onClose} variant="default" size={40} radius={10} gap={8} padding="0 14px" fontWeight={600} durationMs={300} colors={{ hoverText: "#64748b" }} />
          {!unit.is_closed && (
            <ExpandingButton icon={Save} label={saving ? "Guardando..." : "Guardar Ponderación"} onClick={handleSave} disabled={saving} variant="primary" size={40} radius={10} gap={8} padding="0 14px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
          )}
        </div>
      </div>
    </div>
  );
}

function UnidadesListInner({ resource, courseId, onReload }: { resource: Promise<UnitsResourceData>; courseId: string; onReload: () => void }) {
  const v = useUnidadesLista(resource, courseId, onReload);
  const [modalUnit, setModalUnit] = useState<CourseUnit | null>(null);

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "800", margin: 0 }}>Unidades de Aprendizaje</h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "4px 0 0" }}>
            {v.activeUnit
              ? `Unidad activa: ${v.activeUnit.unit_number} — ${v.activeUnit.title}`
              : v.units.length > 0 ? "Todas las unidades están cerradas" : "Sin unidades configuradas"}
          </p>
        </div>
        <ExpandingButton icon={Plus} label="Agregar Unidad" onClick={() => v.setIsAdding(true)} disabled={v.isAdding || v.saving} size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {v.units.map((unit: CourseUnit) => (
          <div key={unit.id} style={{
            backgroundColor: "white", borderRadius: "16px", padding: "20px 24px",
            border: `2px solid ${v.activeUnit?.id === unit.id ? "#1B396A" : "#e2e8f0"}`,
            display: "flex", alignItems: "center", gap: "16px",
            transition: "border-color 0.2s"
          }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
              backgroundColor: unit.is_closed ? "#f1f5f9" : "#1B396A",
              color: unit.is_closed ? "#94a3b8" : "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: "900", fontSize: "1.1rem"
            }}>
              {unit.is_closed ? <Lock size={16} /> : unit.unit_number}
            </div>

            {v.editingId === unit.id ? (
              <div style={{ flex: 1, display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={v.editValues.title}
                  onChange={(e) => v.setEditValues({ ...v.editValues, title: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && v.handleEdit(unit.id)}
                  style={{ flex: 1, minWidth: "160px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #1B396A", fontWeight: "600", outline: "none", fontFamily: "inherit" }}
                  autoFocus
                />
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="number" min="1" max="30"
                    value={v.editValues.total_sessions}
                    onChange={(e) => v.setEditValues({ ...v.editValues, total_sessions: Number(e.target.value) })}
                    style={{ width: "60px", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center", fontFamily: "inherit" }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>ses.</span>
                </div>
                <ExpandingButton icon={Save} label="Guardar" onClick={() => v.handleEdit(unit.id)} disabled={v.saving} size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300} />
                <ExpandingButton icon={X} label="Cancelar" onClick={() => v.setEditingId(null)} variant="default" size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300} colors={{ hoverText: "#64748b" }} />
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "700", color: unit.is_closed ? "#94a3b8" : "#1e293b", fontSize: "0.95rem" }}>
                      {unit.title}
                    </span>
                    {v.activeUnit?.id === unit.id && (
                      <span style={{ fontSize: "0.68rem", backgroundColor: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: "6px", fontWeight: "700" }}>
                        ACTIVA
                      </span>
                    )}
                    {unit.is_closed && (
                      <span style={{ fontSize: "0.68rem", backgroundColor: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: "6px", fontWeight: "700" }}>
                        CERRADA
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "3px" }}>
                    {unit.total_sessions} sesiones contempladas
                    {unit.closed_at && ` · Cerrada el ${new Date(unit.closed_at).toLocaleDateString("es-MX")}`}
                  </div>
                </div>

                {!unit.is_closed && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <ExpandingButton
                      icon={Sliders}
                      label="Ponderación"
                      onClick={() => setModalUnit(unit)}
                      variant="secondary"
                      size={40} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300}
                    />
                    <ExpandingButton
                      icon={Edit3} label="Editar"
                      onClick={() => { v.setEditingId(unit.id); v.setEditValues({ title: unit.title, total_sessions: unit.total_sessions }); }}
                      variant="default"
                      size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300}
                      colors={{ hoverText: "#64748b" }}
                    />
                    <ExpandingButton
                      icon={Trash2} label="Eliminar"
                      onClick={() => v.handleDelete(unit.id, unit.unit_number)}
                      variant="danger"
                      size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300}
                      colors={{ bg: "white", hoverBg: "#ef4444", text: "#ef4444", hoverText: "white", border: "#cbd5e1" }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {v.isAdding && (
          <div style={{ backgroundColor: "#f8fafc", borderRadius: "16px", padding: "20px 24px", border: "2px dashed #cbd5e1" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                placeholder={`Ej. Unidad ${v.units.length + 1}: Métodos cualitativos`}
                value={v.newUnit.title}
                onChange={(e) => v.setNewUnit({ ...v.newUnit, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && v.handleAdd()}
                style={{ flex: 1, minWidth: "200px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.9rem", fontFamily: "inherit" }}
                autoFocus
              />
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="number" min="1" max="30"
                  value={v.newUnit.total_sessions}
                  onChange={(e) => v.setNewUnit({ ...v.newUnit, total_sessions: Number(e.target.value) })}
                  style={{ width: "64px", padding: "10px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "center", fontFamily: "inherit" }}
                />
                <span style={{ fontSize: "0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>sesiones</span>
              </div>
              <ExpandingButton icon={v.saving ? Loader2 : Save} label="Agregar" onClick={v.handleAdd} disabled={v.saving || !v.newUnit.title.trim()} size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300} />
              <ExpandingButton icon={X} label="Cancelar" onClick={() => { v.setIsAdding(false); v.setNewUnit({ title: "", total_sessions: 8 }); }} variant="default" size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300} colors={{ hoverText: "#64748b" }} />
            </div>
          </div>
        )}

        {v.units.length === 0 && !v.isAdding && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <BookOpen size={48} style={{ opacity: 0.2, margin: "0 auto 16px", display: "block" }} />
            <p style={{ fontWeight: "700", margin: "0 0 6px" }}>Sin unidades configuradas</p>
            <p style={{ fontSize: "0.85rem", margin: 0 }}>Agrega las unidades del programa para configurar sus ponderaciones y sesiones.</p>
          </div>
        )}
      </div>

      {modalUnit && (
        <UnitWeightingModal
          unit={modalUnit}
          activities={v.activities}
          assignments={v.assignments}
          exams={v.exams}
          onClose={() => setModalUnit(null)}
          onSavePillars={v.handleUpdateUnitPillars}
          onSaveAsgnWeight={v.handleUpdateAssignmentWeight}
        />
      )}
    </div>
  );
}
