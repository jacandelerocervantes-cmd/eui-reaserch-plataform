"use client";

import { DollarSign, Plus, Loader2, Sparkles, TrendingUp, TrendingDown, AlertCircle, FileText, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import NuevoMovimientoModal from "./_components/NuevoMovimientoModal";
import { useFinanciamiento } from "./_hooks/useFinanciamiento";

export default function Financiamiento() {
  const f = useFinanciamiento();

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Mundo Dorado</span>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>Financiamiento</h1>
          <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>Gestión de fondos y presupuesto de investigación</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={FileText} label="Informe IA" loading={f.reportLoading} loadingLabel="Generando..." onClick={f.handleReport} disabled={f.reportLoading || f.fondos.length === 0} expanded size={48} radius={14} gap={8} padding="0 20px" fontWeight={800} durationMs={300} colors={{ bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white", hoverText: "white", border: "transparent" }} />
          <ExpandingButton icon={Plus} label="Nuevo Movimiento" onClick={() => f.setShowModal(true)} variant="primary" size={48} radius={14} gap={8} padding="0 24px" fontWeight={900} durationMs={300} />
        </div>
      </header>

      {f.loadError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {f.loadError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={f.fetchAll} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      {f.reportError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem" }}>
          {f.reportError}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px" }}>
        {[
          { label: 'Total Entradas', value: f.totalEntradas, color: '#10b981', bg: '#ecfdf5', Icon: TrendingUp },
          { label: 'Total Gastos', value: f.totalGastos, color: '#ef4444', bg: '#fef2f2', Icon: TrendingDown },
          { label: 'Saldo Disponible', value: f.saldo, color: f.saldo >= 0 ? '#3b82f6' : '#ef4444', bg: f.saldo >= 0 ? '#eff6ff' : '#fef2f2', Icon: DollarSign },
        ].map(({ label, value, color, bg, Icon }) => (
          <div key={label} style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ backgroundColor: bg, color, padding: "14px", borderRadius: "14px" }}><Icon size={24} /></div>
            <div>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.75rem", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>{label}</p>
              <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: "900", color }}>{f.fmt(value)}</p>
            </div>
          </div>
        ))}
      </div>

      {f.venciendo.length > 0 && (
        <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "16px", padding: "16px 20px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <AlertCircle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <p style={{ margin: "0 0 4px 0", fontWeight: "900", color: "#92400e", fontSize: "0.9rem" }}>Fondos próximos a vencer (30 días)</p>
            {f.venciendo.map(fo => <p key={fo.id} style={{ margin: "2px 0", color: "#b45309", fontSize: "0.85rem" }}>• {fo.nombre} — vence {new Date(fo.fecha_fin!).toLocaleDateString('es-MX')}</p>)}
          </div>
        </div>
      )}

      {f.report && (
        <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "28px" }}>
          <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontWeight: "900", display: "flex", alignItems: "center", gap: "8px" }}><Sparkles size={20} color="#8b5cf6" /> Informe Financiero IA</h3>
          <p style={{ margin: "0 0 20px 0", color: "#1e293b", lineHeight: 1.6, fontSize: "0.95rem" }}>{f.report.resumen_ejecutivo}</p>
          {f.report.alertas?.length > 0 && (
            <div style={{ backgroundColor: "#fef2f2", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: "900", color: "#ef4444", fontSize: "0.8rem", textTransform: "uppercase" }}>Alertas</p>
              {f.report.alertas.map((a, i) => <p key={i} style={{ margin: "4px 0", color: "#b91c1c", fontSize: "0.85rem" }}>⚠ {a}</p>)}
            </div>
          )}
          {f.report.recomendaciones?.length > 0 && (
            <div style={{ backgroundColor: "#ecfdf5", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: "900", color: "#059669", fontSize: "0.8rem", textTransform: "uppercase" }}>Recomendaciones</p>
              {f.report.recomendaciones.map((r, i) => <p key={i} style={{ margin: "4px 0", color: "#065f46", fontSize: "0.85rem" }}>✓ {r}</p>)}
            </div>
          )}
          {f.report.proyeccion && <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem", fontStyle: "italic" }}>{f.report.proyeccion}</p>}
          {f.rawNumbers && <p style={{ margin: "12px 0 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>Burn rate mensual: {f.fmt(f.rawNumbers.burn_rate_mensual ?? 0)}</p>}
        </div>
      )}

      {f.loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : f.fondos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "1px dashed #cbd5e1" }}>
          <DollarSign size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#64748b" }}>Sin movimientos registrados</h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem" }}>Registra tus fondos, becas y gastos de investigación</p>
          <div style={{ display: "flex", justifyContent: "center" }}><ExpandingButton label="Registrar primer movimiento" onClick={() => f.setShowModal(true)} variant="primary" expanded size={44} radius={12} gap={8} padding="0 20px" fontWeight={800} durationMs={300} /></div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {[{ title: 'Entradas', items: f.entradas, color: '#10b981', Icon: TrendingUp }, { title: 'Gastos', items: f.gastos, color: '#ef4444', Icon: TrendingDown }].map(({ title, items, color, Icon }) => (
            <div key={title}>
              <h3 style={{ color: "#1B396A", fontWeight: "900", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon size={18} color={color} /> {title} ({items.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {items.length === 0 ? (
                  <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px dashed #e2e8f0", padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem" }}>Sin {title.toLowerCase()}</div>
                ) : items.map(fo => (
                  <div key={fo.id} style={{ backgroundColor: "white", borderRadius: "16px", border: `1px solid ${color}20`, padding: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: "0 0 4px 0", fontWeight: "800", color: "#1B396A", fontSize: "0.95rem" }}>{fo.nombre}</p>
                        {fo.fuente && <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: "0.8rem" }}>{fo.fuente}</p>}
                        {fo.fecha_fin && <p style={{ margin: 0, color: new Date(fo.fecha_fin) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? '#d97706' : '#94a3b8', fontSize: "0.75rem", fontWeight: "700" }}>Vence: {new Date(fo.fecha_fin).toLocaleDateString('es-MX')}</p>}
                      </div>
                      <span style={{ fontWeight: "900", color, fontSize: "1.1rem", flexShrink: 0 }}>{f.fmt(fo.monto_total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {f.showModal && <NuevoMovimientoModal onClose={() => f.setShowModal(false)} onSave={f.handleCreate} error={f.createError} />}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
