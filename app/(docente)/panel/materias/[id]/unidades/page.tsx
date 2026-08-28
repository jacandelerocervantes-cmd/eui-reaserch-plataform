"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Edit3, X, Lock, Loader2, BookOpen, Save } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useUnidades, useUnidadesLista, type CourseUnit } from "./_hooks/useUnidades";

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

function UnidadesListInner({ resource, courseId, onReload }: { resource: Promise<CourseUnit[]>; courseId: string; onReload: () => void }) {
  const v = useUnidadesLista(resource, courseId, onReload);

  return (
    <div style={{ padding: "40px", maxWidth: "700px", margin: "0 auto" }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
                  <div style={{ display: "flex", gap: "8px" }}>
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
            <p style={{ fontSize: "0.85rem", margin: 0 }}>Agrega las unidades del programa para habilitar el cierre de asistencia por unidad.</p>
          </div>
        )}
      </div>
    </div>
  );
}
