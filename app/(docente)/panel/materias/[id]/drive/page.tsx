"use client";

import React, { useState, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  UploadCloud, FileText, Video, FileArchive, FileSpreadsheet, Presentation, Image as ImageIcon,
  ChevronDown, Download, Eye, Sparkles, EyeOff, BookOpen, Loader2, RotateCcw
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useDriveMateria, useDriveMateriaContent, type Archivo } from "./_hooks/useDriveMateria";

const TYPE_ICON: Record<string, React.ElementType> = {
  pdf: FileText, video: Video, sheet: FileSpreadsheet, slide: Presentation, imagen: ImageIcon, doc: FileArchive,
};

// --- TARJETA DE ARCHIVO INTELIGENTE ---
const FileHoverCard = ({ file, onToggleVisibility }: { file: Archivo, onToggleVisibility: (id: string, currentStatus: boolean) => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const Icon = TYPE_ICON[file.tipo] ?? FileArchive;

  const handleToggle = async () => {
    setIsToggling(true);
    await onToggleVisibility(file.id, file.es_visible);
    setIsToggling(false);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white", borderRadius: "20px",
        border: file.es_visible ? "1px solid #e2e8f0" : "1px dashed #cbd5e1",
        boxShadow: isHovered && file.es_visible ? "0 20px 25px -5px rgba(0,0,0,0.1)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden",
        display: "flex", flexDirection: "column", position: "relative",
        opacity: file.es_visible ? 1 : 0.7
      }}
    >
      <div style={{ padding: "20px", display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ backgroundColor: file.es_visible ? "#f8fafc" : "#f1f5f9", padding: "12px", borderRadius: "12px", transition: "all 0.3s" }}>
          <Icon size={28} color={file.es_visible ? "#3b82f6" : "#94a3b8"} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ margin: "0 0 6px 0", color: file.es_visible ? "#1B396A" : "#64748b", fontSize: "1rem", fontWeight: "800", lineHeight: "1.3", wordBreak: "break-word" }}>
              {file.nombre}
            </h3>
            <ChevronDown size={20} color={isHovered ? "#1B396A" : "#cbd5e1"} style={{ transition: "transform 0.4s", transform: isHovered ? "rotate(180deg)" : "rotate(0)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {file.size && <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: "600" }}>{file.size}</span>}
            {file.ai && (
              <span style={{ backgroundColor: "#f3f0ff", color: "#7c3aed", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "6px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                <Sparkles size={10}/> IA
              </span>
            )}
            {!file.es_visible && (
              <span style={{ backgroundColor: "#fee2e2", color: "#ef4444", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "6px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                <EyeOff size={10}/> Oculto
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{
        maxHeight: isHovered ? "200px" : "0px", opacity: isHovered ? 1 : 0,
        padding: isHovered ? "0 20px 20px 20px" : "0 20px", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", margin: "4px 0 16px 0" }} />
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleToggle}
            disabled={isToggling}
            style={{
              flex: 1,
              backgroundColor: file.es_visible ? "#fff1f2" : "#ecfdf5",
              color: file.es_visible ? "#e11d48" : "#059669",
              padding: "10px", borderRadius: "10px", fontWeight: "700", fontSize: "0.85rem",
              display: "flex", justifyContent: "center", alignItems: "center", gap: "6px",
              border: `1px solid ${file.es_visible ? '#ffe4e6' : '#d1fae5'}`,
              cursor: isToggling ? "wait" : "pointer",
              transition: "all 0.2s"
            }}
          >
            {file.es_visible ? <EyeOff size={16} /> : <Eye size={16} />}
            {file.es_visible ? "Ocultar" : "Mostrar"}
          </button>

          <a href={file.url} target="_blank" rel="noreferrer" style={{ flex: 1, backgroundColor: "#f8fafc", color: "#1B396A", padding: "10px", borderRadius: "10px", fontWeight: "700", fontSize: "0.85rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", border: "1px solid #e2e8f0", textDecoration: "none" }}>
            <Download size={16} /> Abrir
          </a>
        </div>
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
  } = useDriveMateriaContent(resource, courseId);

  if (!result.ok) return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", textAlign: "center" }}>
      <p style={{ fontWeight: "700", color: "#ef4444" }}>{result.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={40} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Material Didáctico</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Drive inteligente por unidades</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => router.push(`/panel/materias/${courseId}/drive/nuevo`)}
            style={{ backgroundColor: "white", color: "#1B396A", padding: "12px 20px", borderRadius: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", border: "1.5px solid #1B396A", cursor: "pointer" }}
          >
            <Sparkles size={18} /> Crear con IA
          </button>
          <input ref={fileInputRef} type="file" onChange={handleFileSelected} style={{ display: "none" }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedUnitId || uploading}
            title={!selectedUnitId ? "Selecciona una unidad primero" : ""}
            style={{ backgroundColor: !selectedUnitId ? "#cbd5e1" : "#1B396A", color: "white", padding: "12px 20px", borderRadius: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", border: "none", cursor: !selectedUnitId || uploading ? "not-allowed" : "pointer", transition: "transform 0.2s" }}
            onMouseEnter={(e) => { if (selectedUnitId && !uploading) e.currentTarget.style.transform = "scale(1.05)"; }}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            {uploading ? "Subiendo..." : "Subir Material"}
          </button>
        </div>
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
          <p style={{ color: "#64748b" }}>Para ver y subir su material.</p>
        </div>
      ) : (
        <div style={{ animation: "fadeIn 0.5s ease-out" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
            <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>U{selectedUnit?.unit_number}</span>
            <h2 style={{ fontSize: "1.4rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{selectedUnit?.title}</h2>
          </div>

          {unitFiles.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px", alignItems: "start" }}>
              {unitFiles.map(file => (
                <FileHoverCard key={file.id} file={file} onToggleVisibility={toggleVisibility} />
              ))}
            </div>
          ) : (
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", fontStyle: "italic" }}>Esta unidad no tiene material todavía.</p>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

export default function DrivePage() {
  const { id: courseId } = useParams() as { id: string };
  const { resource, reloadKey, onReload } = useDriveMateria(courseId);

  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>Consultando bóveda segura...</div>}>
      <DriveContent key={reloadKey} resource={resource} courseId={courseId} onRetry={onReload} />
    </Suspense>
  );
}
