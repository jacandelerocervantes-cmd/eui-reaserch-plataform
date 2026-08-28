"use client";

import { Search, Library, Sparkles, Plus, Loader2, BookOpen, ExternalLink, Trash2, AlertCircle, TrendingUp, Users, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useLiteratura } from "./_hooks/useLiteratura";

export default function Literatura() {
  const {
    loading,
    loadError,
    search, setSearch,
    gap,
    gapLoading,
    gapError,
    doiInput, setDoiInput,
    doiLoading,
    doiError,
    deleteId, setDeleteId,
    deleteError,
    doiRef,
    filtered,
    fetchRefs,
    handleImportDOI,
    handleDelete,
    handleGapAnalysis,
    refs,
  } = useLiteratura();

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <header style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Mundo Dorado</span>
        <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>Biblioteca de Referencias</h1>
        <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>{refs.length} referencia{refs.length !== 1 ? 's' : ''} · importa por DOI desde CrossRef</p>
      </header>

      {/* DOI import */}
      <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px" }}>
        <h3 style={{ margin: "0 0 16px 0", color: "#1B396A", fontWeight: "900", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <Plus size={18} color="#f59e0b" /> Importar por DOI
        </h3>
        <form onSubmit={handleImportDOI} style={{ display: "flex", gap: "12px" }}>
          <input ref={doiRef} type="text" placeholder="ej. 10.1038/nature12374 o https://doi.org/..." value={doiInput} onChange={e => setDoiInput(e.target.value)}
            style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", border: `1px solid ${doiError ? '#ef4444' : '#e2e8f0'}`, fontSize: "0.95rem", outline: "none" }}
            onFocus={e => e.target.style.borderColor = "#f59e0b"} onBlur={e => e.target.style.borderColor = doiError ? "#ef4444" : "#e2e8f0"} />
          <ExpandingButton label="Importar" loading={doiLoading} loadingLabel="Importando..." type="submit" disabled={doiLoading || !doiInput.trim()} expanded size={48} radius={12} gap={8} padding="0 24px" fontWeight={800} durationMs={300} />
        </form>
        {doiError && <p style={{ margin: "8px 0 0 0", color: "#ef4444", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}><AlertCircle size={14} /> {doiError}</p>}
      </div>

      {/* Gap analysis */}
      <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: gap ? "20px" : "0" }}>
          <div>
            <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "900", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={18} color="#8b5cf6" /> Análisis de Brechas con IA
            </h3>
            <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "0.8rem" }}>Detecta vacíos teóricos en tu bibliografía actual</p>
          </div>
          <ExpandingButton label="Analizar brechas" loading={gapLoading} loadingLabel="Analizando..." onClick={handleGapAnalysis} disabled={gapLoading || refs.length === 0} expanded size={40} radius={12} gap={8} padding="0 20px" fontWeight={800} durationMs={300} colors={{ bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white", hoverText: "white", border: "transparent" }} />
        </div>

        {gapError && (
          <div style={{ marginTop: "16px", backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.85rem" }}>
            {gapError}
          </div>
        )}

        {gap && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {[
              { title: 'Vacíos Teóricos', items: gap.vacios, color: '#ef4444', icon: AlertCircle },
              { title: 'Tendencias Emergentes', items: gap.tendencias_emergentes, color: '#f59e0b', icon: TrendingUp },
              { title: 'Autores Clave No Citados', items: gap.autores_clave_no_citados, color: '#8b5cf6', icon: Users },
              { title: 'Sugerencias de Búsqueda', items: gap.sugerencias_busqueda, color: '#10b981', icon: Search },
            ].map(({ title, items, color, icon: Icon }) => (
              <div key={title} style={{ backgroundColor: `${color}08`, border: `1px solid ${color}20`, borderRadius: "16px", padding: "16px" }}>
                <h4 style={{ margin: "0 0 12px 0", color, fontSize: "0.85rem", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Icon size={14} /> {title}
                </h4>
                <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(items ?? []).map((item, i) => <li key={i} style={{ fontSize: "0.85rem", color: "#1e293b", lineHeight: 1.4 }}>{item}</li>)}
                </ul>
                {gap.decadas_sin_cobertura?.length > 0 && title === 'Autores Clave No Citados' && (
                  <p style={{ margin: "12px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>Décadas sin cobertura: {gap.decadas_sin_cobertura.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {loadError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {loadError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={fetchRefs} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      {/* Search + list */}
      <div style={{ position: "relative" }}>
        <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
        <input type="text" placeholder="Buscar en mi biblioteca..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "14px 16px 14px 48px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none", boxSizing: "border-box", backgroundColor: "white" }}
          onFocus={e => e.target.style.borderColor = "#f59e0b"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} /> Cargando referencias...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "1px dashed #cbd5e1" }}>
          <Library size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#64748b" }}>{refs.length === 0 ? 'Biblioteca vacía' : 'Sin resultados'}</h3>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>{refs.length === 0 ? 'Importa tu primera referencia con un DOI' : 'Prueba otro término'}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map(ref => (
            <div key={ref.id} style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px", display: "flex", gap: "16px", transition: "box-shadow 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px -2px rgba(0,0,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
              <div style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "10px", borderRadius: "12px", height: "fit-content", flexShrink: 0 }}>
                <BookOpen size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: "0 0 4px 0", color: "#1B396A", fontWeight: "800", fontSize: "0.95rem", lineHeight: 1.4 }}>{ref.titulo}</h4>
                <p style={{ margin: "0 0 6px 0", color: "#64748b", fontSize: "0.8rem" }}>
                  {(ref.autores ?? []).slice(0, 4).join(', ')}{(ref.autores?.length ?? 0) > 4 ? ' ...' : ''}
                  {ref.año ? ` · ${ref.año}` : ''}
                  {ref.journal ? ` · ${ref.journal}` : ''}
                </p>
                {ref.abstract && <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.78rem", lineHeight: 1.5 }}>{ref.abstract.slice(0, 180)}...</p>}
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  {ref.doi && <span style={{ fontSize: "0.75rem", color: "#64748b", backgroundColor: "#f8fafc", padding: "2px 8px", borderRadius: "6px", fontFamily: "monospace" }}>DOI: {ref.doi}</span>}
                  {ref.url && <a href={ref.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "#3b82f6", display: "flex", alignItems: "center", gap: "3px", textDecoration: "none", fontWeight: "700" }}><ExternalLink size={11} /> Ver fuente</a>}
                </div>
              </div>
              <button onClick={() => setDeleteId(ref.id)} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", alignSelf: "flex-start", padding: "4px" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1"}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", borderRadius: "20px", padding: "28px", maxWidth: "360px", width: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <h3 style={{ color: "#1B396A", margin: "0 0 12px 0" }}>¿Eliminar referencia?</h3>
            <p style={{ color: "#64748b", margin: "0 0 20px 0", fontSize: "0.9rem" }}>Esta acción no se puede deshacer.</p>
            {deleteError && (
              <div style={{ marginBottom: "16px", backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.82rem" }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <ExpandingButton label="Cancelar" onClick={() => setDeleteId(null)} variant="cancel" fullWidth size={44} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
              </div>
              <div style={{ flex: 1 }}>
                <ExpandingButton label="Eliminar" onClick={() => handleDelete(deleteId)} expanded fullWidth size={44} radius={10} gap={8} padding="0 16px" fontWeight={800} durationMs={300} colors={{ bg: "#ef4444", hoverBg: "#dc2626", text: "white", hoverText: "white", border: "transparent" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
