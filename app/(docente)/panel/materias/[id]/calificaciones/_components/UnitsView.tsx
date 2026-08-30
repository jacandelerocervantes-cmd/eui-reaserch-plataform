"use client";

import {
  BookOpen, PlusCircle, Target, Edit3, AlertTriangle,
  CheckCircle2, Trash2, Lock, FileSpreadsheet,
  GraduationCap, ChevronDown, ChevronUp
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { Unit, Activity } from "./types";

export default function UnitsView({
  units, activities, loading, collapsedUnits, setCollapsedUnits,
  getUnitTotalWeight, openNewUnitModal, handleOpenSabana, handleOpenFinalGrades,
  setActiveUnitId, setShowActivityModal, handleOpenCapture, handleDeleteActivity,
}: {
  units: Unit[];
  activities: Activity[];
  loading: boolean;
  collapsedUnits: { [key: string]: boolean };
  setCollapsedUnits: (fn: (prev: { [key: string]: boolean }) => { [key: string]: boolean }) => void;
  getUnitTotalWeight: (unitId: string) => number;
  openNewUnitModal: () => void;
  handleOpenSabana: () => void;
  handleOpenFinalGrades: () => void;
  setActiveUnitId: (id: string) => void;
  setShowActivityModal: (v: boolean) => void;
  handleOpenCapture: (unit: Unit) => void;
  handleDeleteActivity: (id: string) => void;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0" }}>Configuración de Evaluación</h1>
          <p style={{ color: "#64748b", margin: 0, fontWeight: "500", display: "flex", alignItems: "center", gap: "8px" }}>
            <Target size={18} /> Diseña las rúbricas y criterios por unidad
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={PlusCircle} label="Nueva Unidad" onClick={openNewUnitModal} variant="secondary" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
          <ExpandingButton icon={FileSpreadsheet} label="Sábana de Calificaciones" onClick={handleOpenSabana} variant="success" disabled={units.length === 0} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
          <ExpandingButton icon={GraduationCap} label="Ver Promedios Finales" onClick={handleOpenFinalGrades} variant="primary" disabled={units.length === 0} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Cargando rúbricas...</div>
      ) : units.length === 0 ? (
        <div style={{ backgroundColor: "white", padding: "60px 20px", borderRadius: "16px", border: "1px dashed #cbd5e1", textAlign: "center" }}>
          <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ color: "#1B396A", margin: "0 0 8px 0", fontSize: "1.2rem" }}>Aún no hay unidades</h3>
          <p style={{ color: "#64748b", margin: "0 0 20px 0", fontSize: "0.95rem" }}>Comienza creando tu Unidad 1 para asignar criterios y porcentajes.</p>
          <div style={{ display: "flex", justifyContent: "center" }}><ExpandingButton icon={PlusCircle} label="Crear Primera Unidad" onClick={openNewUnitModal} variant="primary" size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.9rem" durationMs={300} shadow="hover" /></div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px", alignItems: "start" }}>
          {units.map((unit) => {
            const unitActs = activities.filter(a => a.unit_id === unit.id);
            const totalWeight = getUnitTotalWeight(unit.id);
            const isPerfect = totalWeight === 100;
            const isOver = totalWeight > 100;
            const isCollapsed = collapsedUnits[unit.id];

            return (
              <div
                key={unit.id}
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
                  onClick={() => setCollapsedUnits(prev => ({...prev, [unit.id]: !prev[unit.id]}))}
                  style={{
                    cursor: "pointer",
                    padding: "20px",
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
                      <h3 style={{ margin: "4px 0 0 0", color: "#1B396A", fontSize: "1.2rem" }}>{unit.name}</h3>
                    </div>
                  </div>

                  {!unit.is_closed && (
                    <div style={{ padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px", backgroundColor: isPerfect ? "#ecfdf5" : isOver ? "#fef2f2" : "#fffbeb", color: isPerfect ? "#10b981" : isOver ? "#ef4444" : "#f59e0b" }}>
                      {isPerfect ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {totalWeight}%
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <>
                    <div
                      className="custom-scrollbar"
                      style={{
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        maxHeight: "260px",
                        overflowY: "auto"
                      }}
                    >
                      {unitActs.length === 0 ? <p style={{ color: "#94a3b8", fontSize: "0.9rem", textAlign: "center" }}>No hay criterios.</p> :
                        unitActs.map(act => (
                          <div key={act.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #f1f5f9", flexShrink: 0 }}>
                            <div>
                              <div style={{ color: "#1B396A", fontWeight: "600", fontSize: "0.9rem" }}>{act.name}</div>
                              <div style={{ color: "#10b981", fontWeight: "700", fontSize: "0.8rem", marginTop: "2px" }}>Valor: {act.weight_percentage}%</div>
                            </div>
                            {!unit.is_closed && (
                              <button onClick={() => handleDeleteActivity(act.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "6px", borderRadius: "6px", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#fee2e2"} onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))
                      }
                    </div>

                    <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0", backgroundColor: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {!unit.is_closed ? (
                        <>
                          <ExpandingButton icon={PlusCircle} label="Añadir Criterio" variant="secondary" disabled={isPerfect || isOver} onClick={() => { setActiveUnitId(unit.id); setShowActivityModal(true); }} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.85rem" durationMs={300} shadow="hover" />
                          <ExpandingButton icon={Edit3} label="Calificar" variant="primary" disabled={unitActs.length === 0} onClick={() => handleOpenCapture(unit)} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.85rem" durationMs={300} shadow="hover" />
                        </>
                      ) : (
                        <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                          <ExpandingButton icon={BookOpen} label="Ver Calificaciones" variant="secondary" onClick={() => handleOpenCapture(unit)} size={40} radius={10} gap={8} padding="0 12px" fontWeight={700} fontSize="0.85rem" durationMs={300} shadow="hover" />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
