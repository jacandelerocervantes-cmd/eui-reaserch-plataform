"use client";

import { X, Sparkles, FileText, Loader2 } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import styles from "../../alumnos.module.css";

export default function ImportIAModal({
  setShowImportModal, importError, selectedFile, setSelectedFile, setImportError,
  importStatus, handleGeminiImport,
}: {
  setShowImportModal: (v: boolean) => void;
  importError: string | null;
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  setImportError: (v: string | null) => void;
  importStatus: 'idle' | 'analyzing' | 'success';
  handleGeminiImport: () => void;
}) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ textAlign: "center", position: "relative" }}>
        <button onClick={() => setShowImportModal(false)} className={styles.closeButton} style={{ position: "absolute", top: "20px", right: "20px" }}><X size={24} /></button>

        <div style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "6px 14px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "800", marginBottom: "20px", fontSize: "0.8rem" }}>
          <Sparkles size={16} /> MOTOR GEMINI 2.5 FLASH
        </div>

        <h2 className={styles.modalTitle} style={{ marginBottom: "20px" }}>Importación Inteligente de Equipos</h2>

        {importError && (
          <div style={{ backgroundColor: "#fee2e2", color: "#b91c1c", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "0.9rem", textAlign: "left", display: "flex", alignItems: "flex-start", gap: "8px", border: "1px solid #f87171" }}>
            <X size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span>{importError}</span>
          </div>
        )}

        <div style={{ border: "2px dashed #cbd5e1", padding: "30px", borderRadius: "16px", cursor: "pointer", backgroundColor: selectedFile ? "#f0f7ff" : "transparent", transition: "all 0.2s" }}>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
            onChange={(e) => { setSelectedFile(e.target.files?.[0] || null); setImportError(null); }}
            style={{ display: "none" }}
            id="file-ia-equipos"
          />
          <label htmlFor="file-ia-equipos" style={{ cursor: "pointer", display: "block" }}>
            {importStatus === 'analyzing' ? (
              <Loader2 className="animate-spin" size={40} color="#2563eb" style={{ margin: "0 auto" }} />
            ) : (
              <FileText size={40} color="#94a3b8" style={{ margin: "0 auto" }} />
            )}
            <p style={{ marginTop: "12px", fontWeight: "600", color: "#475569" }}>
              {selectedFile ? selectedFile.name : "Seleccionar archivo PDF, Excel o Imagen"}
            </p>
          </label>
        </div>

        <div style={{ marginTop: "30px", display: "flex", justifyContent: "center" }}>
          <ExpandingButton
            icon={importStatus === 'analyzing' ? Loader2 : Sparkles}
            label={importStatus === 'analyzing' ? "Analizando con IA..." : (importStatus === 'success' ? "¡Equipos Importados!" : "Iniciar Análisis")}
            onClick={handleGeminiImport}
            variant="ai"
            disabled={!selectedFile || importStatus !== 'idle'}
            size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px"
          />
        </div>
      </div>
    </div>
  );
}
