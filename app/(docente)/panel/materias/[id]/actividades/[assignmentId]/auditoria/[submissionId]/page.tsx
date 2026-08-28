"use client";

import { use, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Wand2, CheckCircle2, MessageSquare, Save,
  ChevronLeft, ChevronRight, Loader2, ArrowLeft,
  ShieldAlert, Users, Search, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

type Submission = {
  id: string;
  ai_score: number | null;
  ai_integrity_flag: boolean;
  ai_integrity_notes: string | null;
  final_score: number | null;
  final_feedback: string | null;
  ai_feedback: string | null;
  metadata: Record<string, number> | null;
  status: string;
  content_url: string | null;
  file_path: string | null;
  students: { apellido_paterno: string; nombres: string } | null;
};

type IntegrityResult = {
  contributions?: { email: string; student_name: string; percent: number }[];
  suspiciousPastes?: unknown[];
};

type FetchResult =
  | { ok: true; submission: Submission | null; initialScores: Record<string, number>; initialFeedback: string; isPublished: boolean; pdfUrl: string | null; orderedSubs: { id: string; status: string }[] }
  | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchAuditoria(courseId: string, assignmentId: string, submissionId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: sub } = await supabase
      .from('submissions')
      .select(`*, students(*)`)
      .eq('id', submissionId)
      .single();

    if (!sub) {
      return { ok: true, submission: null, initialScores: {}, initialFeedback: "", isPublished: false, pdfUrl: null, orderedSubs: [] };
    }

    // URL firmada (5 min) para bucket privado archivos_docentes
    let pdfUrl: string | null = null;
    if (sub.file_path) {
      const { data: signed } = await supabase.storage.from('archivos_docentes').createSignedUrl(sub.file_path, 300);
      pdfUrl = signed?.signedUrl ?? null;
    }

    // Orden secuencial de la auditoría: mismo orden alfabético que la lista de
    // Control de Entregas. "Siguiente" solo se habilita si el actual ya está Publicado.
    const { data: studentsList } = await supabase
      .from('students')
      .select('id')
      .eq('course_id', courseId)
      .order('apellido_paterno', { ascending: true });

    const { data: subs } = await supabase
      .from('submissions')
      .select('id, student_id, status')
      .eq('assignment_id', assignmentId);

    const orderedSubs = (studentsList ?? [])
      .map((st: { id: string }) => subs?.find((s: { student_id: string }) => s.student_id === st.id))
      .filter(Boolean) as { id: string; status: string }[];

    return {
      ok: true,
      submission: sub as Submission,
      // Priorizamos la nota final si ya existe, si no, la de la IA
      initialScores: sub.metadata || {},
      initialFeedback: sub.final_feedback || sub.ai_feedback || "",
      isPublished: sub.status === 'completed',
      pdfUrl,
      orderedSubs,
    };
  } catch (error) {
    console.error("Error cargando auditoría:", error);
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo cargar la entrega del alumno." };
  }
}

function AuditoriaContent({
  resource, courseId, assignmentId, submissionId, onRetry,
}: { resource: Promise<FetchResult>; courseId: string; assignmentId: string; submissionId: string; onRetry: () => void }) {
  const result = use(resource);
  const router = useRouter();

  const [scores, setScores] = useState<Record<string, number>>(result.ok ? result.initialScores : {});
  const [feedback, setFeedback] = useState(result.ok ? result.initialFeedback : "");
  const [isSaving, setIsSaving] = useState(false);
  const [isPublished, setIsPublished] = useState(result.ok ? result.isPublished : false);
  const [toast, setToast] = useState<string | null>(null);
  const [orderedSubs, setOrderedSubs] = useState(result.ok ? result.orderedSubs : []);
  const [isAnalyzingIntegrity, setIsAnalyzingIntegrity] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);

  if (!result.ok) return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444" }}>
      <p style={{ fontWeight: "700" }}>{result.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { submission, pdfUrl } = result;

  const currentIndex = orderedSubs.findIndex(s => s.id === submissionId);
  const prevSub = currentIndex > 0 ? orderedSubs[currentIndex - 1] : null;
  const nextSub = currentIndex >= 0 && currentIndex < orderedSubs.length - 1 ? orderedSubs[currentIndex + 1] : null;
  const canGoNext = !!nextSub && isPublished;

  const goTo = (id: string) => router.push(`/panel/materias/${courseId}/actividades/${assignmentId}/auditoria/${id}`);

  // Nota Final Calculada Dinámicamente
  const total = (() => {
    const values = Object.values(scores) as number[];
    if (values.length === 0) return submission?.ai_score || 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  })();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          final_score: total,
          final_feedback: feedback,
          metadata: scores
        })
        .eq('id', submissionId);

      if (error) throw error;
      setToast("💾 Cambios guardados en DB.");
    } catch {
      setToast("❌ Error al guardar.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handlePublish = async () => {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ status: 'completed', graded_at: new Date().toISOString() })
        .eq('id', submissionId);

      if (error) throw error;
      setIsPublished(true);
      setOrderedSubs(prev => prev.map(s => s.id === submissionId ? { ...s, status: 'completed' } : s));
      setToast("🎓 Calificación publicada al alumno.");
    } catch {
      setToast("❌ Error al publicar.");
    } finally {
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleAnalyzeIntegrity = async () => {
    setIsAnalyzingIntegrity(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-submission-integrity', { body: { submission_id: submissionId } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "No se pudo analizar el historial.");
      setIntegrityResult(data);
    } catch (e) {
      setToast(`❌ ${e instanceof Error ? e.message : String(e)}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsAnalyzingIntegrity(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "white", position: "relative" }}>

      {toast && (
        <div style={{ position: "fixed", bottom: "110px", right: "40px", backgroundColor: "#152c54", color: "white", padding: "12px 24px", borderRadius: "12px", fontWeight: "800", boxShadow: "0 10px 20px rgba(0,0,0,0.2)", zIndex: 1000 }}>
          {toast}
        </div>
      )}

      {/* HEADER DE TRABAJO */}
      <div style={{ height: "80px", padding: "0 30px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ textAlign: "left", display: "flex", alignItems: "center", gap: "15px" }}>
          <button onClick={() => router.back()} style={{ border: "none", background: "none", cursor: "pointer", color: "#1B396A" }}><ArrowLeft /></button>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "950", color: "#1B396A", letterSpacing: "-0.02em" }}>{submission?.students?.apellido_paterno}, {submission?.students?.nombres}</h2>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>Auditoría en Tiempo Real</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "6px", marginRight: "10px" }}>
             <button
               onClick={() => prevSub && goTo(prevSub.id)}
               disabled={!prevSub}
               title="Alumno anterior"
               style={{ width: "48px", height: "48px", borderRadius: "14px", border: "1px solid #cbd5e1", background: "white", cursor: prevSub ? "pointer" : "not-allowed", color: prevSub ? "#64748b" : "#cbd5e1" }}
             ><ChevronLeft size={22}/></button>
             <button
               onClick={() => canGoNext && nextSub && goTo(nextSub.id)}
               disabled={!canGoNext}
               title={!nextSub ? "No hay más alumnos" : !isPublished ? "Publica esta calificación antes de continuar" : "Siguiente alumno"}
               style={{ width: "48px", height: "48px", borderRadius: "14px", border: "1px solid #cbd5e1", background: "white", cursor: canGoNext ? "pointer" : "not-allowed", color: canGoNext ? "#64748b" : "#cbd5e1" }}
             ><ChevronRight size={22}/></button>
          </div>

          <ExpandingButton
            icon={CheckCircle2}
            label={isPublished ? "Publicado" : "Publicar"}
            onClick={handlePublish}
            variant="success"
            disabled={isPublished}
            size={52} radius={14} gap={10} padding="0 20px" collapsePadding
            fontWeight={900} fontSize="1rem" bounce durationMs={400}
            shadow="always" dimOnDisable minWidth="52px" iconSize={22}
            colors={{ hoverBg: "#10b981" }}
          />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Lado Izquierdo: Visor de PDF Real */}
        <div style={{ flex: 1, backgroundColor: "#525659", display: "flex", justifyContent: "center", overflow: "hidden" }}>
          {pdfUrl ? (
            <iframe src={`${pdfUrl}#toolbar=0`} width="100%" height="100%" style={{ border: "none" }} />
          ) : (
            <div style={{ padding: "50px", width: "100%", maxWidth: "850px", backgroundColor: "white", marginTop: "20px", textAlign: "center" }}>
              Cargando documento...
            </div>
          )}
        </div>

        {/* Lado Derecho: Controles IA */}
        <div style={{ width: "450px", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", backgroundColor: "#fdfdfd" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "35px" }}>
            <div style={{ backgroundColor: "#f5f3ff", padding: "20px", borderRadius: "20px", marginBottom: "20px", display: "flex", gap: "15px", border: "1px solid #ddd6fe", alignItems: "center" }}>
              <div style={{ backgroundColor: "#8b5cf6", padding: "10px", borderRadius: "12px", color: "white" }}><Wand2 size={26} /></div>
              <span style={{ fontWeight: "900", color: "#6b21a8", fontSize: "1.05rem" }}>Certeza AIA Sugiere: {submission?.ai_score}</span>
            </div>

            {/* Alerta automática de la IA evaluadora (ya viene calculada al calificar, sin acción extra) */}
            {submission?.ai_integrity_flag && (
              <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "16px", padding: "16px", marginBottom: "20px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <div style={{ fontWeight: "900", color: "#991b1b", fontSize: "0.9rem" }}>Posible señal de integridad detectada por la IA</div>
                  <div style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: "4px" }}>{submission?.ai_integrity_notes}</div>
                </div>
              </div>
            )}

            {/* Análisis de historial de revisiones — contribución por integrante + pegado masivo */}
            <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "18px", marginBottom: "30px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: integrityResult ? "14px" : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "800", color: "#1B396A", fontSize: "0.9rem" }}>
                  <Search size={16} /> Historial de Edición
                </div>
                <button
                  onClick={handleAnalyzeIntegrity}
                  disabled={isAnalyzingIntegrity || !submission?.content_url}
                  title={!submission?.content_url ? "Solo disponible para entregas en Google Workspace" : ""}
                  style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: "10px", padding: "6px 12px", fontSize: "0.8rem", fontWeight: "700", color: "#1B396A", cursor: !submission?.content_url ? "not-allowed" : "pointer", opacity: !submission?.content_url ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {isAnalyzingIntegrity ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  {isAnalyzingIntegrity ? "Analizando..." : "Analizar"}
                </button>
              </div>

              {integrityResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(integrityResult.contributions?.length ?? 0) > 0 && (
                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}><Users size={13} /> Contribución por integrante</div>
                      {integrityResult.contributions?.map((c) => (
                        <div key={c.email} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 0", color: "#334155" }}>
                          <span>{c.student_name}</span>
                          <span style={{ fontWeight: "800", color: "#1B396A" }}>{c.percent}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(integrityResult.suspiciousPastes?.length ?? 0) > 0 ? (
                    <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "10px", fontSize: "0.8rem", color: "#92400e" }}>
                      ⚠️ {integrityResult.suspiciousPastes?.length} posible(s) pegado(s) masivo(s) detectado(s) en el historial.
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Sin indicios de pegado masivo en el historial revisado.</div>
                  )}
                </div>
              )}
            </div>

            {Object.keys(scores).map(key => (
              <div key={key} style={{ marginBottom: "35px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", fontWeight: "800", color: "#1B396A" }}>
                  <span>{key}</span>
                  <input
                    type="number" min="0" max="100" value={scores[key]}
                    onChange={(e) => setScores({...scores, [key]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))})}
                    style={{ backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", padding: "4px 8px", borderRadius: "8px", fontSize: "1.1rem", fontWeight: "900", color: "#1B396A", width: "60px", textAlign: "center", outline: "none" }}
                  />
                </div>
                <input type="range" min="0" max="100" value={scores[key]} onChange={(e) => setScores({...scores, [key]: parseInt(e.target.value)})} style={{ width: "100%", accentColor: "#1B396A", height: "8px", cursor: "pointer" }} />
              </div>
            ))}

            <div style={{ marginTop: "45px" }}>
              <div style={{ fontWeight: "900", color: "#1B396A", fontSize: "1.1rem", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}><MessageSquare size={22} /> Retroalimentación</div>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} style={{ width: "100%", height: "200px", padding: "20px", borderRadius: "24px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1rem", resize: "none" }} />
            </div>
          </div>

          <div style={{ padding: "35px", borderTop: "2px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Nota Final</div>
                <div style={{ fontSize: "3.2rem", fontWeight: "1000", color: "#1B396A", lineHeight: 1 }}>{total.toFixed(1)}</div>
              </div>

              <ExpandingButton
                icon={Save}
                label="Guardar"
                onClick={handleSave}
                variant="primary"
                loading={isSaving}
                size={52} radius={14} gap={10} padding="0 20px" collapsePadding
                fontWeight={900} fontSize="1rem" bounce durationMs={400}
                shadow="always" dimOnDisable minWidth="52px" iconSize={22}
                colors={{ bg: "#152c54", hoverBg: "#152c54" }}
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

export default function AuditoriaIndividualPage() {
  const { id: courseId, assignmentId, submissionId } = useParams() as { id: string; assignmentId: string; submissionId: string };
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchAuditoria(courseId, assignmentId, submissionId, reloadKey), [courseId, assignmentId, submissionId, reloadKey]);

  return (
    <Suspense fallback={<div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 className="animate-spin" size={48} color="#1B396A" /></div>}>
      <AuditoriaContent key={`${submissionId}-${reloadKey}`} resource={resource} courseId={courseId} assignmentId={assignmentId} submissionId={submissionId} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
