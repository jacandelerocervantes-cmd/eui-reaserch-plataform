"use client";

import { ShieldAlert, X } from "lucide-react";

export type FlaggedPair = {
  label_a?: string;
  label_b?: string;
  submission_id_a: string;
  submission_id_b: string;
  similarity_percent: number;
};

export type PlagiarismResult = {
  flagged: FlaggedPair[];
  compared: number;
  pdfSkipped: number;
};

export default function PlagiarismBanner({ plagiarismResult, setPlagiarismResult }: { plagiarismResult: PlagiarismResult; setPlagiarismResult: (v: PlagiarismResult | null) => void; }) {
  return (
    <div style={{ backgroundColor: plagiarismResult.flagged?.length > 0 ? "#fef2f2" : "#f0fdf4", border: `1px solid ${plagiarismResult.flagged?.length > 0 ? "#fecaca" : "#bbf7d0"}`, borderRadius: "20px", padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "900", color: plagiarismResult.flagged?.length > 0 ? "#991b1b" : "#166534" }}>
          <ShieldAlert size={20} />
          {plagiarismResult.flagged?.length > 0 ? `${plagiarismResult.flagged.length} par(es) con similitud sospechosa` : "Sin similitud sospechosa en la muestra revisada"}
        </div>
        <button onClick={() => setPlagiarismResult(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={18} /></button>
      </div>
      <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "8px 0 0" }}>
        Muestreo, no revisión exhaustiva: {plagiarismResult.compared} entrega(s) comparada(s){plagiarismResult.pdfSkipped > 0 ? `, ${plagiarismResult.pdfSkipped} archivo(s) PDF omitido(s) por límite de cuota` : ""}.
      </p>
      {plagiarismResult.flagged?.map((f, i) => (
        <div key={i} style={{ marginTop: "10px", padding: "10px 14px", backgroundColor: "white", borderRadius: "12px", fontSize: "0.85rem", color: "#1B396A", fontWeight: "700", display: "flex", justifyContent: "space-between" }}>
          <span>{f.label_a ?? f.submission_id_a.slice(0, 8)} ↔ {f.label_b ?? f.submission_id_b.slice(0, 8)}</span>
          <span style={{ color: "#ef4444" }}>{f.similarity_percent}% similar</span>
        </div>
      ))}
    </div>
  );
}
