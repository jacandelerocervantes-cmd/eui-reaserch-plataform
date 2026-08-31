"use client";

import { use, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Calendar, Loader2, BookOpen, Lock, CheckCircle2, Clock, ArrowRight, ExternalLink, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

const STATUS_LABEL: Record<string, string> = { published: "Disponible", closed: "Cerrado", scheduled: "Programado", draft: "Borrador" };
const STATUS_COLOR: Record<string, { text: string; bg: string }> = {
  published: { text: "#2563eb", bg: "#eff6ff" },
  closed:    { text: "#64748b", bg: "#f1f5f9" },
  scheduled: { text: "#d97706", bg: "#fef3c7" },
  draft:     { text: "#64748b", bg: "#f1f5f9" },
};

export type UnitOption = { id: string; unit_number: number; title: string };
export type EvalResponse = { exam_id: string; status: string; final_score: number | null; score_ia: number | null };
export type ExamWithResponse = {
  id: string; title: string; description: string | null; status: string; unit_id: string; start_at: string | null;
  duration_minutes: number | null; questions_count: number | null;
  deployment_method: string | null; google_form_url: string | null; response: EvalResponse | null;
};

export type FetchResult =
  | { kind: "ok"; units: UnitOption[]; exams: ExamWithResponse[] }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

async function fetchEvaluaciones(
  courseId: string,
  router: ReturnType<typeof useRouter>,
  _reloadKey: number
): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/alumno/login'); return { kind: "redirect" }; }

    const { data: studentRec } = await supabase
      .from('students')
      .select('id')
      .ilike('correo', user.email ?? '')
      .eq('course_id', courseId)
      .maybeSingle();

    if (!studentRec) { router.push('/alumno'); return { kind: "redirect" }; }

    const { data: unitsData } = await supabase
      .from('course_units')
      .select('id, unit_number, title')
      .eq('course_id', courseId)
      .order('unit_number', { ascending: true });

    const unitsList: UnitOption[] = unitsData ?? [];
    const unitIds = unitsList.map((u) => u.id);

    type ExamRow = {
      id: string; title: string; description: string | null; status: string; unit_id: string;
      start_at: string | null; duration_minutes: number | null; questions_count: number | null;
      deployment_method: string | null; google_form_url: string | null;
    };

    let examData: ExamRow[] = [];
    if (unitIds.length > 0) {
      const { data } = await supabase
        .from('exams')
        .select('id, title, description, status, unit_id, start_at, duration_minutes, questions_count, deployment_method, google_form_url')
        .in('unit_id', unitIds)
        .order('created_at', { ascending: false });
      examData = (data ?? []) as ExamRow[];
    }

    const { data: evalData } = await supabase
      .from('evaluation_responses')
      .select('exam_id, status, final_score, score_ia')
      .eq('student_id', studentRec.id);

    const evalMap = new Map(((evalData ?? []) as EvalResponse[]).map((e) => [e.exam_id, e]));

    const exams: ExamWithResponse[] = examData
      .filter(e => e.status === 'published' || e.status === 'closed' || evalMap.has(e.id))
      .map((e) => ({ ...e, response: evalMap.get(e.id) ?? null }));

    return { kind: "ok", units: unitsList, exams };
  } catch (err) {
    console.error('Error cargando evaluaciones:', err);
    return { kind: "error", message: 'No se pudieron cargar las evaluaciones de esta materia.' };
  }
}

// --- TARJETA DE EXAMEN PARA EL ALUMNO ---
const ExamCard = ({ exam, courseId }: { exam: ExamWithResponse; courseId: string }) => {
  const router = useRouter();
  const statusColor = STATUS_COLOR[exam.status] ?? STATUS_COLOR.closed;
  const isCompleted = exam.response?.status === 'completed';
  const isAIDraft = exam.response?.status === 'ai_draft';
  const isSubmitted = exam.response?.status === 'submitted' || exam.response?.status === 'ai_queued';
  const score = exam.response?.final_score ?? exam.response?.score_ia ?? null;
  const isForms = exam.deployment_method === 'google_forms';
  const canTake = exam.status === 'published' && !exam.response;

  return (
    <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
          {isCompleted ? (
            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#16a34a", backgroundColor: "#f0fdf4", padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase" }}>Calificado</span>
          ) : isAIDraft ? (
            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#7c3aed", backgroundColor: "#f5f3ff", padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase" }}>Revisión IA</span>
          ) : isSubmitted ? (
            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#2563eb", backgroundColor: "#eff6ff", padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase" }}>Entregado</span>
          ) : (
            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: statusColor.text, backgroundColor: statusColor.bg, padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
              {STATUS_LABEL[exam.status] ?? exam.status}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>
            <Calendar size={12} /> {exam.start_at ? new Date(exam.start_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin fecha'}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
          <div>
            <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.15rem", fontWeight: "800", lineHeight: "1.3" }}>{exam.title}</h3>
            {exam.description && (
              <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "6px 0 0 0", lineHeight: 1.4 }}>
                {exam.description}
              </p>
            )}
          </div>
          {(isCompleted || isAIDraft) && score !== null && (
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: score >= 70 ? "#16a34a" : "#dc2626", flexShrink: 0 }}>
              {score.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px 20px", backgroundColor: "#fafafa" }}>
        {canTake && isForms ? (
          <a href={exam.google_form_url ?? '#'} target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", backgroundColor: "#1B396A", color: "white", padding: "12px", borderRadius: "12px", fontWeight: "700", fontSize: "0.9rem", textDecoration: "none" }}>
            <ExternalLink size={16} /> Abrir en Google Forms
          </a>
        ) : canTake ? (
          <button onClick={() => router.push(`/alumno/materia/${courseId}/presentar/${exam.id}`)} style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", backgroundColor: "#1B396A", color: "white", padding: "12px", borderRadius: "12px", fontWeight: "700", fontSize: "0.9rem", border: "none", cursor: "pointer" }}>
            <ArrowRight size={16} /> Iniciar Examen
          </button>
        ) : isSubmitted ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#2563eb", fontWeight: "700", fontSize: "0.9rem" }}><Clock size={18} /> En espera de calificación</div>
        ) : isCompleted || isAIDraft ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#16a34a", fontWeight: "700", fontSize: "0.9rem" }}><CheckCircle2 size={18} /> Examen completado</div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontWeight: "700", fontSize: "0.9rem" }}><Lock size={18} /> Examen cerrado</div>
        )}
      </div>
    </div>
  );
};

function EvaluacionesContent({ resource, courseId, onRetry }: { resource: Promise<FetchResult>; courseId: string; onRetry: () => void }) {
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const result = use(resource);

  if (result.kind === "redirect") return (
    <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={40} color="#1B396A" />
    </div>
  );

  if (result.kind === "error") return (
    <div style={{ height: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
      <p style={{ color: "#ef4444", fontWeight: "700" }}>{result.message}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { units, exams } = result;
  const activeUnitId = selectedUnitId || (units.length > 0 ? units[0].id : '');
  const selectedUnit = units.find(u => u.id === activeUnitId);
  const unitExams = activeUnitId ? exams.filter(e => e.unit_id === activeUnitId) : exams;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "28px" }}>
      <div>
        <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "900", margin: 0, letterSpacing: "-0.02em" }}>
          Evaluaciones
        </h1>
        <p style={{ color: "#64748b", fontSize: "1rem", fontWeight: "600", marginTop: "4px", margin: 0 }}>
          Exámenes y cuestionarios de la materia
        </p>
      </div>

      {/* Selector de Unidades Interactivo */}
      {units.length > 0 && (
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#475569" }}>Unidad:</span>
          {units.map(u => {
            const isSelected = u.id === activeUnitId;
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUnitId(u.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  border: isSelected ? "2px solid #1B396A" : "1px solid #cbd5e1",
                  backgroundColor: isSelected ? "#1B396A" : "white",
                  color: isSelected ? "white" : "#475569",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                U{u.unit_number}: {u.title}
              </button>
            );
          })}
        </div>
      )}

      {units.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "white", borderRadius: "20px", border: "2px dashed #e2e8f0" }}>
          <BookOpen size={40} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ color: "#1B396A", margin: 0 }}>No hay unidades de aprendizaje</h3>
          <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "4px 0 0 0" }}>El docente aún no ha creado unidades en esta materia.</p>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
            <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>U{selectedUnit?.unit_number}</span>
            <h2 style={{ fontSize: "1.3rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{selectedUnit?.title}</h2>
          </div>

          {unitExams.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
              {unitExams.map((e) => <ExamCard key={e.id} exam={e} courseId={courseId} />)}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px", backgroundColor: "white", borderRadius: "16px", border: "1px dashed #cbd5e1" }}>
              <p style={{ color: "#94a3b8", fontSize: "0.9rem", fontStyle: "italic", margin: 0 }}>No hay evaluaciones programadas para esta unidad.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EvaluacionesAlumno() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchEvaluaciones(courseId, router, reloadKey), [courseId, router, reloadKey]);

  return (
    <Suspense fallback={
      <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
      </div>
    }>
      <EvaluacionesContent resource={resource} courseId={courseId} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}

