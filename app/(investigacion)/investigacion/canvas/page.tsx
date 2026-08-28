"use client";

import {
  Sparkles, Quote, CheckCircle2,
  Wand2, History, MessageSquare, Loader2,
  Search, Plus, Database, Save, AlertTriangle
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useCanvasRedaccion } from "./_hooks/useCanvasRedaccion";

export default function CanvasRedaccion() {
  const c = useCanvasRedaccion();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 370px", height: "calc(100vh)", backgroundColor: "white", overflow: "hidden" }}>

      {/* EDITOR */}
      <section style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #e2e8f0", backgroundColor: "#fcfcfd" }}>
        <div style={{ padding: "12px 32px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "white" }}>
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "3px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "1px" }}>Canvas AI · Mundo Dorado</span>
            <span style={{ fontSize: "0.72rem", color: c.saveStatus === 'error' ? '#dc2626' : c.saveStatus === 'guardando' ? '#d97706' : '#94a3b8', fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
              {c.saveStatus === 'guardando' && <Loader2 size={11} className="animate-spin" />}
              {c.saveStatus === 'guardado' && <CheckCircle2 size={11} />}
              {c.saveLabel}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button title="Historial" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "6px", borderRadius: "8px" }}><History size={17} /></button>
            <ExpandingButton icon={Save} label="Guardar" onClick={() => c.autoSave(c.titulo, c.contenido)} expanded small smallSize={30} radius={10} gap={5} padding="0 14px" fontWeight={700} fontSize="0.8rem" durationMs={300} />
          </div>
        </div>

        {c.loadError && (
          <div style={{ margin: "16px 32px 0", backgroundColor: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: "10px 16px", borderRadius: "10px", fontWeight: "600", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={14} /> {c.loadError}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "48px 72px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: "740px", backgroundColor: "white", padding: "56px 64px", boxShadow: "0 4px 24px rgba(0,0,0,0.04)", minHeight: "860px", borderRadius: "4px", display: "flex", flexDirection: "column" }}>
            <input value={c.titulo} onChange={e => c.setTitulo(e.target.value)} placeholder="Título del artículo científico..."
              style={{ fontSize: "2rem", color: "#1B396A", fontWeight: "900", marginBottom: "26px", border: "none", outline: "none", width: "100%", fontFamily: "inherit", letterSpacing: "-0.01em" }} />
            <textarea value={c.contenido} onChange={e => c.setContenido(e.target.value)}
              placeholder="Escribe aquí tu investigación. El asistente IA puede generar continuaciones y revisar el rigor académico."
              style={{ flex: 1, color: "#475569", lineHeight: "1.85", fontSize: "1.05rem", border: "none", outline: "none", resize: "none", width: "100%", fontFamily: "inherit", minHeight: "580px" }} />
          </div>
        </div>
      </section>

      {/* COPILOTO */}
      <aside style={{ display: "flex", flexDirection: "column", backgroundColor: "white" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #f1f5f9" }}>
          {([
            { id: 'copiloto', icon: <Sparkles size={15} />, label: "Asistente" },
            { id: 'citas', icon: <Quote size={15} />, label: "Citas" },
            { id: 'revision', icon: <CheckCircle2 size={15} />, label: "Revisión" },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => c.setActiveTab(tab.id)}
              style={{ flex: 1, padding: "15px 8px", border: "none", backgroundColor: c.activeTab === tab.id ? "white" : "#f8fafc", color: c.activeTab === tab.id ? "#d97706" : "#64748b", fontWeight: "800", fontSize: "0.7rem", cursor: "pointer", borderBottom: c.activeTab === tab.id ? "3px solid #f59e0b" : "3px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", transition: "all 0.2s" }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px", position: "relative" }}>
          {c.isGenerating && (
            <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(255,255,255,0.88)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
              <Loader2 size={26} className="animate-spin" style={{ color: "#d97706" }} />
              <span style={{ fontWeight: "800", color: "#d97706", fontSize: "0.82rem" }}>Gemini 2.5 Flash procesando...</span>
            </div>
          )}

          {c.activeTab === 'copiloto' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div style={{ backgroundColor: "#fffbeb", padding: "16px", borderRadius: "16px", border: "1px solid #fde68a" }}>
                <h3 style={{ color: "#d97706", fontSize: "0.82rem", fontWeight: "900", margin: "0 0 7px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Wand2 size={14} /> Generador de Párrafo
                </h3>
                <p style={{ fontSize: "0.77rem", color: "#92400e", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Gemini generará un párrafo académico coherente con tu texto actual.
                </p>
                <ExpandingButton icon={Sparkles} label="Insertar Continuación" onClick={c.generarParrafo} disabled={c.isGenerating || !c.contenido.trim()} expanded fullWidth size={40} radius={10} gap={6} padding="0 14px" fontWeight={800} fontSize="0.82rem" durationMs={300} colors={{ bg: "#f59e0b", hoverBg: "#d97706", text: "white", hoverText: "white", border: "transparent" }} />
              </div>

              {c.copilotError && (
                <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: "12px", fontSize: "0.78rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle size={13} /> {c.copilotError}
                </div>
              )}

              <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ color: "#1B396A", fontSize: "0.82rem", fontWeight: "900", margin: "0 0 10px" }}>Estado del texto</h3>
                {[
                  { label: "Palabras", val: c.contenido.trim() ? c.contenido.trim().split(/\s+/).length : 0 },
                  { label: "Caracteres", val: c.contenido.length },
                  { label: "Párrafos", val: c.contenido.trim() ? c.contenido.split(/\n\n+/).filter(Boolean).length : 0 },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#64748b", fontWeight: "600", marginBottom: "6px" }}>
                    <span>{s.label}</span>
                    <span style={{ color: "#1B396A", fontWeight: "900" }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c.activeTab === 'citas' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ backgroundColor: "#f8fafc", padding: "13px", borderRadius: "13px", border: "1px solid #e2e8f0" }}>
                <p style={{ fontSize: "0.73rem", color: "#64748b", fontWeight: "700", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "5px" }}><Database size={12} /> Repositorio</p>
                <div style={{ position: "relative" }}>
                  <Search size={12} color="#94a3b8" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" placeholder="Buscar..." style={{ width: "100%", padding: "7px 8px 7px 26px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.75rem", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              {c.citas.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: "0.78rem", fontWeight: "600", textAlign: "center", padding: "16px 0" }}>Sin referencias. Agrégalas en Literatura.</p>
              ) : c.citas.map(ci => (
                <div key={ci.id} style={{ padding: "12px", borderRadius: "12px", border: "1px solid #f1f5f9", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                  <div style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.77rem" }}>({(ci.autores as string)?.split(',')[0]?.trim() ?? 'Autor'}, {ci.año})</div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b", margin: "2px 0", lineHeight: 1.4 }}>{ci.titulo}. <i>{ci.journal}</i></div>
                  <button style={{ color: "#d97706", background: "none", border: "none", fontSize: "0.7rem", fontWeight: "800", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", marginTop: "5px" }}
                    onClick={() => c.setContenido(prev => prev + ` (${(ci.autores as string)?.split(',')[0]?.trim() ?? 'Autor'}, ${ci.año})`)}>
                    <Plus size={10} /> Insertar
                  </button>
                </div>
              ))}
            </div>
          )}

          {c.activeTab === 'revision' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {c.revisionScore === null ? (
                <div style={{ textAlign: "center", padding: "28px 12px" }}>
                  <MessageSquare size={40} color="#cbd5e1" style={{ marginBottom: "12px" }} />
                  <h3 style={{ color: "#1B396A", fontSize: "0.95rem", fontWeight: "900", margin: "0 0 7px" }}>Revisor Académico IA</h3>
                  <p style={{ fontSize: "0.78rem", color: "#64748b", lineHeight: 1.5, margin: "0 0 16px" }}>
                    Gemini evaluará tu manuscrito como revisor de journal Q1 internacional.
                  </p>
                  <ExpandingButton label="Iniciar Auditoría Crítica" onClick={c.iniciarAuditoria} disabled={!c.contenido.trim() || c.isGenerating} expanded fullWidth size={44} radius={12} gap={8} padding="0 16px" fontWeight={800} fontSize="0.85rem" durationMs={300} />
                  {c.copilotError && (
                    <div style={{ marginTop: "12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: "12px", fontSize: "0.78rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" }}>
                    <AlertTriangle size={13} /> {c.copilotError}
                  </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ backgroundColor: c.revisionScore > 70 ? "#ecfdf5" : "#fef2f2", padding: "20px", borderRadius: "16px", border: `1px solid ${c.revisionScore > 70 ? '#a7f3d0' : '#fecaca'}`, textAlign: "center" }}>
                    <div style={{ fontSize: "2.8rem", fontWeight: "950", color: c.revisionScore > 70 ? "#059669" : "#dc2626", lineHeight: 1 }}>{c.revisionScore}</div>
                    <div style={{ fontSize: "0.68rem", fontWeight: "900", color: c.revisionScore > 70 ? "#10b981" : "#ef4444", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>Prob. Aceptación Q1</div>
                  </div>
                  {c.critica && (
                    <div style={{ marginTop: "14px", backgroundColor: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                      <h4 style={{ color: "#1B396A", margin: "0 0 7px", fontSize: "0.78rem", fontWeight: "900", display: "flex", alignItems: "center", gap: "5px" }}><MessageSquare size={13} /> Retroalimentación</h4>
                      <p style={{ color: "#475569", fontSize: "0.76rem", lineHeight: 1.6, margin: 0, fontStyle: "italic", borderLeft: "3px solid #cbd5e1", paddingLeft: "9px" }}>&quot;{c.critica}&quot;</p>
                    </div>
                  )}
                  <div style={{ marginTop: "12px" }}>
                    <ExpandingButton label="Nueva revisión" onClick={() => { c.setRevisionScore(null); c.setCritica(null); }} variant="secondary" expanded fullWidth size={40} radius={12} gap={8} padding="0 16px" fontWeight={700} fontSize="0.8rem" durationMs={300} />
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </aside>
    </div>
  );
}
