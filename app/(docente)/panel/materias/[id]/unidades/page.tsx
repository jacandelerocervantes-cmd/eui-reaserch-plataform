"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import {
  Plus, Trash2, X, Loader2, BookOpen, Save,
  CheckCircle2, AlertTriangle, Sliders, Calendar
} from "lucide-react";
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
      <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
        <p style={{ color: "#64748b", fontWeight: "700" }}>Cargando unidades de aprendizaje...</p>
      </div>
    }>
      <UnidadesListInner resource={resource} courseId={courseId} onReload={onReload} />
    </Suspense>
  );
}

function UnitConfigModal({
  unit,
  activities,
  assignments,
  exams,
  onClose,
  onSaveFull,
}: {
  unit: CourseUnit;
  activities: UnitActivity[];
  assignments: UnitAssignment[];
  exams: UnitExam[];
  onClose: () => void;
  onSaveFull: (
    unitId: string,
    title: string,
    totalSessions: number,
    assistWeight: number,
    activWeight: number,
    evalWeight: number,
    asgnWeights: Record<string, number>
  ) => Promise<void>;
}) {
  const [mode, setMode] = useState<'percent' | 'points'>('points');
  const [title, setTitle] = useState(unit.title);
  const [totalSessions, setTotalSessions] = useState(unit.total_sessions);

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
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSaveFull(
        unit.id,
        title.trim(),
        Number(totalSessions),
        Number(assistWeight),
        Number(activWeight),
        Number(evalWeight),
        asgnWeights
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
      }}
    >
      <div style={{
        backgroundColor: "white", borderRadius: "20px", width: "100%", maxWidth: "680px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
        display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "90vh"
      }}>
        {/* Modal Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid #e2e8f0",
          display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Sliders size={22} color="#1B396A" />
            <div>
              <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.2rem", fontWeight: "900" }}>
                Configurar Unidad {unit.unit_number}
              </h3>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Ponderación, sesiones y criterios de evaluación (Total = 100 pts)
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "6px" }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>
          {/* Datos básicos de la unidad */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "240px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#1B396A" }}>Título de la Unidad</label>
              <input
                value={title}
                disabled={unit.is_closed}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Introducción y Fundamentos"
                style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.9rem", outline: "none", fontWeight: "600" }}
              />
            </div>
            <div style={{ width: "120px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#1B396A" }}>Sesiones</label>
              <input
                type="number" min="1" max="50"
                disabled={unit.is_closed}
                value={totalSessions}
                onChange={(e) => setTotalSessions(Number(e.target.value))}
                style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.9rem", textAlign: "center", outline: "none", fontWeight: "700" }}
              />
            </div>
          </div>

          {/* Barra de control y switch Puntos / Porcentaje */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
            <div style={{
              padding: "4px 12px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "800",
              backgroundColor: isPerfect ? "#f0fdf4" : "#fffbeb",
              color: isPerfect ? "#166534" : "#92400e",
              border: `1px solid ${isPerfect ? "#bbf7d0" : "#fde68a"}`,
              display: "inline-flex", alignItems: "center", gap: "6px"
            }}>
              {isPerfect ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              Total: {totalMacro.toFixed(0)} {mode === 'percent' ? '%' : 'pts'} {isPerfect ? "(100%)" : "(debe sumar 100)"}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "2px", backgroundColor: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
              <button
                type="button"
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
                type="button"
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
                  {unitAssignments.map((asg, idx) => {
                    const currentPts = asgnWeights[asg.id] ?? defaultAsgnW;
                    const relPercent = activWeight > 0 ? Number(((currentPts / activWeight) * 100).toFixed(1)) : 0;

                    return (
                      <div key={asg.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: "6px 10px", borderRadius: "6px", border: "1px solid #dbeafe" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", maxWidth: "65%" }}>
                          <span style={{ fontSize: "0.78rem", color: "#1e293b", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            A{idx + 1}: {asg.title}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "600", flexShrink: 0 }}>
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
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px", borderRadius: "10px", border: "1px solid #cbd5e1",
              backgroundColor: "white", color: "#64748b", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer"
            }}
          >
            Cancelar
          </button>
          {!unit.is_closed && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              style={{
                padding: "10px 20px", borderRadius: "10px", border: "none",
                backgroundColor: saving || !title.trim() ? "#cbd5e1" : "#1B396A",
                color: "white", fontWeight: 800, fontSize: "0.85rem",
                cursor: saving || !title.trim() ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", gap: "6px"
              }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
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
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header Institucional Unificado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>
            Unidades de Aprendizaje
          </h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>
            {v.activeUnit
              ? `Unidad activa: ${v.activeUnit.unit_number} — ${v.activeUnit.title}`
              : v.units.length > 0 ? "Todas las unidades están cerradas" : "Configura las unidades del programa, sesiones y ponderaciones"}
          </p>
        </div>
        <ExpandingButton icon={Plus} label="Agregar Unidad" onClick={() => v.setIsAdding(true)} disabled={v.isAdding || v.saving} variant="primary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
      </div>

      {/* Formulario para Agregar Unidad Nueva */}
      {v.isAdding && (
        <div style={{ backgroundColor: "#f8fafc", borderRadius: "20px", padding: "24px", border: "2px dashed #cbd5e1", display: "flex", flexDirection: "column", gap: "16px" }}>
          <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.1rem", fontWeight: "800" }}>
            Nueva Unidad {v.units.length + 1}
          </h3>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              placeholder={`Ej. Unidad ${v.units.length + 1}: Métodos cualitativos`}
              value={v.newUnit.title}
              onChange={(e) => v.setNewUnit({ ...v.newUnit, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && v.handleAdd()}
              style={{ flex: 1, minWidth: "240px", padding: "12px 16px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.95rem", fontFamily: "inherit", fontWeight: "600", outline: "none" }}
              autoFocus
            />
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="number" min="1" max="50"
                value={v.newUnit.total_sessions}
                onChange={(e) => v.setNewUnit({ ...v.newUnit, total_sessions: Number(e.target.value) })}
                style={{ width: "70px", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", textAlign: "center", fontFamily: "inherit", fontWeight: "700", outline: "none" }}
              />
              <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "600" }}>sesiones</span>
            </div>
            <ExpandingButton icon={v.saving ? Loader2 : Save} label="Guardar Unidad" onClick={v.handleAdd} disabled={v.saving || !v.newUnit.title.trim()} variant="primary" size={44} radius={10} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
            <ExpandingButton icon={X} label="Cancelar" onClick={() => { v.setIsAdding(false); v.setNewUnit({ title: "", total_sessions: 8 }); }} variant="default" size={44} radius={10} gap={10} padding="0 16px" fontWeight={600} durationMs={300} colors={{ hoverText: "#64748b" }} />
          </div>
        </div>
      )}

      {/* Grid de Unidades */}
      {v.units.length === 0 && !v.isAdding ? (
        <div style={{ textAlign: "center", padding: "80px 20px", backgroundColor: "#f8fafc", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
          <BookOpen size={48} color="#cbd5e1" style={{ margin: "0 auto 16px", display: "block" }} />
          <h3 style={{ color: "#1B396A", fontSize: "1.2rem", fontWeight: "800", margin: 0 }}>Sin unidades configuradas</h3>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "24px" }}>
          {v.units.map((unit: CourseUnit) => {
            const unitActs = v.activities.filter(a => a.unit_id === unit.id);
            const unitAsgns = v.assignments.filter(a => a.unit_id === unit.id);
            const unitExams = v.exams.filter(e => e.unit_id === unit.id);

            const assist = unitActs.find(a => a.name.toLowerCase().includes("asist"))?.weight_percentage ?? 10;
            const activ = unitActs.find(a => a.name.toLowerCase().includes("activ") || a.name.toLowerCase().includes("tarea"))?.weight_percentage ?? 40;
            const evalw = unitActs.find(a => a.name.toLowerCase().includes("eval") || a.name.toLowerCase().includes("examen"))?.weight_percentage ?? 50;

            const isActive = v.activeUnit?.id === unit.id;

            return (
              <div
                key={unit.id}
                style={{
                  backgroundColor: "white", borderRadius: "20px", border: `1px solid ${isActive ? "#1B396A" : "#e2e8f0"}`,
                  boxShadow: isActive ? "0 10px 15px -3px rgba(27, 57, 106, 0.08)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
                  display: "flex", flexDirection: "column", overflow: "hidden"
                }}
              >
                <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{
                      fontSize: "0.75rem", fontWeight: "800",
                      color: unit.is_closed ? "#64748b" : (isActive ? "#1d4ed8" : "#1B396A"),
                      backgroundColor: unit.is_closed ? "#f1f5f9" : (isActive ? "#dbeafe" : "#f0f7ff"),
                      padding: "4px 10px", borderRadius: "8px", textTransform: "uppercase"
                    }}>
                      Unidad {unit.unit_number} {isActive && "· ACTIVA"} {unit.is_closed && "· CERRADA"}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>
                      <Calendar size={13} /> {unit.total_sessions} sesiones
                    </div>
                  </div>

                  <h3 style={{ margin: "0 0 10px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800", lineHeight: "1.3" }}>
                    {unit.title}
                  </h3>

                  {/* Resumen de Ponderación */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "auto", paddingTop: "12px" }}>
                    <span style={{ fontSize: "0.75rem", color: "#1e40af", backgroundColor: "#eff6ff", padding: "3px 8px", borderRadius: "6px", fontWeight: "700" }}>
                      Asistencia: {assist} pts
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#166534", backgroundColor: "#f0fdf4", padding: "3px 8px", borderRadius: "6px", fontWeight: "700" }}>
                      Actividades: {activ} pts ({unitAsgns.length} tareas)
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#92400e", backgroundColor: "#fffbeb", padding: "3px 8px", borderRadius: "6px", fontWeight: "700" }}>
                      Evaluaciones: {evalw} pts ({unitExams.length} exámenes)
                    </span>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9", padding: "14px 20px", display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fafbfc" }}>
                  <button
                    type="button"
                    onClick={() => setModalUnit(unit)}
                    style={{
                      padding: "10px 18px", borderRadius: "10px", border: "none",
                      backgroundColor: "#1B396A", color: "white", fontWeight: 800, fontSize: "0.85rem",
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px",
                      transition: "transform 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                  >
                    <Sliders size={16} /> Configurar Unidad
                  </button>
                  {!unit.is_closed && (
                    <button
                      type="button"
                      onClick={() => v.handleDelete(unit.id, unit.unit_number)}
                      style={{
                        padding: "10px 14px", borderRadius: "10px", border: "1px solid #fee2e2",
                        backgroundColor: "white", color: "#ef4444", fontWeight: 700, fontSize: "0.85rem",
                        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px"
                      }}
                    >
                      <Trash2 size={16} /> Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Integral de Unidad */}
      {modalUnit && (
        <UnitConfigModal
          unit={modalUnit}
          activities={v.activities}
          assignments={v.assignments}
          exams={v.exams}
          onClose={() => setModalUnit(null)}
          onSaveFull={v.handleUpdateUnitFull}
        />
      )}
    </div>
  );
}
