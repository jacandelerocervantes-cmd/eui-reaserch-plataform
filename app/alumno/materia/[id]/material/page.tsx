"use client";

import React, { use, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  FileText, Video, FileArchive, FileSpreadsheet, Presentation, Image as ImageIcon,
  Download, Sparkles, BookOpen, Loader2, Search, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";

const TYPE_ICON: Record<string, React.ElementType> = {
  pdf: FileText, video: Video, sheet: FileSpreadsheet, slide: Presentation, imagen: ImageIcon, doc: FileArchive,
};

type UnitOption = { id: string; unit_number: number; title: string };
type Material = { id: string; nombre: string; url: string; tipo: string; size: string | null; ai: boolean; unit_id: string };

type FetchResult =
  | { kind: "ok"; units: UnitOption[]; materiales: Material[] }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchMaterial(
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

    const { data: materialesData } = await supabase
      .from('materiales_boveda')
      .select('id, nombre, url, tipo, size, ai, unit_id')
      .eq('materia_id', courseId)
      .eq('es_visible', true)
      .order('created_at', { ascending: false });

    return { kind: "ok", units: unitsData ?? [], materiales: materialesData ?? [] };
  } catch (err) {
    console.error('Error cargando material:', err);
    return { kind: "error", message: 'No se pudo cargar el material de esta materia.' };
  }
}

// --- TARJETA DE ARCHIVO — mismo patrón visual que la Bóveda del docente,
// sin Ocultar/Mostrar (eso solo lo controla el docente): solo abrir. ---
const FileCard = ({ file }: { file: Material }) => {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = TYPE_ICON[file.tipo] ?? FileArchive;

  return (
    <a
      href={file.url} target="_blank" rel="noreferrer"
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0",
        boxShadow: isHovered ? "0 20px 25px -5px rgba(0,0,0,0.1)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", padding: "20px",
        display: "flex", alignItems: "flex-start", gap: "16px", textDecoration: "none",
      }}
    >
      <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "12px" }}>
        <Icon size={28} color="#3b82f6" />
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: "0 0 6px 0", color: "#1B396A", fontSize: "1rem", fontWeight: "800", lineHeight: "1.3", wordBreak: "break-word" }}>{file.nombre}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {file.size && <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: "600" }}>{file.size}</span>}
          {file.ai && (
            <span style={{ backgroundColor: "#f3f0ff", color: "#7c3aed", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "6px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
              <Sparkles size={10} /> IA
            </span>
          )}
        </div>
      </div>
      <Download size={18} color="#94a3b8" />
    </a>
  );
};

function MaterialContent({ resource, onRetry }: { resource: Promise<FetchResult>; onRetry: () => void }) {
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

  const { units, materiales } = result;
  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const unitMateriales = selectedUnitId
    ? materiales.filter(m => m.unit_id === selectedUnitId && m.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  return (
    <div style={{ maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div>
        <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Material Didáctico</h1>
        <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Tu material disponible, agrupado por unidad</p>
      </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <div style={{ position: "relative", width: "100%", maxWidth: "500px" }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text" placeholder="Buscar archivo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
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
          <p style={{ color: "#64748b" }}>Para ver su material.</p>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
            <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>U{selectedUnit?.unit_number}</span>
            <h2 style={{ fontSize: "1.4rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{selectedUnit?.title}</h2>
          </div>

          {unitMateriales.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px", alignItems: "start" }}>
              {unitMateriales.map((m) => <FileCard key={m.id} file={m} />)}
            </div>
          ) : (
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", fontStyle: "italic" }}>
              {searchTerm ? "No hay archivos que coincidan con tu búsqueda." : "Esta unidad no tiene material todavía."}
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

export default function MaterialAlumno() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchMaterial(courseId, router, reloadKey), [courseId, router, reloadKey]);

  return (
    <Suspense fallback={
      <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
      </div>
    }>
      <MaterialContent resource={resource} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
