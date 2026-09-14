"use client";

import { useState } from "react";
import { Save, X, Plus, Maximize2, Minimize2 } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import ActivityChatAssistant from "./ActivityChatAssistant";

export default function RubricSection({
  rubrics, totalRubricWeight, isRubricValid, handleUpdateRubric, handleRemoveRubricRow, handleAddRubricRow,
  isGenerating, handleChatRubricTurn, rubricSourceFile, setRubricSourceFile,
  isSaving, handleSave, hasDuplicateSeed,
}: {
  rubrics: { id: number; name: string; description: string; weight: number }[];
  totalRubricWeight: number;
  isRubricValid: boolean;
  handleUpdateRubric: (id: number, field: string, value: string | number) => void;
  handleRemoveRubricRow: (id: number) => void;
  handleAddRubricRow: () => void;
  isGenerating: boolean;
  handleChatRubricTurn: (message: string) => Promise<string>;
  rubricSourceFile: File | null;
  setRubricSourceFile: (f: File | null) => void;
  isSaving: boolean;
  handleSave: (e?: React.FormEvent) => void | Promise<void>;
  hasDuplicateSeed?: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const toggleExpanded = (id: number) => setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Rúbrica de IA</h3>
        <span style={{ fontSize: "0.85rem", fontWeight: "800", color: isRubricValid ? "#10b981" : "#ef4444", backgroundColor: isRubricValid ? "#dcfce7" : "#fee2e2", padding: "4px 10px", borderRadius: "8px" }}>
          {totalRubricWeight}%
        </span>
      </div>

      <ActivityChatAssistant
        onSendMessage={handleChatRubricTurn}
        isGenerating={isGenerating}
        rubricSourceFile={rubricSourceFile}
        setRubricSourceFile={setRubricSourceFile}
        seeded={hasDuplicateSeed}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        {rubrics.map((r) => {
          const isExpanded = expandedIds.has(r.id);
          return (
            <div key={r.id} style={{ padding: "20px", backgroundColor: "#f8fafc", borderRadius: "16px", border: "1px solid #e2e8f0", position: "relative" }}>
              <div style={{ display: "flex", gap: "12px", marginBottom: "12px", alignItems: "center" }}>
                <input type="text" placeholder="Nombre del criterio" value={r.name} onChange={e => handleUpdateRubric(r.id, "name", e.target.value)} style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: "700", outline: "none", color: "#1B396A" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#cbd5e1"} />
                <input type="number" placeholder="%" value={r.weight} onChange={e => handleUpdateRubric(r.id, "weight", e.target.value)} style={{ width: "80px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: "800", textAlign: "center", outline: "none", color: "#1B396A" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#cbd5e1"} />
                <button
                  type="button"
                  onClick={() => toggleExpanded(r.id)}
                  title={isExpanded ? "Contraer criterio" : "Expandir para editar con más espacio"}
                  style={{ flexShrink: 0, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px" }}
                >
                  {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
              <textarea
                placeholder="Descripción de evaluación para la IA..."
                value={r.description}
                onChange={e => handleUpdateRubric(r.id, "description", e.target.value)}
                rows={isExpanded ? 6 : 2}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", outline: "none", resize: isExpanded ? "vertical" : "none", color: "#334155" }}
                onFocus={(e) => e.target.style.borderColor = "#1B396A"}
                onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
              />

              {rubrics.length > 1 && (
                <button type="button" onClick={() => handleRemoveRubricRow(r.id)} style={{ position: "absolute", top: "-10px", right: "-10px", backgroundColor: "#ef4444", color: "white", border: "none", width: "24px", height: "24px", borderRadius: "50%", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <ExpandingButton type="button" icon={Plus} label="Añadir Criterio" onClick={handleAddRubricRow} variant="default" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
        <ExpandingButton
          type="submit"
          icon={Save}
          label="Guardar"
          onClick={handleSave}
          variant="primary"
          loading={isSaving}
          loadingLabel="Guardando..."
          size={44} radius={12} gap={10} padding="0 20px" fontWeight={700} durationMs={300} shadow="hover"
        />
      </div>
    </div>
  );
}
