"use client";

import { GraduationCap, Plus, Loader2, Sparkles, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { ETAPAS, ETAPA_LABELS, ETAPA_COLOR } from "./_components/constants";
import { TesistaModal } from "./_components/TesistaModal";
import { FeedbackPanel } from "./_components/FeedbackPanel";
import { useTesistas } from "./_hooks/useTesistas";

export default function MisTesistas() {
  const {
    tesistas, loading, loadError, fetchAll,
    showModal, setShowModal,
    createError,
    feedback, setFeedback,
    feedbackLoading, feedbackError,
    handleCreate,
    handleEtapaChange,
    handleAvanceChange,
    handleGetFeedback,
    activos, graduados,
  } = useTesistas();

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Mundo Dorado</span>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>Mis Tesistas</h1>
          <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>{activos.length} activos · {graduados.length} graduados</p>
        </div>
        <ExpandingButton icon={Plus} label="Registrar Tesista" onClick={() => setShowModal(true)} variant="primary" size={48} radius={14} gap={10} padding="0 24px" fontWeight={900} durationMs={300} />
      </header>

      {loadError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {loadError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={fetchAll} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      {feedbackError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem" }}>
          {feedbackError}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} /> Cargando tesistas...
        </div>
      ) : tesistas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "1px dashed #cbd5e1" }}>
          <GraduationCap size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#64748b" }}>Sin tesistas registrados</h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem" }}>Registra a tus alumnos de tesis para seguir su avance</p>
          <div style={{ display: "flex", justifyContent: "center" }}><ExpandingButton label="Registrar tesista" onClick={() => setShowModal(true)} variant="primary" expanded size={44} radius={12} gap={8} padding="0 20px" fontWeight={800} durationMs={300} /></div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {tesistas.map(t => {
            const color = ETAPA_COLOR[t.etapa] ?? '#94a3b8';
            return (
              <div key={t.id} style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px", display: "flex", gap: "20px", alignItems: "flex-start" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: "#1B396A", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "1.2rem", flexShrink: 0 }}>
                  {t.nombre.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <h3 style={{ margin: "0 0 2px 0", color: "#1B396A", fontWeight: "900", fontSize: "1rem" }}>{t.nombre}</h3>
                      <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: "0.85rem" }}>{t.email}</p>
                      <p style={{ margin: "0 0 12px 0", color: "#1e293b", fontSize: "0.9rem", fontStyle: "italic" }}>{t.titulo_tesis}</p>
                    </div>
                    <span style={{ backgroundColor: `${color}15`, color, padding: "4px 12px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", flexShrink: 0 }}>{ETAPA_LABELS[t.etapa]}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
                    <div style={{ flex: 1, height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${t.avance}%`, height: "100%", backgroundColor: color, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "700", flexShrink: 0 }}>{t.avance}%</span>
                    <input type="range" min="0" max="100" value={t.avance}
                      onChange={e => handleAvanceChange(t.id, Number(e.target.value))}
                      onMouseUp={e => handleAvanceChange(t.id, Number((e.target as HTMLInputElement).value))}
                      style={{ width: "80px", accentColor: color, cursor: "pointer" }} />
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <select value={t.etapa} onChange={e => handleEtapaChange(t.id, e.target.value)}
                      style={{ padding: "7px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.85rem", fontWeight: "600", outline: "none", cursor: "pointer", backgroundColor: "white" }}>
                      {ETAPAS.map(e => <option key={e} value={e}>{ETAPA_LABELS[e]}</option>)}
                    </select>
                    {t.fecha_defensa && (
                      <span style={{ padding: "7px 12px", borderRadius: "10px", backgroundColor: "#fffbeb", color: "#d97706", fontSize: "0.85rem", fontWeight: "700" }}>
                        Defensa: {new Date(t.fecha_defensa).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    <ExpandingButton icon={Sparkles} label="Retroalimentación IA" loading={feedbackLoading === t.id} loadingLabel="Generando..." onClick={() => handleGetFeedback(t.id)} disabled={feedbackLoading === t.id} expanded small smallSize={30} radius={10} gap={6} padding="0 16px" fontWeight={800} fontSize="0.85rem" durationMs={300} colors={{ bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white", hoverText: "white", border: "transparent" }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <TesistaModal onClose={() => setShowModal(false)} onSave={handleCreate} error={createError} />}
      {feedback && <FeedbackPanel fb={feedback} onClose={() => setFeedback(null)} />}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
