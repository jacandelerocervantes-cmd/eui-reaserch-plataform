"use client";

import { Layers, Play, Ban, Save, AlertCircle } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import DateTimeFieldMX from "@/components/ui/DateTimeFieldMX";
import { SecuritySettings } from "../../_components/SecuritySettings";
import { AudienceSelector } from "../../_components/AudienceSelector";
import type { EditQuestion } from "../../_components/questionMapping";

type ExamConfig = { title: string; startAt: string; endAt: string };
type StudentOption = { id: string; matricula: string; nombres: string; apellido_paterno: string };

export default function PropertiesPanel({
  examConfig, setExamConfig, deployment, setDeployment,
  randomizeQuestions, setRandomizeQuestions, randomizeOptions, setRandomizeOptions,
  showAllQuestions, setShowAllQuestions,
  students, restrictAudience, setRestrictAudience, selectedStudentIds, toggleStudentAudience,
  questions, setIsSimulating, router, handlePublish, isPublishing, unitId, total,
}: {
  examConfig: ExamConfig;
  setExamConfig: (v: ExamConfig) => void;
  deployment: string;
  setDeployment: (v: string) => void;
  randomizeQuestions: boolean;
  setRandomizeQuestions: (v: boolean) => void;
  randomizeOptions: boolean;
  setRandomizeOptions: (v: boolean) => void;
  showAllQuestions: boolean;
  setShowAllQuestions: (v: boolean) => void;
  students: StudentOption[];
  restrictAudience: boolean;
  setRestrictAudience: (v: boolean) => void;
  selectedStudentIds: string[];
  toggleStudentAudience: (id: string) => void;
  questions: EditQuestion[];
  setIsSimulating: (v: boolean) => void;
  router: ReturnType<typeof import("next/navigation").useRouter>;
  handlePublish: () => void;
  isPublishing: boolean;
  unitId: string;
  total: number;
}) {
  return (
    <div style={{ width: "clamp(300px, 26vw, 380px)", minWidth: "290px", backgroundColor: "white", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", height: "100%", flexShrink: 0 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "clamp(20px, 2vw, 32px) clamp(20px, 2vw, 32px) 0" }}>
        <h3 style={{ color: "#1B396A", marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px", fontWeight: "900", fontSize: "1.2rem" }}>
          <Layers size={20} /> Propiedades
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        <div>
          <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Título de la Evaluación</label>
          <input
            value={examConfig.title} onChange={(e) => setExamConfig({...examConfig, title: e.target.value})}
            placeholder="Ej: Examen Unidad 1: Redes..."
            style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #cbd5e1", outline: "none", fontSize: "1rem", color: "#1B396A", fontWeight: "600" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Inicio</label>
          <DateTimeFieldMX value={examConfig.startAt} onChange={(v) => setExamConfig({...examConfig, startAt: v})} />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", textTransform: "uppercase", margin: 0 }}>Fin</label>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              {[30, 50, 60, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    if (!examConfig.startAt) return;
                    const startDate = new Date(examConfig.startAt);
                    if (isNaN(startDate.getTime())) return;
                    const endDate = new Date(startDate.getTime() + mins * 60 * 1000);
                    const y = endDate.getFullYear();
                    const mo = String(endDate.getMonth() + 1).padStart(2, "0");
                    const d = String(endDate.getDate()).padStart(2, "0");
                    const h = String(endDate.getHours()).padStart(2, "0");
                    const m = String(endDate.getMinutes()).padStart(2, "0");
                    setExamConfig({ ...examConfig, endAt: `${y}-${mo}-${d}T${h}:${m}` });
                  }}
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: "700",
                    padding: "2px 6px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "white",
                    color: "#1B396A",
                    cursor: examConfig.startAt ? "pointer" : "not-allowed",
                    opacity: examConfig.startAt ? 1 : 0.5,
                  }}
                >
                  +{mins}m
                </button>
              ))}
            </div>
          </div>
          <DateTimeFieldMX value={examConfig.endAt} onChange={(v) => setExamConfig({...examConfig, endAt: v})} />
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Método de Aplicación</label>
          <div style={{ display: "flex", gap: "6px", backgroundColor: "#f1f5f9", padding: "5px", borderRadius: "14px" }}>
            <button
              onClick={() => setDeployment("interno")}
              style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", fontSize: "0.75rem", fontWeight: "900", cursor: "pointer", backgroundColor: deployment === "interno" ? "white" : "transparent", transition: "0.3s", boxShadow: deployment === "interno" ? "0 4px 6px rgba(0,0,0,0.05)" : "none", color: deployment === "interno" ? "#1B396A" : "#64748b" }}
            >INTERNO</button>
            <button
              onClick={() => setDeployment("google_forms")}
              style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", fontSize: "0.75rem", fontWeight: "900", cursor: "pointer", backgroundColor: deployment === "google_forms" ? "white" : "transparent", transition: "0.3s", boxShadow: deployment === "google_forms" ? "0 4px 6px rgba(0,0,0,0.05)" : "none", color: deployment === "google_forms" ? "#1B396A" : "#64748b" }}
            >GOOGLE FORMS</button>
          </div>
        </div>

        <SecuritySettings
          randomizeQuestions={randomizeQuestions} setRandomizeQuestions={setRandomizeQuestions}
          randomizeOptions={randomizeOptions} setRandomizeOptions={setRandomizeOptions}
          showAllQuestions={showAllQuestions} setShowAllQuestions={setShowAllQuestions}
        />

        <AudienceSelector
          students={students} restrictAudience={restrictAudience} setRestrictAudience={setRestrictAudience}
          selectedStudentIds={selectedStudentIds} toggleStudent={toggleStudentAudience}
        />
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: "20px 35px 35px 35px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "12px" }}>
        <ExpandingButton icon={Play} label="Simular Vista Alumno" onClick={() => setIsSimulating(true)} variant="secondary" disabled={questions.length === 0} size={44} smallSize={36} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} iconSize={20} />
        <div style={{ display: "flex", gap: "10px" }}>
          <ExpandingButton icon={Ban} label="Cancelar" onClick={() => router.back()} variant="cancel" size={44} smallSize={36} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} iconSize={20} />
          <ExpandingButton
            icon={Save}
            label="Guardar"
            loadingLabel="Guardando..."
            onClick={handlePublish}
            disabled={total !== 100 || !examConfig.title || !unitId || !examConfig.startAt || !examConfig.endAt || isPublishing}
            loading={isPublishing}
            size={44} smallSize={36} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} iconSize={20}
          />
        </div>
        {total !== 100 && questions.length > 0 && (
          <div style={{ color: "#dc2626", fontSize: "0.75rem", textAlign: "center", fontWeight: "900", marginTop: "8px", backgroundColor: "#fef2f2", padding: "10px", borderRadius: "10px", border: "1px solid #fee2e2" }}>
            <AlertCircle size={14} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
            Faltan {Math.abs(100 - total).toFixed(1)} pts para el total.
          </div>
        )}
      </div>
    </div>
  );
}
