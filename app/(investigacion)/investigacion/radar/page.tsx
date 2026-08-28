"use client";

import { Search, BookOpen, Award, ExternalLink, BookMarked, Check, Globe, Filter, AlertTriangle } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useRadarAcademico } from "./_hooks/useRadarAcademico";

export default function RadarAcademico() {
  const c = useRadarAcademico();

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <header style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Mundo Dorado</span>
        <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>Radar Académico</h1>
        <p style={{ color: "#64748b", fontSize: "1rem", fontWeight: "500", margin: 0 }}>Búsqueda en OpenAlex · Semantic Scholar · +220M publicaciones científicas</p>
      </header>

      <form onSubmit={c.handleSearch} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={22} color="#94a3b8" style={{ position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)" }} />
            <input type="text" value={c.query} onChange={e => c.setQuery(e.target.value)} placeholder="Buscar por tema, autor, journal..."
              style={{ width: "100%", padding: "18px 20px 18px 56px", borderRadius: "16px", border: "2px solid #e2e8f0", fontSize: "1.1rem", outline: "none", boxSizing: "border-box", color: "#1B396A", fontWeight: "600" }}
              onFocus={e => e.target.style.borderColor = "#f59e0b"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
          </div>
          <ExpandingButton icon={Search} label="Buscar" loading={c.isSearching} loadingLabel="Buscando..." type="submit" disabled={c.isSearching || !c.query.trim()} expanded size={56} radius={16} gap={10} padding="0 32px" fontWeight={900} fontSize="1rem" durationMs={300} />
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <Filter size={16} color="#94a3b8" />
          {[{ label: 'Cualquier época', val: 0 }, { label: 'Últimos 5 años', val: 5 }, { label: 'Últimos 10 años', val: 10 }].map(opt => (
            <button key={opt.val} type="button" onClick={() => c.setFilters(f => ({ ...f, years: opt.val }))}
              style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer", borderColor: c.filters.years === opt.val ? "#1B396A" : "#e2e8f0", backgroundColor: c.filters.years === opt.val ? "#1B396A" : "white", color: c.filters.years === opt.val ? "white" : "#64748b" }}>
              {opt.label}
            </button>
          ))}
          <button type="button" onClick={() => c.setFilters(f => ({ ...f, open_access: !f.open_access }))}
            style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer", borderColor: c.filters.open_access ? "#10b981" : "#e2e8f0", backgroundColor: c.filters.open_access ? "#ecfdf5" : "white", color: c.filters.open_access ? "#059669" : "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
            <Globe size={14} /> Acceso Abierto
          </button>
        </div>
      </form>

      {c.searchError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={16} /> {c.searchError}
        </div>
      )}

      {c.saveError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={16} /> {c.saveError}
        </div>
      )}

      {c.searchDone && (
        <p style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: "600", margin: 0 }}>
          {c.results.length} resultados de ~{c.total.toLocaleString()} encontrados · {c.tookMs}ms
        </p>
      )}

      {!c.searchDone && !c.isSearching && (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#94a3b8" }}>
          <BookOpen size={64} style={{ marginBottom: "20px", opacity: 0.2 }} />
          <p style={{ fontWeight: "600", fontSize: "1.1rem", margin: 0 }}>Escribe un término para explorar la literatura científica</p>
          <p style={{ margin: "8px 0 0 0", fontSize: "0.9rem" }}>ej. &quot;machine learning agriculture&quot;, &quot;Nature Climate Change&quot;</p>
        </div>
      )}

      {c.isSearching && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px" }}>
              <div style={{ height: "20px", backgroundColor: "#f1f5f9", borderRadius: "8px", marginBottom: "12px", width: "80%", animation: "pulse 1.5s infinite" }} />
              <div style={{ height: "14px", backgroundColor: "#f1f5f9", borderRadius: "6px", marginBottom: "8px", width: "50%", animation: "pulse 1.5s infinite" }} />
              <div style={{ height: "14px", backgroundColor: "#f1f5f9", borderRadius: "6px", width: "30%", animation: "pulse 1.5s infinite" }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {c.results.map(paper => {
          const saved = c.savedIds.has(paper.id);
          const saving = c.savingId === paper.id;
          return (
            <div key={paper.id} style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px", transition: "box-shadow 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 8px 20px -5px rgba(0,0,0,0.1)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "20px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                    {paper.year && <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", backgroundColor: "#f8fafc", padding: "3px 8px", borderRadius: "6px" }}>{paper.year}</span>}
                    {paper.is_oa && <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#059669", backgroundColor: "#ecfdf5", padding: "3px 8px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}><Globe size={10} /> Open Access</span>}
                    {paper.venue && <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>{paper.venue}</span>}
                  </div>
                  <h3 style={{ margin: "0 0 8px 0", color: "#1B396A", fontSize: "1rem", fontWeight: "800", lineHeight: 1.4 }}>{paper.title}</h3>
                  <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "0.85rem" }}>{paper.authors.slice(0, 5).join(', ')}{paper.authors.length > 5 ? ` +${paper.authors.length - 5} más` : ''}</p>
                  {paper.abstract && <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.8rem", lineHeight: 1.5 }}>{paper.abstract.slice(0, 200)}...</p>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f59e0b", backgroundColor: "#fffbeb", padding: "6px 12px", borderRadius: "10px" }}>
                    <Award size={14} />
                    <span style={{ fontWeight: "900", fontSize: "0.9rem" }}>{paper.citations.toLocaleString()}</span>
                    <span style={{ fontSize: "0.75rem", color: "#d97706" }}>citas</span>
                  </div>
                  {paper.url && (
                    <a href={paper.url} target="_blank" rel="noreferrer" style={{ color: "#64748b", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", fontWeight: "700", textDecoration: "none" }}>
                      <ExternalLink size={14} /> Ver paper
                    </a>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
                <ExpandingButton icon={BookOpen} label="Copiar BibTeX" onClick={() => c.copyBibtex(paper)} variant="secondary" expanded small smallSize={34} radius={10} gap={6} padding="0 16px" fontWeight={700} fontSize="0.85rem" durationMs={300} />
                <ExpandingButton
                  icon={saved ? Check : BookMarked}
                  label={saved ? "Guardado" : "Guardar en Literatura"}
                  loading={saving}
                  loadingLabel="Guardando..."
                  onClick={() => !saved && !saving && c.handleSave(paper)}
                  disabled={saved || saving}
                  expanded
                  small smallSize={34}
                  radius={10}
                  gap={6}
                  padding="0 16px"
                  fontWeight={800}
                  fontSize="0.85rem"
                  durationMs={300}
                  colors={saved ? { bg: "#ecfdf5", hoverBg: "#ecfdf5", text: "#059669", hoverText: "#059669", border: "transparent" } : { bg: "#1B396A", hoverBg: "#152c54", text: "white", hoverText: "white", border: "transparent" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
