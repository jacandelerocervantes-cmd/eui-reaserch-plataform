"use client";

import React, { useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  UploadCloud, FileText, Video, FileArchive, FileSpreadsheet, Presentation, Image as ImageIcon,
  ExternalLink, Eye, Sparkles, EyeOff, BookOpen, Loader2, RotateCcw, Trash2, AlertCircle
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useDriveMateria, useDriveMateriaContent, type Archivo } from "./_hooks/useDriveMateria";

const TYPE_ICON: Record<string, React.ElementType> = {
  pdf: FileText, video: Video, sheet: FileSpreadsheet, slide: Presentation, imagen: ImageIcon, doc: FileArchive,
};

// --- TARJETA DE ARCHIVO INTELIGENTE ---
const FileCard = ({
  file,
  onToggleVisibility,
  onDelete,
}: {
  file: Archivo;
  onToggleVisibility: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
}) => {
  const Icon = TYPE_ICON[file.tipo] ?? FileArchive;

  return (
    <div
      style={{
        backgroundColor: "white", borderRadius: "20px",
        border: file.es_visible ? "1px solid #e2e8f0" : "1px dashed #cbd5e1",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
        display: "flex", flexDirection: "column", position: "relative",
        opacity: file.es_visible ? 1 : 0.75, overflow: "hidden"
      }}
    >
      <div style={{ padding: "20px", flex: 1, display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ backgroundColor: file.es_visible ? "#eff6ff" : "#f1f5f9", padding: "12px", borderRadius: "12px", flexShrink: 0 }}>
          <Icon size={28} color={file.es_visible ? "#2563eb" : "#94a3b8"} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: "0 0 6px 0", color: file.es_visible ? "#1B396A" : "#64748b", fontSize: "1.05rem", fontWeight: "800", lineHeight: "1.3", wordBreak: "break-word" }}>
            {file.nombre}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
            {file.size && <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: "600" }}>{file.size}</span>}
            {file.ai && (
              <span style={{ backgroundColor: "#f3f0ff", color: "#7c3aed", fontSize: "0.7rem", padding: "2px 8px", borderRadius: "6px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                <Sparkles size={10} /> IA
              </span>
            )}
            {!file.es_visible && (
              <span style={{ backgroundColor: "#fee2e2", color: "#ef4444", fontSize: "0.7rem", padding: "2px 8px", borderRadius: "6px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                <EyeOff size={10} /> Oculto para alumnos
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9", padding: "14px 20px", display: "flex", gap: "8px", alignItems: "center", backgroundColor: "#fafbfc" }}>
        <ExpandingButton
          icon={file.es_visible ? EyeOff : Eye}
          label={file.es_visible ? "Ocultar" : "Mostrar"}
          onClick={() => onToggleVisibility(file.id, file.es_visible)}
          variant={file.es_visible ? "warning" : "success"}
          size={38} radius={10} gap={6} padding="0 10px" fontWeight={600} fontSize="0.85rem" durationMs={300}
        />
        <a
          href={file.url} target="_blank" rel="noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            backgroundColor: "white", color: "#1B396A", border: "1px solid #cbd5e1",
            padding: "0 12px", height: "38px", borderRadius: "10px", fontWeight: 700, fontSize: "0.85rem",
            textDecoration: "none", transition: "all 0.2s"
          }}
        >
          <ExternalLink size={14} /> Abrir
        </a>
        <button
          onClick={() => onDelete(file.id)}
          title="Eliminar material"
          style={{
            marginLeft: "auto", width: "38px", height: "38px", borderRadius: "10px",
            border: "1px solid #fee2e2", backgroundColor: "white", color: "#ef4444",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s"
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

function DriveContent({ resource, courseId, onRetry }: { resource: ReturnType<typeof useDriveMateria>["resource"]; courseId: string; onRetry: () => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    result,
    units,
    uploading,
    selectedUnitId, setSelectedUnitId,
    selectedUnit,
    unitFiles,
    toggleVisibility,
    handleFileSelected,
    handleDelete,
  } = useDriveMateriaContent(resource, courseId);

  if (!result.ok) return (
    <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444" }}>
      <p style={{ fontWeight: "700" }}>{result.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Header Principal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>
            Material Didáctico
          </h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>
            Bóveda de recursos y documentos por unidad
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <ExpandingButton
            icon={Sparkles}
            label="Crear con IA"
            onClick={() => router.push(`/panel/materias/${courseId}/drive/nuevo`)}
            variant="ai"
            size={44} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={300}
          />
          <input ref={fileInputRef} type="file" onChange={handleFileSelected} style={{ display: "none" }} />
          <ExpandingButton
            icon={uploading ? Loader2 : UploadCloud}
            label={uploading ? "Subiendo..." : "Subir Material"}
            onClick={() => {
              if (!selectedUnitId) {
                alert("Por favor selecciona una unidad primero.");
                return;
              }
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            variant="primary"
            size={44} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={300}
          />
        </div>
      </div>

      {/* Selector de Unidad */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px", backgroundColor: "#f0f7ff", borderRadius: "12px", border: "1px solid #bfdbfe", width: "fit-content" }}>
        <span style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.75rem", textTransform: "uppercase" }}>Unidad</span>
        <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #bfdbfe", outline: "none", fontSize: "0.85rem", fontWeight: "700", color: "#1B396A", backgroundColor: "white", cursor: "pointer" }}>
          <option value="">Selecciona una unidad...</option>
          {units.map(u => <option key={u.id} value={u.id}>U{u.unit_number}: {u.title}</option>)}
        </select>
      </div>

      {/* Contenedor de Materiales */}
      {!selectedUnitId ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#f8fafc", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
          <BookOpen size={40} color="#cbd5e1" style={{ marginBottom: "16px" }} />
          <h3 style={{ color: "#1B396A", margin: 0 }}>Selecciona una unidad arriba</h3>
          <p style={{ color: "#64748b" }}>Para consultar o subir material didáctico a la bóveda.</p>
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
              {unitFiles.length} recursos
            </span>
          </div>

          {unitFiles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#f8fafc", borderRadius: "20px", border: "1px dashed #e2e8f0" }}>
              <p style={{ color: "#64748b", margin: 0, fontWeight: "600" }}>Esta unidad no tiene material todavía.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px", alignItems: "start" }}>
              {unitFiles.map(file => (
                <FileCard key={file.id} file={file} onToggleVisibility={toggleVisibility} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DrivePage() {
  const { id: courseId } = useParams() as { id: string };
  const { resource, reloadKey, onReload } = useDriveMateria(courseId);

  return (
    <Suspense fallback={
      <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <Loader2 className="animate-spin" size={40} color="#1B396A" />
        <p style={{ color: "#64748b", fontWeight: "700" }}>Consultando bóveda segura...</p>
      </div>
    }>
      <DriveContent key={reloadKey} resource={resource} courseId={courseId} onRetry={onReload} />
    </Suspense>
  );
}
