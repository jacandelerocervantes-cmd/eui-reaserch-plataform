"use client";

import { useRouter } from "next/navigation";
import { MapPin, Plus, Loader2, RefreshCw, Calendar, Radio, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import NuevaMisionModal from "./_components/NuevaMisionModal";
import { STATUS_COLOR, STATUS_BG } from "./_components/types";
import { useCampo } from "./_hooks/useCampo";

export default function CampoHub() {
  const router = useRouter();
  const c = useCampo();

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <span style={{ backgroundColor: "#ffedd5", color: "#c2410c", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Mundo Terracota</span>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>Trabajo de Campo</h1>
          <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>{c.misiones.length} misiones · {c.activas} activas</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {c.pendingSync > 0 && (
            <ExpandingButton icon={RefreshCw} label={`${c.pendingSync} pendientes`} onClick={() => router.push('/campo/sincronizar')} size={48} radius={14} gap={8} padding="0 20px" fontWeight={800} durationMs={300} colors={{ bg: "#fff7ed", hoverBg: "#fed7aa", text: "#c2410c", hoverText: "#c2410c", border: "#fed7aa" }} />
          )}
          <ExpandingButton icon={Plus} label="Nueva Misión" onClick={() => c.setShowModal(true)} variant="primary" size={48} radius={14} gap={10} padding="0 24px" fontWeight={900} durationMs={300} />
        </div>
      </header>

      {c.loadError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {c.loadError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={c.fetchAll} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        {[null, 'planificada', 'activa', 'completada'].map(s => (
          <button key={s ?? 'todas'} onClick={() => c.setActiveFilter(s)}
            style={{ padding: "8px 16px", borderRadius: "10px", border: "none", fontWeight: "800", fontSize: "0.85rem", cursor: "pointer", backgroundColor: c.activeFilter === s ? "#1B396A" : "white", color: c.activeFilter === s ? "white" : "#64748b", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
            {s === null ? 'Todas' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {c.loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : c.filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "1px dashed #cbd5e1" }}>
          <MapPin size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#64748b" }}>{c.misiones.length === 0 ? 'Sin misiones de campo' : 'Sin misiones con este filtro'}</h3>
          {c.misiones.length === 0 && <div style={{ display: "flex", justifyContent: "center", marginTop: "12px" }}><ExpandingButton icon={Plus} label="Crear primera misión" onClick={() => c.setShowModal(true)} variant="primary" size={44} radius={12} gap={10} padding="0 20px" fontWeight={800} durationMs={300} /></div>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
          {c.filtered.map(m => {
            const color = STATUS_COLOR[m.status];
            return (
              <div key={m.id} onClick={() => router.push(`/campo/misiones/${m.id}`)}
                style={{ backgroundColor: "white", borderRadius: "20px", border: `1px solid ${color}30`, padding: "24px", cursor: "pointer", transition: "all 0.2s", display: "flex", flexDirection: "column", gap: "12px" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 12px 24px -5px ${color}20`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "900", fontSize: "1rem", lineHeight: 1.3, flex: 1 }}>{m.titulo}</h3>
                  <span style={{ backgroundColor: STATUS_BG[m.status], color, padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.7rem", textTransform: "uppercase", flexShrink: 0, marginLeft: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                    {m.status === 'activa' && <Radio size={10} />} {m.status}
                  </span>
                </div>
                {m.objetivo && <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>{m.objetivo.slice(0, 100)}{m.objetivo.length > 100 ? '...' : ''}</p>}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                  {m.latitud && <span style={{ fontSize: "0.75rem", color: "#94a3b8", backgroundColor: "#f8fafc", padding: "3px 8px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}><MapPin size={10} /> {m.latitud.toFixed(3)}, {m.longitud?.toFixed(3)}</span>}
                  {m.radio_metros && <span style={{ fontSize: "0.75rem", color: "#94a3b8", backgroundColor: "#f8fafc", padding: "3px 8px", borderRadius: "6px" }}>R: {m.radio_metros}m</span>}
                  {m.fecha_inicio && <span style={{ fontSize: "0.75rem", color: "#94a3b8", backgroundColor: "#f8fafc", padding: "3px 8px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}><Calendar size={10} /> {new Date(m.fecha_inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <ExpandingButton icon={MapPin} label="Captura Rápida" onClick={() => router.push('/campo/captura')} size={56} radius={16} gap={8} padding="0 20px" fontWeight={800} fontSize="0.95rem" durationMs={300} fullWidth colors={{ bg: "#fff7ed", hoverBg: "#fed7aa", text: "#c2410c", hoverText: "#c2410c", border: "#fb923c30" }} />
        </div>
        <div style={{ flex: 1 }}>
          <ExpandingButton icon={RefreshCw} label={`Sincronizar Capturas${c.pendingSync > 0 ? ` (${c.pendingSync})` : ''}`} onClick={() => router.push('/campo/sincronizar')} size={56} radius={16} gap={8} padding="0 20px" fontWeight={800} fontSize="0.95rem" durationMs={300} fullWidth colors={{ bg: "#ecfdf5", hoverBg: "#a7f3d0", text: "#059669", hoverText: "#059669", border: "#10b98130" }} />
        </div>
      </div>

      {c.showModal && <NuevaMisionModal onClose={() => c.setShowModal(false)} onSave={c.handleCreate} error={c.createError} />}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
