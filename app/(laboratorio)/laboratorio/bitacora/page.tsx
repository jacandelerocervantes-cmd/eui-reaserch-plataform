"use client";

import { ClipboardList, Plus, Loader2, Sparkles, Image as ImageIcon, X, ChevronDown, ChevronUp, Microscope, RotateCcw } from "lucide-react";
import NextImage from "next/image";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useBitacoraLaboratorio, type Entidades, type EntidadItem } from "./_hooks/useBitacoraLaboratorio";

const EntidadesView = ({ e }: { e: Entidades | undefined }) => {
  if (!e) return null;
  const sections = [
    { key: 'muestras', label: 'Muestras', color: '#3b82f6' },
    { key: 'reactivos', label: 'Reactivos', color: '#8b5cf6' },
    { key: 'parametros', label: 'Parámetros', color: '#f59e0b' },
    { key: 'observaciones', label: 'Observaciones', color: '#10b981' },
    { key: 'proximos_pasos', label: 'Próximos Pasos', color: '#06b6d4' },
    { key: 'posibles_errores', label: 'Posibles Errores', color: '#ef4444' },
  ] as const;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
      {sections.map(({ key, label, color }) => {
        const items: EntidadItem[] = e[key] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={key} style={{ backgroundColor: `${color}08`, border: `1px solid ${color}20`, borderRadius: "10px", padding: "10px" }}>
            <p style={{ margin: "0 0 6px 0", fontSize: "0.7rem", fontWeight: "900", color, textTransform: "uppercase" }}>{label}</p>
            {items.map((it, i) => (
              <p key={i} style={{ margin: "2px 0", fontSize: "0.8rem", color: "#1e293b" }}>
                {typeof it === 'object' ? `${it.nombre}: ${it.valor}${it.unidad ? ' ' + it.unidad : ''}` : it}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default function Bitacora() {
  const {
    entradas,
    loading,
    loadError,
    showForm, setShowForm,
    form, setForm,
    photoFile, setPhotoFile,
    saving,
    saveError,
    analyzing,
    analyzeError,
    expanded,
    photoRef,
    fetchAll,
    handleSave,
    handleAnalyze,
    toggleExpand,
  } = useBitacoraLaboratorio();

  return (
    <div style={{ padding: "40px", maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <span style={{ backgroundColor: "#ede9fe", color: "#7c3aed", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Laboratorio</span>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>Bitácora ELN</h1>
          <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>{entradas.length} entrada{entradas.length !== 1 ? 's' : ''} · Extracción de entidades con IA</p>
        </div>
        <ExpandingButton
          icon={showForm ? X : Plus}
          label={showForm ? "Cancelar" : "Nueva Entrada"}
          onClick={() => setShowForm(s => !s)}
          expanded
          size={48} radius={14} gap={10} padding="0 24px" fontWeight={900} durationMs={300}
          colors={showForm ? { bg: "#f1f5f9", hoverBg: "#e2e8f0", text: "#64748b", hoverText: "#64748b", border: "transparent" } : { bg: "#1B396A", hoverBg: "#152c54", text: "white", hoverText: "white", border: "transparent" }}
        />
      </header>

      {loadError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {loadError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={fetchAll} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      {analyzeError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem" }}>
          {analyzeError}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {saveError && (
            <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.85rem" }}>
              {saveError}
            </div>
          )}
          <input type="text" placeholder="Título del experimento *" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required
            style={{ padding: "14px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none", fontWeight: "600" }}
            onFocus={e => e.target.style.borderColor = "#8b5cf6"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          <textarea placeholder="Describe el procedimiento, materiales, observaciones y resultados..." value={form.contenido} onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))} required rows={8}
            style={{ padding: "14px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
            onFocus={e => e.target.style.borderColor = "#8b5cf6"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <input ref={photoRef} type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
            <button type="button" onClick={() => photoRef.current?.click()}
              style={{ padding: "10px 16px", borderRadius: "10px", border: "1px dashed #cbd5e1", backgroundColor: "white", color: "#64748b", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}>
              <ImageIcon size={16} /> {photoFile ? photoFile.name : 'Adjuntar foto'}
            </button>
            {photoFile && <button type="button" onClick={() => setPhotoFile(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={16} /></button>}
            <div style={{ marginLeft: "auto" }}>
              <ExpandingButton label="Guardar entrada" loading={saving} loadingLabel="Guardando..." type="submit" disabled={saving} expanded size={44} radius={12} gap={8} padding="0 28px" fontWeight={800} durationMs={300} colors={{ bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white", hoverText: "white", border: "transparent" }} />
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : entradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "1px dashed #cbd5e1" }}>
          <ClipboardList size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#64748b" }}>Bitácora vacía</h3>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>Registra tu primer experimento</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {entradas.map(en => {
            const isExpanded = expanded.has(en.id);
            return (
              <div key={en.id} style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", overflow: "hidden", transition: "box-shadow 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px -2px rgba(0,0,0,0.08)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <Microscope size={16} color="#8b5cf6" />
                        <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "900", fontSize: "1rem" }}>{en.titulo}</h3>
                      </div>
                      <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.78rem" }}>
                        {new Date(en.created_at).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <ExpandingButton
                        icon={Sparkles}
                        label={en.entidades ? 'Re-analizar' : 'Analizar'}
                        loading={analyzing === en.id}
                        onClick={() => handleAnalyze(en.id, en.contenido)}
                        expanded
                        small smallSize={26}
                        radius={8}
                        gap={4}
                        padding="0 12px"
                        fontWeight={700}
                        fontSize="0.8rem"
                        durationMs={300}
                        colors={en.entidades
                          ? { bg: "#ede9fe", hoverBg: "#ddd6fe", text: "#7c3aed", hoverText: "#7c3aed", border: "transparent" }
                          : { bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white", hoverText: "white", border: "transparent" }}
                      />
                      <button onClick={() => toggleExpand(en.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>
                  </div>

                  {!isExpanded && (
                    <p style={{ margin: "12px 0 0 0", color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>
                      {en.contenido.slice(0, 200)}{en.contenido.length > 200 ? '...' : ''}
                    </p>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "1px solid #f1f5f9", padding: "20px 24px" }}>
                    <p style={{ margin: "0 0 12px 0", color: "#1e293b", fontSize: "0.9rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{en.contenido}</p>
                    {en.foto_url && (
                      <NextImage src={en.foto_url} alt="Foto experimento" width={400} height={300} unoptimized style={{ maxWidth: "400px", width: "100%", height: "auto", borderRadius: "12px", marginBottom: "12px", border: "1px solid #e2e8f0" }} />
                    )}
                    <EntidadesView e={en.entidades} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
