"use client";

import { use, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  FileText, Plus, Calendar, Users, ArrowRight,
  Pencil, FileSpreadsheet, Presentation, MessageSquare,
  Cloud, HardDrive, ExternalLink, FolderOpen, RotateCcw,
  Gamepad2, BookOpen, AlertCircle, Loader2
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

// ── Chip de tipo de entrega ─────────────────────────────────────────────────
const TYPE_MAP: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  doc:               { icon: <FileText size={12} />,        label: 'Google Docs',   color: '#2563eb', bg: '#eff6ff' },
  sheet:             { icon: <FileSpreadsheet size={12} />, label: 'Google Sheets', color: '#16a34a', bg: '#f0fdf4' },
  slide:             { icon: <Presentation size={12} />,    label: 'Google Slides', color: '#ea580c', bg: '#fff7ed' },
  workspace:         { icon: <FileText size={12} />,        label: 'Workspace',     color: '#2563eb', bg: '#eff6ff' },
  hybrid:            { icon: <Cloud size={12} />,           label: 'Híbrido',       color: '#7c3aed', bg: '#f5f3ff' },
  forum:             { icon: <MessageSquare size={12} />,   label: 'Foro',          color: '#a21caf', bg: '#fdf4ff' },
  file:              { icon: <HardDrive size={12} />,       label: 'Archivo',       color: '#1B396A', bg: '#f0f7ff' },
  puzzle_crossword:  { icon: <Gamepad2 size={12} />,        label: 'Crucigrama',    color: '#7c3aed', bg: '#f5f3ff' },
  puzzle_wordsearch: { icon: <Gamepad2 size={12} />,        label: 'Sopa de Letras',color: '#059669', bg: '#ecfdf5' },
};

const TypeChip = ({ type }: { type: string }) => {
  const m = TYPE_MAP[type] ?? TYPE_MAP.file;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', backgroundColor: m.bg, color: m.color, textTransform: 'uppercase' }}>
      {m.icon} {m.label}
    </span>
  );
};

type ActividadListItem = {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  soft_deadline: string | null;
  submission_type: string | null;
  rubric_data?: unknown;
  workspace_url: string | null;
  drive_folder_id: string | null;
  submissions: { count: number }[];
};

// --- TARJETA DE ACTIVIDAD UNIFICADA CON EVALUACIONES ---
const ActivityCard = ({ act, courseId }: { act: ActividadListItem; courseId: string }) => {
  const router = useRouter();

  const effectiveType =
    (act.rubric_data as Record<string, unknown>)?.puzzle_type as string ||
    (act.rubric_data as Record<string, unknown>)?.workspace_type as string ||
    act.submission_type ||
    'file';

  return (
    <div
      style={{
        backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <TypeChip type={effectiveType} />
            {act.workspace_url && (
              <a href={act.workspace_url} target="_blank" rel="noopener noreferrer"
                style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', fontWeight: 700 }}
              >
                <ExternalLink size={11} /> Ver Doc
              </a>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>
            <Calendar size={12} /> {act.soft_deadline ? new Date(act.soft_deadline).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : 'Sin fecha'}
          </div>
        </div>

        <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.15rem", fontWeight: "800", lineHeight: "1.3" }}>{act.title}</h3>
        <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: "1.5", margin: "10px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", flex: 1 }}>
          {act.description || "Sin descripción disponible."}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1B396A", fontWeight: "800", fontSize: "0.85rem", margin: "12px 0 0" }}>
          <Users size={16} color="#94a3b8" /> {act.submissions?.[0]?.count ?? 0} Entregadas
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px 20px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <ExpandingButton icon={ArrowRight} label="Evaluar" onClick={() => router.push(`/panel/materias/${courseId}/actividades/${act.id}`)} variant="primary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
        <ExpandingButton icon={Pencil} label="Editar" onClick={() => router.push(`/panel/materias/${courseId}/actividades/${act.id}/editar`)} variant="default" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} colors={{ hoverText: "#64748b" }} />
        {act.drive_folder_id && (
          <a
            href={`https://drive.google.com/drive/folders/${act.drive_folder_id}`}
            target="_blank" rel="noopener noreferrer"
            title="Abrir carpeta en Google Drive"
            style={{ width: "44px", height: "44px", borderRadius: "12px", border: "1px solid #cbd5e1", backgroundColor: "white", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
          >
            <FolderOpen size={18} />
          </a>
        )}
      </div>
    </div>
  );
};

type UnitOption = { id: string; unit_number: number; title: string };
type FetchResult = { ok: true; units: UnitOption[]; actividades: ActividadListItem[] } | { ok: false; error: string };

async function fetchActividades(courseId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: unitsDataRaw } = await supabase
      .from('course_units')
      .select('id, unit_number, title')
      .eq('course_id', courseId)
      .order('unit_number', { ascending: true });
    const unitsData = unitsDataRaw as UnitOption[] | null;

    let actividades: ActividadListItem[] = [];
    if (unitsData && unitsData.length > 0) {
      const unitIds = unitsData.map((u) => u.id);
      const { data: asgsData } = await supabase
        .from('assignments')
        .select('*, submissions(count)')
        .in('unit_id', unitIds)
        .order('created_at', { ascending: false });
      actividades = asgsData ?? [];
    }

    return { ok: true, units: unitsData ?? [], actividades };
  } catch (err) {
    console.error("Error cargando actividades:", err);
    return { ok: false, error: err instanceof Error ? err.message : "No se pudieron cargar las actividades." };
  }
}

function ActividadesContent({ resource, courseId, onRetry }: { resource: Promise<FetchResult>; courseId: string; onRetry: () => void }) {
  const result = use(resource);
  const router = useRouter();
  const [selectedUnitId, setSelectedUnitId] = useState("");

  if (!result.ok) return (
    <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444" }}>
      <FileText size={40} color="#ef4444" />
      <p style={{ fontWeight: "700" }}>{result.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { units, actividades } = result;
  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const unitActividades = selectedUnitId ? actividades.filter(a => a.unit_id === selectedUnitId) : [];

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      {/* HEADER PRINCIPAL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Actividades</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Evaluación continua agrupada por unidades</p>
        </div>
        <ExpandingButton icon={Plus} label="Nueva Actividad" onClick={() => router.push(`/panel/materias/${courseId}/actividades/nueva`)} variant="primary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
      </div>

      {/* SELECTOR DE UNIDAD — Sin buscador redundante, exactamente como Evaluaciones */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px", backgroundColor: "#f0f7ff", borderRadius: "12px", border: "1px solid #bfdbfe", width: "fit-content" }}>
        <span style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.75rem", textTransform: "uppercase" }}>Unidad</span>
        <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #bfdbfe", outline: "none", fontSize: "0.85rem", fontWeight: "700", color: "#1B396A", backgroundColor: "white", cursor: "pointer" }}>
          <option value="">Selecciona una unidad...</option>
          {units.map(u => <option key={u.id} value={u.id}>U{u.unit_number}: {u.title}</option>)}
        </select>
      </div>

      {/* ================= CONTENEDOR DE ACTIVIDADES ================= */}
      {!selectedUnitId ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#f8fafc", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
          <BookOpen size={40} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ color: "#1B396A", margin: 0 }}>Selecciona una unidad arriba</h3>
          <p style={{ color: "#64748b" }}>Para ver sus actividades y tareas vinculadas.</p>
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
            <span style={{ fontSize: "1.1rem", fontWeight: "900", color: "#1B396A" }}>
              U{selectedUnit?.unit_number}: {selectedUnit?.title}
            </span>
            <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#64748b", backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: "10px" }}>
              {unitActividades.length} actividades
            </span>
          </div>

          {unitActividades.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#f8fafc", borderRadius: "20px", border: "1px dashed #e2e8f0" }}>
              <p style={{ color: "#64748b", margin: 0, fontWeight: "600" }}>No hay actividades creadas para esta unidad.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
              {unitActividades.map(act => (
                <ActivityCard key={act.id} act={act} courseId={courseId} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActividadesPage() {
  const params = useParams();
  const courseId = params?.id as string;
  const [reloadKey, setReloadKey] = useState(0);
  const [resource, setResource] = useState<Promise<FetchResult>>(() => fetchActividades(courseId, 0));

  const handleRetry = () => {
    const nextKey = reloadKey + 1;
    setReloadKey(nextKey);
    setResource(fetchActividades(courseId, nextKey));
  };

  return (
    <Suspense fallback={
      <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
        <p style={{ color: "#64748b", fontWeight: "700" }}>Cargando actividades...</p>
      </div>
    }>
      <ActividadesContent resource={resource} courseId={courseId} onRetry={handleRetry} />
    </Suspense>
  );
}
