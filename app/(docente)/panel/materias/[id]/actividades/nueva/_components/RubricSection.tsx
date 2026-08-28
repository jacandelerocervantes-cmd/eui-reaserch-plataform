"use client";

import { Save, X, Wand2, Plus, Loader2, Paperclip } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

export default function RubricSection({
  rubrics, totalRubricWeight, isRubricValid, handleUpdateRubric, handleRemoveRubricRow, handleAddRubricRow,
  isGenerating, handleGenerateAI, formData, rubricSourceFile, setRubricSourceFile,
  isSaving, handleSave,
}: {
  rubrics: { id: number; name: string; description: string; weight: number }[];
  totalRubricWeight: number;
  isRubricValid: boolean;
  handleUpdateRubric: (id: number, field: string, value: string | number) => void;
  handleRemoveRubricRow: (id: number) => void;
  handleAddRubricRow: () => void;
  isGenerating: boolean;
  handleGenerateAI: () => void;
  formData: { title: string; soft_deadline: string };
  rubricSourceFile: File | null;
  setRubricSourceFile: (f: File | null) => void;
  isSaving: boolean;
  handleSave: (e: React.FormEvent) => void;
}) {
  return (
    <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Rúbrica de IA</h3>
        <span style={{ fontSize: "0.85rem", fontWeight: "800", color: isRubricValid ? "#10b981" : "#ef4444", backgroundColor: isRubricValid ? "#dcfce7" : "#fee2e2", padding: "4px 10px", borderRadius: "8px" }}>
          {totalRubricWeight}%
        </span>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center" }}>
        <ExpandingButton
          type="button"
          icon={isGenerating ? Loader2 : Wand2}
          label={isGenerating ? "Certeza AIA pensando..." : "Autogenerar con IA"}
          onClick={handleGenerateAI}
          variant="magic"
          disabled={isGenerating}
          size={42} radius={10} gap={10} padding="0 16px" fontWeight={600} fontSize="0.9rem" durationMs={300} shadow="hover"
        />

        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.docx"
          onChange={(e) => setRubricSourceFile(e.target.files?.[0] ?? null)}
          style={{ display: "none" }}
          id="rubric-source-file"
        />
        <label
          htmlFor="rubric-source-file"
          title="Adjuntar actividad existente (con puntajes, etc.) para que la IA la lea y la use de contexto"
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "0 14px", height: "44px",
            borderRadius: "12px", border: `1px dashed ${rubricSourceFile ? "#8b5cf6" : "#cbd5e1"}`,
            backgroundColor: rubricSourceFile ? "#f5f3ff" : "white", color: rubricSourceFile ? "#6b21a8" : "#94a3b8",
            cursor: "pointer", fontSize: "0.85rem", fontWeight: "700", whiteSpace: "nowrap",
          }}
        >
          <Paperclip size={16} />
          {rubricSourceFile ? rubricSourceFile.name.slice(0, 24) : "Adjuntar actividad existente"}
        </label>
        {rubricSourceFile && (
          <button type="button" onClick={() => setRubricSourceFile(null)} title="Quitar archivo" style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
            <X size={16} />
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        {rubrics.map((r) => (
          <div key={r.id} style={{ padding: "20px", backgroundColor: "#f8fafc", borderRadius: "16px", border: "1px solid #e2e8f0", position: "relative" }}>
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
              <input type="text" placeholder="Nombre del criterio" value={r.name} onChange={e => handleUpdateRubric(r.id, "name", e.target.value)} style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: "700", outline: "none", color: "#1B396A" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#cbd5e1"} />
              <input type="number" placeholder="%" value={r.weight} onChange={e => handleUpdateRubric(r.id, "weight", e.target.value)} style={{ width: "80px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: "800", textAlign: "center", outline: "none", color: "#1B396A" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#cbd5e1"} />
            </div>
            <textarea placeholder="Descripción de evaluación para la IA..." value={r.description} onChange={e => handleUpdateRubric(r.id, "description", e.target.value)} rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", outline: "none", resize: "none", color: "#334155" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#cbd5e1"} />

            {rubrics.length > 1 && (
              <button type="button" onClick={() => handleRemoveRubricRow(r.id)} style={{ position: "absolute", top: "-10px", right: "-10px", backgroundColor: "#ef4444", color: "white", border: "none", width: "24px", height: "24px", borderRadius: "50%", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <ExpandingButton type="button" icon={Plus} label="Añadir Criterio" onClick={handleAddRubricRow} variant="default" size={42} radius={10} gap={10} padding="0 16px" fontWeight={600} fontSize="0.9rem" durationMs={300} />
        <ExpandingButton
          type="submit"
          icon={isSaving ? Loader2 : Save}
          label={isSaving ? "Creando Entorno..." : "Crear Actividad"}
          onClick={handleSave}
          variant="primary"
          disabled={isSaving}
          size={42} radius={10} gap={10} padding="0 16px" fontWeight={600} fontSize="0.9rem" durationMs={300} shadow="hover"
        />
      </div>
    </div>
  );
}
