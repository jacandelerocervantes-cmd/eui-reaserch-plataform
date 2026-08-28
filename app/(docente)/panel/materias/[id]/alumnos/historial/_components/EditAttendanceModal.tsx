"use client";

import { useState } from "react";
import { Check, X, AlertTriangle, Trash2, Paperclip, Loader2, AlertCircle } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { validateFileContent } from "@/lib/fileValidation";
import type { CourseUnit, SelectedRecord } from "./types";

export default function EditAttendanceModal({
  selectedRecord, setSelectedRecord, selectedUnitData, setShowEditModal,
  fileToUpload, setFileToUpload, handleDeleteRecord, handleUpdate, isUpdating,
}: {
  selectedRecord: SelectedRecord;
  setSelectedRecord: (r: SelectedRecord) => void;
  selectedUnitData: CourseUnit | null;
  setShowEditModal: (v: boolean) => void;
  fileToUpload: File | null;
  setFileToUpload: (f: File | null) => void;
  handleDeleteRecord: () => void;
  handleUpdate: () => void;
  isUpdating: boolean;
}) {
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileChange = async (f: File | null) => {
    setFileError(null);
    if (!f) { setFileToUpload(null); return; }
    const check = await validateFileContent(f);
    if (!check.ok) { setFileError(check.reason); setFileToUpload(null); return; }
    setFileToUpload(f);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100, backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) { setShowEditModal(false); setFileToUpload(null); } }}
    >
      <div style={{ backgroundColor: "white", padding: "28px 30px 30px", borderRadius: "20px", width: "420px", boxShadow: "0 25px 50px rgba(0,0,0,0.2)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <p style={{ margin: "0 0 2px", fontWeight: "700", fontSize: "0.95rem" }}>{selectedRecord.student_name}</p>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", fontWeight: "600" }}>
              {selectedRecord.session_date?.split('-').reverse().join('/')} · Sesión {selectedRecord.session_number}
              {selectedUnitData && <span style={{ marginLeft: "6px", color: "#1d4ed8" }}>· U{selectedUnitData.unit_number}</span>}
            </p>
          </div>
          <button
            onClick={() => { setShowEditModal(false); setFileToUpload(null); }}
            style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px", cursor: "pointer", color: "#94a3b8", lineHeight: 0, flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", justifyContent: "center" }}>
          <ExpandingButton icon={Check} label="Asistió" expanded={selectedRecord.new_status === 1} onClick={() => setSelectedRecord({...selectedRecord, new_status: 1})} variant="success" size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300} colors={{ bg: "white", hoverBg: "#10b981", text: "#10b981", hoverText: "white", border: selectedRecord.new_status === 1 ? "#10b981" : "#cbd5e1" }} />
          <ExpandingButton icon={AlertTriangle} label="Retardo" expanded={selectedRecord.new_status === 0.5} onClick={() => setSelectedRecord({...selectedRecord, new_status: 0.5})} variant="warning" size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300} colors={{ bg: "white", hoverBg: "#f59e0b", text: "#f59e0b", hoverText: "white", border: selectedRecord.new_status === 0.5 ? "#f59e0b" : "#cbd5e1" }} />
          <ExpandingButton icon={X} label="Falta" expanded={selectedRecord.new_status === 0} onClick={() => setSelectedRecord({...selectedRecord, new_status: 0})} variant="danger" size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300} colors={{ bg: "white", hoverBg: "#ef4444", text: "#ef4444", hoverText: "white", border: selectedRecord.new_status === 0 ? "#ef4444" : "#cbd5e1" }} />
        </div>

        <textarea
          placeholder="Motivo / Justificación (opcional)..."
          value={selectedRecord.justification}
          onChange={(e) => setSelectedRecord({...selectedRecord, justification: e.target.value})}
          style={{ width: "100%", height: "80px", padding: "10px", borderRadius: "10px", border: "1px solid #cbd5e1", resize: "vertical", fontFamily: "inherit", fontSize: "0.9rem", boxSizing: "border-box" }}
        />

        <div style={{ marginTop: "14px" }}>
          <label style={{ fontSize: "0.78rem", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "6px" }}>
            <Paperclip size={12} style={{ display: "inline", marginRight: "4px" }} />
            Justificante (PDF/imagen)
          </label>
          {selectedRecord.file_url && !fileToUpload && (
            <a href={selectedRecord.file_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", color: "#1d4ed8", display: "block", marginBottom: "6px" }}>
              Ver justificante actual
            </a>
          )}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            style={{ fontSize: "0.8rem", width: "100%" }}
          />
          {fileError && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#dc2626", fontSize: "0.78rem", fontWeight: 600, marginTop: "6px" }}>
              <AlertCircle size={13} /> {fileError}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: selectedRecord.exists ? "space-between" : "flex-end", marginTop: "22px" }}>
          {selectedRecord.exists && (
            <ExpandingButton
              icon={Trash2}
              label="Eliminar"
              onClick={handleDeleteRecord}
              variant="danger"
              disabled={isUpdating}
              size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300}
              colors={{ bg: "white", hoverBg: "#ef4444", text: "#ef4444", hoverText: "white", border: "#cbd5e1" }}
            />
          )}
          <ExpandingButton
            icon={isUpdating ? Loader2 : Check}
            label={isUpdating ? "Guardando..." : "Guardar"}
            onClick={handleUpdate}
            variant="primary"
            disabled={isUpdating}
            size={40} radius={10} gap={10} padding="0 12px" fontWeight={600} durationMs={300}
          />
        </div>
      </div>
    </div>
  );
}
