"use client";

import { useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Plus, Calendar, FileText,
  Settings, Play, Loader2, AlertCircle, BookOpen, Rocket, Lock, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useEvaluaciones, useEvaluacionesContent, useExamCard, type ExamListItem } from "./_hooks/useEvaluaciones";

const STATUS_LABEL: Record<string, string> = { draft: "Borrador", published: "Publicado", closed: "Cerrado" };
const STATUS_COLOR: Record<string, { text: string; bg: string }> = {
  draft:     { text: "#64748b", bg: "#f1f5f9" },
  published: { text: "#2563eb", bg: "#eff6ff" },
  closed:    { text: "#16a34a", bg: "#f0fdf4" },
};

// --- TARJETA DE EXAMEN — botones SIEMPRE visibles (antes se revelaban solo
// con hover, lo que producía un parpadeo que a veces bloqueaba el clic). ---
const ExamHoverCard = ({ exam, courseId, onStatusChange }: { exam: ExamListItem, courseId: string, onStatusChange: (examId: string, status: string) => void }) => {
  const router = useRouter();
  const { changingStatus, handleStatusChange } = useExamCard(exam, onStatusChange);
  const statusColor = STATUS_COLOR[exam.status] ?? STATUS_COLOR.draft;

  return (
    <div
      style={{
        backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
          <span style={{
            fontSize: "0.7rem", fontWeight: "800",
            color: statusColor.text, backgroundColor: statusColor.bg,
            padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase"
          }}>
            {STATUS_LABEL[exam.status] ?? exam.status}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>
            <Calendar size={12} /> {exam.start_at ? new Date(exam.start_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin fecha'}
          </div>
        </div>
        <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.15rem", fontWeight: "800", lineHeight: "1.3" }}>{exam.title}</h3>
        <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: "1.5", margin: "10px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {exam.description || "Sin descripción disponible."}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1B396A", fontWeight: "800", fontSize: "0.85rem", margin: "12px 0 0" }}>
          <FileText size={16} color="#94a3b8" /> {exam.questions_count ?? '—'} Preguntas • {exam.duration_minutes ?? 60} min
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px 20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {exam.status === 'draft' && (
          <ExpandingButton icon={Rocket} label="Publicar ahora" onClick={() => handleStatusChange('published')} variant="primary" disabled={changingStatus} size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
        )}
        {exam.status === 'published' && (
          <ExpandingButton icon={Lock} label="Cerrar ahora" onClick={() => handleStatusChange('closed')} variant="default" disabled={changingStatus} size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} colors={{ hoverText: "#64748b" }} />
        )}
        <ExpandingButton icon={FileText} label="Resultados" onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/${exam.id}/resultados`)} variant="default" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} colors={{ hoverText: "#64748b" }} />
        <ExpandingButton icon={Settings} label="Configuración" onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/${exam.id}/configuracion`)} variant="default" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} colors={{ hoverText: "#64748b" }} />
        <ExpandingButton icon={Play} label="Simular" onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/${exam.id}/simulacion`)} variant="default" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} colors={{ hoverText: "#64748b" }} />
      </div>
    </div>
  );
};

function EvaluacionesContent({ resource, courseId, onRetry }: { resource: ReturnType<typeof useEvaluaciones>["resource"]; courseId: string; onRetry: () => void }) {
  const router = useRouter();
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const { result, evaluaciones, onStatusChange } = useEvaluacionesContent(resource);

  if (!result.ok) return (
    <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444" }}>
      <p style={{ fontWeight: "700" }}>{result.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { units } = result;
  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const unitExams = selectedUnitId ? evaluaciones.filter(e => e.unit_id === selectedUnitId) : [];

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Evaluaciones</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Generación y control de exámenes por IA</p>
        </div>
        <ExpandingButton icon={Plus} label="Crear Examen" onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/nuevo`)} variant="primary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
      </div>

      {/* Selector de Unidad — no se muestra nada hasta elegir una */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px", backgroundColor: "#f0f7ff", borderRadius: "12px", border: "1px solid #bfdbfe", width: "fit-content" }}>
        <span style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.75rem", textTransform: "uppercase" }}>Unidad</span>
        <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #bfdbfe", outline: "none", fontSize: "0.85rem", fontWeight: "700", color: "#1B396A", backgroundColor: "white", cursor: "pointer" }}>
          <option value="">Selecciona una unidad...</option>
          {units.map(u => <option key={u.id} value={u.id}>U{u.unit_number}: {u.title}</option>)}
        </select>
      </div>

      {!selectedUnitId ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#f8fafc", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
          <BookOpen size={40} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ color: "#1B396A", margin: 0 }}>Selecciona una unidad arriba</h3>
          <p style={{ color: "#64748b" }}>Para ver sus evaluaciones.</p>
        </div>
      ) : units.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#f8fafc", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
          <AlertCircle size={40} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ color: "#1B396A", margin: 0 }}>No se encontraron unidades</h3>
          <p style={{ color: "#64748b" }}>Carga las unidades en la configuración de la materia para empezar.</p>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
            <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>U{selectedUnit?.unit_number}</span>
            <h2 style={{ fontSize: "1.4rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{selectedUnit?.title}</h2>
          </div>

          {unitExams.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
              {unitExams.map(exam => (
                <ExamHoverCard
                  key={exam.id}
                  exam={exam}
                  courseId={courseId}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          ) : (
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", fontStyle: "italic" }}>No hay evaluaciones programadas para esta unidad.</p>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

export default function ListaEvaluacionesPage() {
  const { id: courseId } = useParams() as { id: string };
  const { resource, reloadKey, onReload } = useEvaluaciones(courseId);

  return (
    <Suspense fallback={
      <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
      </div>
    }>
      <EvaluacionesContent key={reloadKey} resource={resource} courseId={courseId} onRetry={onReload} />
    </Suspense>
  );
}
