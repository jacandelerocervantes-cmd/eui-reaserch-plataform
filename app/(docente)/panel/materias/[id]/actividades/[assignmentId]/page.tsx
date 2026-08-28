"use client";

import { use, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Users, CheckCircle2, Wand2, Search,
  FileText, ShieldAlert, Loader2,
  Filter, RotateCcw
} from "lucide-react";
import StatCard from "./_components/StatCard";
import PlagiarismBanner, { type PlagiarismResult } from "./_components/PlagiarismBanner";
import SubmissionsTable, { type SubmissionRow } from "./_components/SubmissionsTable";
import FloatingActionPill from "./_components/FloatingActionPill";
import ExpandingButton from "@/components/ui/ExpandingButton";

type FetchResult = { ok: true; submissions: SubmissionRow[] } | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchEntregas(courseId: string, assignmentId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: studentsList } = await supabase
      .from('students')
      .select('id, matricula, nombres, apellido_paterno')
      .eq('course_id', courseId)
      .order('apellido_paterno', { ascending: true });

    const { data: subs } = await supabase
      .from('submissions')
      .select('id, student_id, status, final_score, ai_score, ai_feedback, metadata, is_late, submitted_at, file_path, content_url, drive_folder_id')
      .eq('assignment_id', assignmentId);

    type StudentRow = { id: string; matricula: string; nombres: string; apellido_paterno: string };
    type SubRow = {
      id: string; student_id: string; status: string; final_score: number | null; ai_score: number | null;
      ai_feedback: string | null; metadata: unknown; is_late: boolean; submitted_at: string | null;
      file_path: string | null; content_url: string | null; drive_folder_id: string | null;
    };
    const submissions: SubmissionRow[] = ((studentsList ?? []) as StudentRow[]).map((student) => {
      const sub = (subs as SubRow[] | null)?.find((s) => s.student_id === student.id);
      // create-assignment-hub pre-crea la fila con status='draft' (carpeta/archivo
      // propio) al momento de publicar la actividad — eso NO es una entrega real.
      // Solo cuenta como entregado si hay archivo o submitted_at.
      const hasRealSubmission = !!sub && (!!sub.file_path || !!sub.submitted_at);
      return {
        id:          student.id,
        subId:       sub?.id ?? null,
        name:        `${student.apellido_paterno}, ${student.nombres}`,
        status:      hasRealSubmission ? sub.status : 'no_submission',
        score:       sub?.final_score ?? (sub?.status === 'ai_draft' ? sub?.ai_score : null),
        aiScore:     sub?.ai_score ?? null,
        aiFeedback:  sub?.ai_feedback ?? null,
        metadata:    sub?.metadata ?? null,
        isLate:      sub?.is_late ?? false,
        contentUrl:  sub?.content_url ?? null,
        folderId:    sub?.drive_folder_id ?? null,
      };
    });

    return { ok: true, submissions };
  } catch (err) {
    console.error("Error cargando entregas:", err);
    return { ok: false, error: err instanceof Error ? err.message : "No se pudieron cargar las entregas." };
  }
}

function DashboardEntregasContent({
  resource, courseId, assignmentId, onReload,
}: { resource: Promise<FetchResult>; courseId: string; assignmentId: string; onReload: () => void }) {
  const result = use(resource);
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [isCheckingPlagiarism, setIsCheckingPlagiarism] = useState(false);
  const [plagiarismResult, setPlagiarismResult] = useState<PlagiarismResult | null>(null);

  if (!result.ok) return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto" }}>
      <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {result.error}
        <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onReload} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
      </div>
    </div>
  );

  const { submissions } = result;

  const eligibleSubmissions = submissions.filter(s => s.status !== 'no_submission');
  const entregadas = eligibleSubmissions.length;
  const borradoresIA = submissions.filter(s => s.status === 'ai_draft').length;
  const calificados = submissions.filter(s => s.status === 'completed').length;

  // Avance secuencial: no se puede calificar a alguien si el anterior (en el
  // orden alfabético de la lista) no ha sido Publicado todavía. El borrador de
  // IA es temporal y no cuenta como terminado — solo 'completed' desbloquea.
  const lockMap = new Map<string, boolean>();
  {
    let blocked = false;
    for (const s of submissions) {
      if (s.status === 'no_submission') continue;
      lockMap.set(s.id, blocked);
      if (s.status !== 'completed') blocked = true;
    }
  }

  // --- LÓGICA DE SELECCIÓN (FIX ONCHANGE) ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(eligibleSubmissions.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Si TODA la selección está en Borrador IA, se ofrece publicarla en lote
  // como calificación final, en vez de "Procesar con IA" (ya no aplicaría).
  const selectedSubmissions = submissions.filter(s => selectedIds.includes(s.id));
  const allSelectedAreAIDraft = selectedSubmissions.length > 0 && selectedSubmissions.every(s => s.status === 'ai_draft');

  // Publica en lote, pero respeta el bloqueo secuencial: solo confirma las que
  // ya están desbloqueadas (el anterior en la lista ya fue Publicado). Las que
  // sigan bloqueadas quedan en ai_draft y se reportan como pendientes.
  const handlePublishSelected = async () => {
    const toPublish = selectedSubmissions.filter(s => !(lockMap.get(s.id) ?? false));
    const skipped = selectedSubmissions.length - toPublish.length;

    if (toPublish.length === 0) {
      alert("Ninguna de las seleccionadas se puede publicar todavía: el alumno anterior en la lista no ha sido publicado.");
      return;
    }

    setIsProcessingAI(true);
    try {
      for (const s of toPublish) {
        const { error } = await supabase
          .from('submissions')
          .update({
            status:         'completed',
            final_score:    s.aiScore,
            final_feedback: s.aiFeedback,
            metadata:       s.metadata,
            graded_at:      new Date().toISOString(),
          })
          .eq('id', s.subId);
        if (error) throw error;
      }
      onReload();
      if (skipped > 0) {
        alert(`${toPublish.length} calificación(es) publicada(s). ${skipped} quedaron pendientes por el orden secuencial — se desbloquean a medida que se publican las anteriores.`);
      }
    } catch (e) {
      alert("Error al publicar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsProcessingAI(false);
      setSelectedIds([]);
    }
  };

  // Procesa cualquier cantidad de entregas (1 o 200): llama a evaluate-submissions-ia
  // en lotes hasta agotar 'remaining'. El backend deja cada entrega no terminada en
  // status='ai_queued', así que esto es retomable sin importar qué tipo de límite la
  // detuvo (por minuto, por hora, por día) — basta con volver a pulsar "Procesar con
  // IA" más tarde y continúa exactamente donde se quedó. Mientras la pestaña esté
  // abierta, reintenta solo con backoff creciente para no perder el progreso de la sesión.
  const handleProcessAI = async () => {
    const subIds = submissions.filter(s => selectedIds.includes(s.id) && s.subId).map(s => s.subId);
    if (!subIds.length) return;

    setIsProcessingAI(true);
    setAiProgress({ done: 0, total: subIds.length });

    let remaining = subIds.length;
    let consecutiveNoProgress = 0;
    const MAX_RETRIES = 12; // ventana de paciencia dentro de esta sesión (~varios minutos)

    try {
      while (remaining > 0) {
        const { data, error } = await supabase.functions.invoke('evaluate-submissions-ia', {
          body: { submission_ids: subIds, assignment_id: assignmentId }
        });
        if (error) throw new Error(error.message || "Error al contactar el servicio de IA.");
        if (!data?.success) throw new Error(data?.error || "Error en la evaluación con IA.");

        remaining = data.remaining ?? 0;
        setAiProgress({ done: subIds.length - remaining, total: subIds.length });

        if ((data.processed === 0 || data.rateLimited) && remaining > 0) {
          consecutiveNoProgress++;
          if (consecutiveNoProgress > MAX_RETRIES) {
            throw new Error(
              `Límite de la IA alcanzado por ahora. Ya se evaluaron ${subIds.length - remaining} de ${subIds.length}; ` +
              `el resto queda guardado en cola. Vuelve a presionar "Procesar con IA" en unos minutos (o más tarde) y continuará automáticamente donde se quedó.`
            );
          }
          // Backoff más largo cuando confirmamos 429 real vs. un simple lote vacío
          const base = data.rateLimited ? 8_000 : 5_000;
          await new Promise(r => setTimeout(r, Math.min(60_000, base * consecutiveNoProgress)));
        } else {
          consecutiveNoProgress = 0;
          if (remaining > 0) await new Promise(r => setTimeout(r, 3_000));
        }
      }
      onReload();
    } catch (e) {
      alert("Error IA: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsProcessingAI(false);
      setAiProgress({ done: 0, total: 0 });
      setSelectedIds([]);
    }
  };

  const handleCheckPlagiarism = async () => {
    setIsCheckingPlagiarism(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-cross-plagiarism', { body: { assignment_id: assignmentId } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "No se pudo completar la revisión.");
      setPlagiarismResult(data);
    } catch (e) {
      alert("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsCheckingPlagiarism(false);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.03em" }}>Control de Entregas</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Auditoría de evidencias para esta actividad</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px" }}>
        <StatCard label="Alumnos" value={submissions.length} icon={Users} color="#1B396A" />
        <StatCard label="Entregas" value={entregadas} icon={FileText} color="#3b82f6" />
        <StatCard label="Borradores IA" value={borradoresIA} icon={Wand2} color="#8b5cf6" />
        <StatCard label="Calificados" value={calificados} icon={CheckCircle2} color="#10b981" />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Buscar alumno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "350px", padding: "14px 16px 14px 48px", borderRadius: "16px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none", backgroundColor: "white" }}
          />
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handleCheckPlagiarism}
            disabled={isCheckingPlagiarism}
            title="Compara una muestra de las entregas ya calificadas para detectar similitud sospechosa entre alumnos"
            style={{ backgroundColor: "white", border: "1px solid #e2e8f0", padding: "14px 20px", borderRadius: "16px", color: "#1B396A", cursor: isCheckingPlagiarism ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700" }}
          >
            {isCheckingPlagiarism ? <Loader2 size={18} className="animate-spin" /> : <ShieldAlert size={18} />}
            {isCheckingPlagiarism ? "Revisando..." : "Plagio Cruzado"}
          </button>
          <button style={{ backgroundColor: "white", border: "1px solid #e2e8f0", padding: "14px 20px", borderRadius: "16px", color: "#1B396A", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700" }}>
            <Filter size={18} /> Filtrar Lista
          </button>
        </div>
      </div>

      {plagiarismResult && (
        <PlagiarismBanner plagiarismResult={plagiarismResult} setPlagiarismResult={setPlagiarismResult} />
      )}

      <SubmissionsTable
        loading={false}
        submissions={submissions}
        selectedIds={selectedIds}
        eligibleSubmissions={eligibleSubmissions}
        lockMap={lockMap}
        handleSelectAll={handleSelectAll}
        handleToggleSelect={handleToggleSelect}
        courseId={courseId}
        assignmentId={assignmentId}
        router={router}
      />

      {selectedIds.length > 0 && (
        <FloatingActionPill
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          isProcessingAI={isProcessingAI}
          aiProgress={aiProgress}
          allSelectedAreAIDraft={allSelectedAreAIDraft}
          handlePublishSelected={handlePublishSelected}
          handleProcessAI={handleProcessAI}
        />
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

export default function DashboardEntregas() {
  const { id: courseId, assignmentId } = useParams() as { id: string; assignmentId: string };
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchEntregas(courseId, assignmentId, reloadKey), [courseId, assignmentId, reloadKey]);

  return (
    <Suspense fallback={
      <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
      </div>
    }>
      <DashboardEntregasContent key={reloadKey} resource={resource} courseId={courseId} assignmentId={assignmentId} onReload={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
