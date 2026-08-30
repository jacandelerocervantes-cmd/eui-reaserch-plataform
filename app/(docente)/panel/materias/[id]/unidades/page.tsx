"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Edit3, X, Lock, Loader2, BookOpen, Save, CheckCircle2, AlertTriangle, Sliders } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import {
  useUnidades, useUnidadesLista,
  type CourseUnit, type UnitActivity, type UnitAssignment, type UnitExam
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

function UnitWeightingConfig({
  unit,
  activities,
  assignments,
  exams,
  onSavePillars,
  onSaveAsgnWeight,
}: {
  unit: CourseUnit;
  activities: UnitActivity[];
  assignments: UnitAssignment[];
  exams: UnitExam[];
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
      alert("Ponderación guardada exitosamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "16px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sliders size={16} color="#1B396A" />
          <span style={{ fontWeight: "700", color: "#1B396A", fontSize: "0.85rem" }}>Configuración de Ponderación</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: "700",
              backgroundColor: isPerfect ? "#f0fdf4" : "#fffbeb",
              color: isPerfect ? "#166534" : "#92400e",
              border: `1px solid ${isPerfect ? "#bbf7d0" : "#fde68a"}`,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            {isPerfect ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            Total: {totalMacro} {mode === 'percent' ? '%' : 'pts'}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "2px", backgroundColor: "#e2e8f0", padding: "2px", borderRadius: "6px" }}>
          <button
            onClick={() => setMode('points')}
            style={{
              padding: "3px 8px",
              fontSize: "0.7rem",
              fontWeight: "700",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              backgroundColor: mode === 'points' ? "#ffffff" : "transparent",
              color: mode === 'points' ? "#1B396A" : "#64748b"
            }}
          >
            Puntos (pts)
          </button>
          <button
            onClick={() => setMode('percent')}
            style={{
              padding: "3px 8px",
              fontSize: "0.7rem",
              fontWeight: "700",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              backgroundColor: mode === 'percent' ? "#ffffff" : "transparent",
              color: mode === 'percent' ? "#1B396A" : "#64748b"
            }}
          >
            Porcentaje (%)
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
        {/* Asistencia */}
        <div style={{ backgroundColor: "white", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "#1e293b", fontWeight: "600" }}>Asistencia</span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="number" min="0" max="100"
              disabled={unit.is_closed}
              value={assistWeight}
              onChange={(e) => setAssistWeight(Number(e.target.value))}
              style={{ width: "45px", padding: "4px", borderRadius: "4px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "700", fontSize: "0.8rem" }}
            />
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{mode === 'percent' ? '%' : 'pts'}</span>
          </div>
        </div>

        {/* Actividades */}
        <div style={{ backgroundColor: "#eff6ff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #bfdbfe", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#1e40af", fontWeight: "700" }}>Actividades ({unitAssignments.length})</span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="number" min="0" max="100"
                disabled={unit.is_closed}
                value={activWeight}
                onChange={(e) => setActivWeight(Number(e.target.value))}
                style={{ width: "45px", padding: "4px", borderRadius: "4px", border: "1px solid #93c5fd", textAlign: "center", fontWeight: "700", fontSize: "0.8rem", backgroundColor: "white" }}
              />
              <span style={{ fontSize: "0.75rem", color: "#1e40af" }}>{mode === 'percent' ? '%' : 'pts'}</span>
            </div>
          </div>

          {unitAssignments.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid #dbeafe", paddingTop: "6px" }}>
              <div style={{ fontSize: "0.68rem", color: "#1e40af", display: "flex", justifyContent: "space-between", fontWeight: "700" }}>
                <span>Desglose tareas:</span>
                <span>{sumAsgnPts} / {activWeight} {mode === 'percent' ? '%' : 'pts'}</span>
              </div>
              {unitAssignments.map(asg => {
                const currentVal = asgnWeights[asg.id] ?? defaultAsgnW;
                const relP = activWeight > 0 ? ((currentVal / activWeight) * 100).toFixed(0) : "0";
                return (
                  <div key={asg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: "4px 8px", borderRadius: "4px", border: "1px solid #dbeafe" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", maxWidth: "60%" }}>
                      <span style={{ fontSize: "0.72rem", color: "#1e293b", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asg.title}</span>
                      <span style={{ fontSize: "0.68rem", color: "#64748b" }}>({relP}%)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="number" min="0" max="100"
                        disabled={unit.is_closed}
                        value={currentVal}
                        onChange={(e) => setAsgnWeights({ ...asgnWeights, [asg.id]: Number(e.target.value) })}
                        style={{ width: "38px", padding: "2px", borderRadius: "4px", border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "700", fontSize: "0.72rem" }}
                      />
                      <span style={{ fontSize: "0.68rem", color: "#64748b" }}>{mode === 'percent' ? '%' : 'pts'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Evaluaciones */}
        <div style={{ backgroundColor: "#fffbeb", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde68a", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#92400e", fontWeight: "700" }}>Evaluaciones ({unitExams.length})</span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="number" min="0" max="100"
                disabled={unit.is_closed}
                value={evalWeight}
                onChange={(e) => setEvalWeight(Number(e.target.value))}
                style={{ width: "45px", padding: "4px", borderRadius: "4px", border: "1px solid #fcd34d", textAlign: "center", fontWeight: "700", fontSize: "0.8rem", backgroundColor: "white" }}
              />
              <span style={{ fontSize: "0.75rem", color: "#92400e" }}>{mode === 'percent' ? '%' : 'pts'}</span>
            </div>
          </div>
        </div>
      </div>

      {!unit.is_closed && (
        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #e2e8f0", paddingTop: "8px" }}>
          <ExpandingButton icon={Save} label={saving ? "Guardando..." : "Guardar Ponderación"} onClick={handleSave} disabled={saving} variant="secondary" size={36} radius={8} gap={6} padding="0 10px" fontWeight={600} fontSize="0.8rem" durationMs={300} />
        </div>
      )}
    </div>
  );
}

function UnidadesListInner({ resource, courseId, onReload }: { resource: Promise<any>; courseId: string; onReload: () => void }) {
  const v = useUnidadesLista(resource, courseId, onReload);
  const [configUnitId, setConfigUnitId] = useState<string | null>(null);

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
            display: "flex", flexDirection: "column", gap: "12px",
            transition: "border-color 0.2s"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
                        label={configUnitId === unit.id ? "Ocultar Ponderación" : "Ponderar"}
                        onClick={() => setConfigUnitId(configUnitId === unit.id ? null : unit.id)}
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

            {configUnitId === unit.id && (
              <UnitWeightingConfig
                unit={unit}
                activities={v.activities}
                assignments={v.assignments}
                exams={v.exams}
                onSavePillars={v.handleUpdateUnitPillars}
                onSaveAsgnWeight={v.handleUpdateAssignmentWeight}
              />
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
    </div>
  );
}
