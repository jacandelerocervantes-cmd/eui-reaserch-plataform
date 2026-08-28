"use client";

import { use, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  FileText, Calendar, ArrowRight, ChevronDown, BookOpen, Loader2, Search,
  FileSpreadsheet, Presentation, MessageSquare, Cloud, HardDrive, CheckCircle2, ExternalLink, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

const TYPE_MAP: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  doc:    { icon: <FileText size={12} />,        label: 'Google Docs',   color: '#2563eb', bg: '#eff6ff' },
  sheet:  { icon: <FileSpreadsheet size={12} />, label: 'Google Sheets', color: '#16a34a', bg: '#f0fdf4' },
  slide:  { icon: <Presentation size={12} />,    label: 'Google Slides', color: '#ea580c', bg: '#fff7ed' },
  hybrid: { icon: <Cloud size={12} />,           label: 'Híbrido',       color: '#7c3aed', bg: '#f5f3ff' },
  forum:  { icon: <MessageSquare size={12} />,   label: 'Foro',          color: '#a21caf', bg: '#fdf4ff' },
  file:   { icon: <HardDrive size={12} />,       label: 'Archivo',       color: '#1B396A', bg: '#f0f7ff' },
};

type UnitOption = { id: string; unit_number: number; title: string };
type SubmissionInfo = { id: string; assignment_id: string; status: string; file_path: string | null };
type AssignmentWithSubmission = {
  id: string; title: string; description: string | null; soft_deadline: string; unit_id: string;
  submission_type: string | null; workspace_url: string | null; submission: SubmissionInfo | null;
};

type FetchResult =
  | { kind: "ok"; units: UnitOption[]; assignments: AssignmentWithSubmission[] }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchActividades(
  courseId: string,
  router: ReturnType<typeof useRouter>,
  _reloadKey: number
): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/alumno/login'); return { kind: "redirect" }; }

    const { data: studentRec } = await supabase
      .from('students').select('id').ilike('correo', user.email ?? '').eq('course_id', courseId).single();
    if (!studentRec) { router.push('/alumno'); return { kind: "redirect" }; }

    const { data: unitsData } = await supabase
      .from('course_units').select('id, unit_number, title').eq('course_id', courseId).order('unit_number', { ascending: true });

    const { data: assignmentData } = await supabase
      .from('assignments')
      .select('id, title, description, soft_deadline, unit_id, submission_type, workspace_url')
      .eq('course_id', courseId)
      .order('soft_deadline', { ascending: true });

    const { data: subsData } = await supabase
      .from('submissions').select('id, assignment_id, status, file_path').eq('student_id', studentRec.id);
    const subMap = new Map(((subsData ?? []) as SubmissionInfo[]).map((s) => [s.assignment_id, s]));

    type AssignmentBase = Omit<AssignmentWithSubmission, 'submission'>;
    const assignments: AssignmentWithSubmission[] = ((assignmentData ?? []) as AssignmentBase[]).map((a) => ({ ...a, submission: subMap.get(a.id) ?? null }));
    return { kind: "ok", units: unitsData ?? [], assignments };
  } catch (err) {
    console.error('Error cargando actividades:', err);
    return { kind: "error", message: 'No se pudieron cargar las actividades de esta materia.' };
  }
}

// --- TARJETA DE ACTIVIDAD — mismo patrón hover-reveal que el docente, sin
// botones de crear/editar/evaluar: solo el estado y la acción del alumno. ---
const ActivityHoverCard = ({ act, courseId }: { act: AssignmentWithSubmission; courseId: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const now = new Date();
  const deadline = new Date(act.soft_deadline);
  const isOverdue = deadline < now && !act.submission;
  const isSubmitted = act.submission?.status === 'submitted' || act.submission?.status === 'graded';
  const isDraft = act.submission?.status === 'draft';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white", borderRadius: "20px",
        border: isSubmitted ? "1px solid #bbf7d0" : isOverdue ? "1px solid #fecaca" : "1px solid #e2e8f0",
        boxShadow: isHovered ? "0 20px 25px -5px rgba(0,0,0,0.1)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden",
        display: "flex", flexDirection: "column", position: "relative",
      }}
    >
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '8px', backgroundColor: (TYPE_MAP[act.submission_type ?? 'file'] ?? TYPE_MAP.file).bg, color: (TYPE_MAP[act.submission_type ?? 'file'] ?? TYPE_MAP.file).color }}>
            {(TYPE_MAP[act.submission_type ?? 'file'] ?? TYPE_MAP.file).icon} {(TYPE_MAP[act.submission_type ?? 'file'] ?? TYPE_MAP.file).label}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: isOverdue ? "#dc2626" : "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>
            <Calendar size={12} /> {isOverdue ? "VENCIDA" : deadline ? `Cierra: ${deadline.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}` : 'Sin fecha'}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.15rem", fontWeight: "800", lineHeight: "1.3", paddingRight: "10px" }}>{act.title}</h3>
          <ChevronDown size={20} color={isHovered ? "#1B396A" : "#cbd5e1"} style={{ transition: "transform 0.4s", transform: isHovered ? "rotate(180deg)" : "rotate(0)", flexShrink: 0 }} />
        </div>
      </div>

      <div style={{
        maxHeight: isHovered ? "300px" : "0px", opacity: isHovered ? 1 : 0,
        padding: isHovered ? "0 20px 20px 20px" : "0 20px", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", margin: "4px 0 16px 0" }} />
        {act.description && (
          <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: "1.5", margin: "0 0 16px 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {act.description}
          </p>
        )}

        {isSubmitted ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#16a34a", fontWeight: "700", fontSize: "0.9rem" }}>
            <CheckCircle2 size={18} /> Entrega recibida
            {act.workspace_url && (
              <a href={act.workspace_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", color: "#2563eb", fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                Ver Doc <ExternalLink size={12} />
              </a>
            )}
          </div>
        ) : (
          <button
            onClick={() => router.push(`/alumno/materia/${courseId}/entregar/${act.id}`)}
            style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", backgroundColor: "#1B396A", color: "white", padding: "12px", borderRadius: "12px", fontWeight: "700", fontSize: "0.9rem", border: "none", cursor: "pointer" }}
          >
            {['doc', 'sheet', 'slide'].includes(act.submission_type ?? '') ? <Cloud size={16} /> : <ArrowRight size={16} />}
            {isDraft ? "Continuar Entrega" :
              ['doc', 'sheet', 'slide'].includes(act.submission_type ?? '') ? "Abrir en Google Workspace" :
              act.submission_type === 'hybrid' ? "Entregar (Híbrido)" :
              act.submission_type === 'forum' ? "Participar en el Foro" : "Subir Actividad"}
          </button>
        )}
      </div>
    </div>
  );
};

function ActividadesContent({ resource, courseId, onRetry }: { resource: Promise<FetchResult>; courseId: string; onRetry: () => void }) {
  const result = use(resource);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  if (result.kind === "redirect") return (
    <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={40} color="#1B396A" />
    </div>
  );

  if (result.kind === "error") return (
    <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
      <p style={{ color: "#ef4444", fontWeight: "700" }}>{result.message}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { units, assignments } = result;
  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const unitAssignments = selectedUnitId
    ? assignments.filter(a => a.unit_id === selectedUnitId && a.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div>
        <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Actividades</h1>
        <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Tus entregas agrupadas por unidad</p>
      </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <div style={{ position: "relative", width: "100%", maxWidth: "500px" }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text" placeholder="Buscar actividad..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "14px 16px 14px 52px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none" }}
          />
        </div>

        <select
          value={selectedUnitId}
          onChange={(e) => setSelectedUnitId(e.target.value)}
          style={{ padding: "14px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.95rem", fontWeight: "700", color: "#1B396A", backgroundColor: "white", cursor: "pointer", minWidth: "220px" }}
        >
          <option value="">Selecciona una unidad...</option>
          {units.map(u => <option key={u.id} value={u.id}>U{u.unit_number}: {u.title}</option>)}
        </select>
      </div>

      {!selectedUnitId ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#f8fafc", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
          <BookOpen size={40} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ color: "#1B396A", margin: 0 }}>Selecciona una unidad arriba</h3>
          <p style={{ color: "#64748b" }}>Para ver sus actividades.</p>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
            <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>U{selectedUnit?.unit_number}</span>
            <h2 style={{ fontSize: "1.4rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{selectedUnit?.title}</h2>
          </div>

          {unitAssignments.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
              {unitAssignments.map((a) => <ActivityHoverCard key={a.id} act={a} courseId={courseId} />)}
            </div>
          ) : (
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", fontStyle: "italic" }}>
              {searchTerm ? "No hay actividades que coincidan con tu búsqueda." : "Esta unidad no tiene actividades registradas."}
            </p>
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

export default function ActividadesAlumno() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchActividades(courseId, router, reloadKey), [courseId, router, reloadKey]);

  return (
    <Suspense fallback={
      <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
      </div>
    }>
      <ActividadesContent resource={resource} courseId={courseId} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
