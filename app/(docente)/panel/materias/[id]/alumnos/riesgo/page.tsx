"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, RotateCcw, Users, ShieldAlert } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { type StudentRiskRow } from "./_services/fetchRiesgo";
import { useRiesgoAcademico } from "./_hooks/useRiesgoAcademico";

const SIGNAL_LABELS: Record<string, string> = {
  asistencia_suavizada: "Asistencia",
  puntualidad_suavizada: "Puntualidad",
  promedio_actividades_suavizado: "Prom. Actividades",
  promedio_examenes_suavizado: "Prom. Exámenes",
  esfuerzo_suavizado: "Esfuerzo",
};

function StudentRow({ row }: { row: StudentRiskRow }) {
  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
      <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1B396A" }}>{row.nombre}</td>
      {(["asistencia_suavizada", "puntualidad_suavizada", "promedio_actividades_suavizado", "promedio_examenes_suavizado", "esfuerzo_suavizado"] as const).map((key) => (
        <td key={key} style={{ padding: "10px 14px", color: "#64748b", fontWeight: 600, fontSize: "0.85rem" }}>
          {row[key] === null ? "—" : row[key]!.toFixed(2)}
        </td>
      ))}
    </tr>
  );
}

function ClusterCard({ label, rows }: { label: string; rows: StudentRiskRow[] }) {
  const isOk = label === "Sin riesgo aparente";
  return (
    <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "20px", marginBottom: "24px", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", backgroundColor: isOk ? "#f0fdf4" : "#fef2f2", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "10px" }}>
        {isOk ? <Users size={18} color="#16a34a" /> : <ShieldAlert size={18} color="#dc2626" />}
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: isOk ? "#16a34a" : "#991b1b" }}>
          {label} <span style={{ fontWeight: 600, color: "#94a3b8" }}>({rows.length} alumno{rows.length !== 1 ? "s" : ""})</span>
        </h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc" }}>
              <th style={{ padding: "8px 14px", textAlign: "left", fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Alumno</th>
              {Object.values(SIGNAL_LABELS).map((label) => (
                <th key={label} style={{ padding: "8px 14px", textAlign: "left", fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => <StudentRow key={row.student_id} row={row} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiesgoContent({ courseId, reloadKey, onReload }: { courseId: string; reloadKey: number; onReload: () => void }) {
  const r = useRiesgoAcademico(courseId, reloadKey);

  if (r.loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Loader2 className="animate-spin" size={48} color="#1B396A" />
    </div>
  );

  if (!r.ok) return (
    <div style={{ padding: "40px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px", color: "#ef4444" }}>
      <p style={{ fontWeight: 700 }}>{r.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onReload} variant="secondary" size={40} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  if (r.totalAlumnos === 0) return (
    <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
      <Users size={40} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
      <p style={{ fontWeight: 600 }}>Aún no hay alumnos inscritos en esta materia.</p>
    </div>
  );

  return (
    <div style={{ padding: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 900, color: "#1B396A" }}>Riesgo Académico por Perfil</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontWeight: 500, fontSize: "0.85rem" }}>
            Agrupados en {r.kUsado} perfil{r.kUsado !== 1 ? "es" : ""} según asistencia, puntualidad, calificaciones y esfuerzo (K-Means sobre tendencias suavizadas).
          </p>
        </div>
        <ExpandingButton icon={RotateCcw} label="Recalcular" onClick={onReload} variant="secondary" size={40} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
      </div>

      {r.clusterGroups.map((group) => (
        <ClusterCard key={group.cluster} label={group.label} rows={group.rows} />
      ))}

      {r.excluidos.length > 0 && (
        <div style={{ backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "16px", padding: "16px 20px", marginTop: "8px" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#64748b", fontSize: "0.85rem" }}>
            {r.excluidos.length} alumno{r.excluidos.length !== 1 ? "s" : ""} sin suficiente historial para agrupar todavía (necesitan más observaciones en alguna señal):
          </p>
          <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: "0.8rem" }}>
            {r.excluidos.map((e) => e.nombre).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}

export default function RiesgoAcademico() {
  const { id: courseId } = useParams<{ id: string }>();
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <RiesgoContent courseId={courseId} reloadKey={reloadKey} onReload={() => setReloadKey((k) => k + 1)} />
  );
}
