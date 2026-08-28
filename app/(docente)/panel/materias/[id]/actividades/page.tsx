"use client";

import { use, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FileText, Plus, Search, Calendar, Users, ArrowRight, Pencil, ChevronDown, FileSpreadsheet, Presentation, MessageSquare, Cloud, HardDrive, ExternalLink, FolderOpen, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

// ── Chip de tipo de entrega ─────────────────────────────────────────────────
const TYPE_MAP: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  doc:    { icon: <FileText size={12} />,        label: 'Google Docs',   color: '#2563eb', bg: '#eff6ff' },
  sheet:  { icon: <FileSpreadsheet size={12} />, label: 'Google Sheets', color: '#16a34a', bg: '#f0fdf4' },
  slide:  { icon: <Presentation size={12} />,    label: 'Google Slides', color: '#ea580c', bg: '#fff7ed' },
  hybrid: { icon: <Cloud size={12} />,           label: 'Híbrido',       color: '#7c3aed', bg: '#f5f3ff' },
  forum:  { icon: <MessageSquare size={12} />,   label: 'Foro',          color: '#a21caf', bg: '#fdf4ff' },
  file:   { icon: <HardDrive size={12} />,       label: 'Archivo',       color: '#1B396A', bg: '#f0f7ff' },
};

const TypeChip = ({ type }: { type: string }) => {
  const m = TYPE_MAP[type] ?? TYPE_MAP.file;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: '8px', backgroundColor: m.bg, color: m.color }}>
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
  workspace_url: string | null;
  drive_folder_id: string | null;
  submissions: { count: number }[];
};

// --- SUB-COMPONENTE: TARJETA DE ACTIVIDAD EXPANSIBLE ---
const ActivityHoverCard = ({ act, courseId }: { act: ActividadListItem, courseId: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0",
        boxShadow: isHovered ? "0 20px 25px -5px rgba(0,0,0,0.1)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden",
        display: "flex", flexDirection: "column", position: "relative"
      }}
    >
      {/* HEADER: Siempre visible (Compacto) */}
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <TypeChip type={act.submission_type ?? 'file'} />
            {act.workspace_url && (
              <a href={act.workspace_url} target="_blank" rel="noopener noreferrer"
                style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', fontWeight: 700 }}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={10} /> Ver Doc
              </a>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>
            <Calendar size={12} /> {act.soft_deadline ? new Date(act.soft_deadline).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha'}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.15rem", fontWeight: "800", lineHeight: "1.3", paddingRight: "10px" }}>{act.title}</h3>
          <ChevronDown size={20} color={isHovered ? "#1B396A" : "#cbd5e1"} style={{ transition: "transform 0.4s", transform: isHovered ? "rotate(180deg)" : "rotate(0)" }} />
        </div>
      </div>

      {/* BODY: Se revela al pasar el mouse */}
      <div style={{
        maxHeight: isHovered ? "300px" : "0px",
        opacity: isHovered ? 1 : 0,
        padding: isHovered ? "0 20px 20px 20px" : "0 20px",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", margin: "4px 0 12px 0" }} />

        {/* Descripción truncada a 3 líneas */}
        <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: "1.5", margin: "0 0 16px 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {act.description}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1B396A", fontWeight: "800", fontSize: "0.85rem", marginBottom: "16px" }}>
          <Users size={16} color="#94a3b8" /> {act.submissions?.[0]?.count ?? 0} Entregadas
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <ExpandingButton icon={ArrowRight} label="Evaluar" onClick={() => router.push(`/panel/materias/${courseId}/actividades/${act.id}`)} variant="primary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
          {act.drive_folder_id && (
            <a
              href={`https://drive.google.com/drive/folders/${act.drive_folder_id}`}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Abrir carpeta en Drive"
              style={{ padding: "10px 14px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <FolderOpen size={18} />
            </a>
          )}
          <button onClick={() => router.push(`/panel/materias/${courseId}/actividades/${act.id}/editar`)} style={{ padding: "10px 14px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "10px", cursor: "pointer" }}>
            <Pencil size={18}/>
          </button>
        </div>
      </div>
    </div>
  );
};

type UnitOption = { id: string; unit_number: number; title: string };

type FetchResult = { ok: true; units: UnitOption[]; actividades: ActividadListItem[] } | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  if (!result.ok) return (
    <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444" }}>
      <FileText size={40} color="#ef4444" />
      <p style={{ fontWeight: "700" }}>{result.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { units, actividades } = result;

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

      {/* BARRA DE BÚSQUEDA + SELECTOR DE UNIDAD */}
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

      {/* ================= CONTENEDOR: solo se muestra tras elegir unidad ================= */}
      <div style={{ display: "flex", flexDirection: "column", gap: "40px", marginTop: "10px" }}>
        {!selectedUnitId ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <FileText size={40} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontWeight: "600" }}>Selecciona una unidad arriba para ver sus actividades.</p>
          </div>
        ) : (() => {
          const unit = units.find(u => u.id === selectedUnitId);
          if (!unit) return null;
          const unitActs = actividades.filter(a =>
            a.unit_id === unit.id &&
            a.title.toLowerCase().includes(searchTerm.toLowerCase())
          );

          if (unitActs.length === 0) {
            return (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                <FileText size={40} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
                <p style={{ fontWeight: "600" }}>
                  {searchTerm ? "No hay actividades que coincidan con tu búsqueda." : "No hay actividades en esta unidad todavía."}
                </p>
              </div>
            );
          }

          return (
            <div key={unit.id}>
              {/* Título de la Unidad */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
                <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>
                  U{unit.unit_number}
                </span>
                <h2 style={{ fontSize: "1.4rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{unit.title}</h2>
              </div>

              {/* Grid de Tarjetas Expansibles */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
                {unitActs.map(act => (
                  <ActivityHoverCard key={act.id} act={act} courseId={courseId} />
                ))}
              </div>
            </div>
          );
        })()}
      </div>

    </div>
  );
}

export default function ListaActividadesPage() {
  const { id: courseId } = useParams() as { id: string };
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchActividades(courseId, reloadKey), [courseId, reloadKey]);

  return (
    <Suspense fallback={
      <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <FileText size={40} color="#cbd5e1" />
      </div>
    }>
      <ActividadesContent resource={resource} courseId={courseId} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
