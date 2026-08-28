"use client";

import { Plus, Calculator } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { EditQuestion } from "./questionMapping";

// Barra fija con el total de puntos acumulado — antes duplicada en
// nuevo/page.tsx y configuracion/page.tsx.
export const ScoreBar = ({ total, questions, setQuestions, onAddManual }: {
  total: number; questions: EditQuestion[]; setQuestions: (qs: EditQuestion[]) => void; onAddManual: () => void;
}) => (
  <div style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: total === 100 ? "#f0fdf4" : "#fff1f2", padding: "15px 25px", borderRadius: "15px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", marginBottom: "30px", alignItems: "center", transition: "0.4s" }}>
    <div>
      <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b" }}>VALOR TOTAL ACUMULADO:</span>
      <h2 style={{ margin: 0, color: total === 100 ? "#16a34a" : "#dc2626", fontWeight: "900" }}>{total} / 100 pts</h2>
    </div>
    <div style={{ display: "flex", gap: "10px" }}>
      <ExpandingButton icon={Plus} label="Agregar Manual" variant="secondary" small smallSize={36} onClick={onAddManual} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} />
      <ExpandingButton
        icon={Calculator} label="Equilibrar Puntos" variant="secondary" small smallSize={36}
        onClick={() => setQuestions(questions.map((q) => ({ ...q, points: (100 / questions.length).toFixed(1) })))}
        disabled={questions.length === 0}
        radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300}
      />
    </div>
  </div>
);
