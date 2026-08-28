"use client";

import { Sparkles, Paperclip, FileText, X } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

export default function AIPromptBar({
  search, setSearch, extractFile, setExtractFile,
  handleExtractFromFile, handleGenerateAI, isGenerating, isExtracting,
}: {
  search: string;
  setSearch: (v: string) => void;
  extractFile: File | null;
  setExtractFile: (f: File | null) => void;
  handleExtractFromFile: () => void;
  handleGenerateAI: () => void;
  isGenerating: boolean;
  isExtracting: boolean;
}) {
  return (
    <div style={{ backgroundColor: "white", padding: "16px 20px", borderRadius: "18px", border: "1px solid #e2e8f0", marginBottom: "30px", boxShadow: "0 4px 10px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <Sparkles color="#2563eb" size={20} style={{ marginTop: "9px", flexShrink: 0 }} />
        <textarea
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; }}
          placeholder="Gemini: 'Genera 5 preguntas sobre redes' o 'Cambia la pregunta 2'..."
          rows={1}
          style={{ flex: 1, border: "none", outline: "none", fontWeight: "600", fontSize: "1rem", color: "#1B396A", resize: "none", fontFamily: "inherit", padding: "8px 0", minHeight: "24px", maxHeight: "240px", overflowY: "auto" }}
        />
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.docx"
          onChange={(e) => setExtractFile(e.target.files?.[0] ?? null)}
          style={{ display: "none" }}
          id="extract-file-input"
        />
        <label htmlFor="extract-file-input" title="Adjuntar examen existente (PDF/Excel/Word) — la IA lo lee directo" style={{ flexShrink: 0, cursor: "pointer", color: extractFile ? "#8b5cf6" : "#94a3b8", marginTop: "8px", display: "flex" }}>
          <Paperclip size={20} />
        </label>
        <ExpandingButton
          icon={Sparkles}
          label={extractFile ? "Extraer Reactivos" : "Generar"}
          variant="ai"
          onClick={extractFile ? handleExtractFromFile : handleGenerateAI}
          loading={isGenerating || isExtracting}
          disabled={!extractFile && !search.trim()}
          size={44} smallSize={36} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} iconSize={20}
        />
      </div>
      {extractFile && (
        <div style={{ marginTop: "10px", marginLeft: "32px", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "#7c3aed", fontWeight: "700" }}>
          <FileText size={14} /> {extractFile.name}
          <button onClick={() => setExtractFile(null)} title="Quitar archivo" style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", display: "flex" }}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
