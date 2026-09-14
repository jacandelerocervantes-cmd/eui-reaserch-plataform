"use client";

import React, { useState } from "react";
import { Wrench, Plus, Loader2, X, QrCode, CheckCircle2, AlertTriangle, Clock, RotateCcw } from "lucide-react";
import QRCode from "react-qr-code";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useEquipoLaboratorio, type Equipo, type EquipoForm, type EquipoPayload } from "./_hooks/useEquipoLaboratorio";

const ESTADO_COLOR: Record<string, string> = { disponible: '#10b981', en_uso: '#3b82f6', mantenimiento: '#f59e0b', dado_de_baja: '#ef4444' };
const ESTADO_BG: Record<string, string> = { disponible: '#ecfdf5', en_uso: '#eff6ff', mantenimiento: '#fffbeb', dado_de_baja: '#fef2f2' };
const ACCIONES = [{ key: 'checkout', label: 'Checkout', color: '#3b82f6' }, { key: 'checkin', label: 'Checkin', color: '#10b981' }, { key: 'mantenimiento', label: 'Mantenimiento', color: '#f59e0b' }, { key: 'calibracion', label: 'Calibración', color: '#8b5cf6' }];

const Modal = ({ onClose, onSave, error }: { onClose: () => void; onSave: (d: EquipoPayload) => void; error: string | null }) => {
  const [form, setForm] = useState<EquipoForm>({ nombre: '', tipo: '', modelo: '', numero_serie: '', ubicacion: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof EquipoForm, v: string) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await onSave({ ...form, estado: 'disponible', modelo: form.modelo || null, numero_serie: form.numero_serie || null, ubicacion: form.ubicacion || null });
    setSaving(false);
  };
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "500px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ color: "#1B396A", fontSize: "1.4rem", fontWeight: "900", margin: 0 }}>Registrar Equipo</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={24} /></button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}
          {([['nombre', 'Nombre *', true], ['tipo', 'Tipo *', true], ['modelo', 'Modelo', false], ['numero_serie', 'Número de serie', false], ['ubicacion', 'Ubicación en laboratorio', false]] as [keyof EquipoForm, string, boolean][]).map(([k, label, req]) => (
            <div key={k}>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>{label}</label>
              <input required={req} value={form[k]} onChange={e => set(k, e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#8b5cf6"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          ))}
          <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
            <div style={{ flex: 1 }}>
              <ExpandingButton label="Cancelar" onClick={onClose} type="button" variant="cancel" fullWidth size={44} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
            </div>
            <div style={{ flex: 2 }}>
              <ExpandingButton label="Registrar equipo" loading={saving} loadingLabel="Guardando..." type="submit" disabled={saving} expanded fullWidth size={44} radius={12} gap={8} padding="0 16px" fontWeight={900} durationMs={300} />
            </div>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

const QRModal = ({ equipo, onClose }: { equipo: Equipo; onClose: () => void }) => (
  <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
    <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "32px", textAlign: "center", width: "340px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "900" }}>Código QR</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20} /></button>
      </div>
      <div style={{ backgroundColor: "white", padding: "16px", display: "inline-block", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
        <QRCode value={equipo.qr_code ?? equipo.id} size={180} />
      </div>
      <p style={{ margin: "0 0 4px 0", fontWeight: "900", color: "#1B396A" }}>{equipo.nombre}</p>
      {equipo.numero_serie && <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem", fontFamily: "monospace" }}>S/N: {equipo.numero_serie}</p>}
    </div>
  </div>
);

export default function EquipoLaboratorio() {
  const {
    equipos,
    loading,
    loadError,
    showModal, setShowModal,
    qrEquipo, setQrEquipo,
    actionLoading,
    actionError,
    createError,
    fetchAll,
    handleCreate,
    handleAction,
    calibVencida,
  } = useEquipoLaboratorio();

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <div>
          <span style={{ backgroundColor: "#ede9fe", color: "#7c3aed", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Laboratorio</span>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>Inventario de Equipo</h1>
          <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>{equipos.length} equipo{equipos.length !== 1 ? 's' : ''} · Checkout/checkin y calibración</p>
        </div>
        <ExpandingButton icon={Plus} label="Registrar Equipo" onClick={() => setShowModal(true)} variant="primary" size={48} radius={14} gap={10} padding="0 24px" fontWeight={900} durationMs={300} />
      </header>

      {loadError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {loadError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={fetchAll} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      {actionError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem" }}>
          {actionError}
        </div>
      )}

      {/* Status summary */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {Object.entries(ESTADO_COLOR).map(([estado, color]) => {
          const count = equipos.filter(e => e.estado === estado).length;
          return (
            <div key={estado} style={{ backgroundColor: ESTADO_BG[estado], padding: "10px 20px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: color }} />
              <span style={{ fontWeight: "800", color, fontSize: "0.85rem", textTransform: "capitalize" }}>{estado.replace('_', ' ')}</span>
              <span style={{ fontWeight: "900", color, fontSize: "1.1rem" }}>{count}</span>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : equipos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "1px dashed #cbd5e1" }}>
          <Wrench size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#64748b" }}>Sin equipo registrado</h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem" }}>Registra el equipo de laboratorio para hacer checkout, checkin y calibración</p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ExpandingButton icon={Plus} label="Registrar primer equipo" onClick={() => setShowModal(true)} variant="primary" size={44} radius={12} gap={10} padding="0 20px" fontWeight={800} durationMs={300} />
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
          {equipos.map(eq => {
            const color = ESTADO_COLOR[eq.estado];
            const vencida = calibVencida(eq);
            return (
              <div key={eq.id} style={{ backgroundColor: "white", borderRadius: "20px", border: `1px solid ${color}30`, padding: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: vencida ? `0 0 0 2px #ef444440` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 4px 0", color: "#1B396A", fontWeight: "900", fontSize: "1.05rem" }}>{eq.nombre}</h3>
                    <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>{eq.tipo}{eq.modelo ? ` · ${eq.modelo}` : ''}</p>
                    {eq.ubicacion && <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "0.8rem" }}>📍 {eq.ubicacion}</p>}
                    {eq.numero_serie && <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>S/N: {eq.numero_serie}</p>}
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    <button onClick={() => setQrEquipo(eq)} style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: "6px", borderRadius: "8px", cursor: "pointer", color: "#64748b" }}>
                      <QrCode size={16} />
                    </button>
                    <span style={{ backgroundColor: ESTADO_BG[eq.estado], color, padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "capitalize" }}>
                      {eq.estado.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.8rem" }}>
                  {eq.ultima_calibracion && (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", color: "#64748b" }}>
                      <CheckCircle2 size={12} color="#10b981" />
                      Última calibración: {new Date(eq.ultima_calibracion).toLocaleDateString('es-MX')}
                    </div>
                  )}
                  {eq.proxima_calibracion && (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", color: vencida ? "#ef4444" : "#64748b" }}>
                      {vencida ? <AlertTriangle size={12} color="#ef4444" /> : <Clock size={12} />}
                      {vencida ? 'Calibración vencida: ' : 'Próxima calibración: '}{new Date(eq.proxima_calibracion).toLocaleDateString('es-MX')}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {ACCIONES.map(a => {
                    const loadKey = `${eq.id}-${a.key}`;
                    return (
                      <ExpandingButton
                        key={a.key}
                        label={a.label}
                        loading={actionLoading === loadKey}
                        loadingLabel={a.label}
                        onClick={() => handleAction(eq, a.key)}
                        expanded
                        small smallSize={26}
                        radius={8}
                        gap={4}
                        padding="0 12px"
                        fontWeight={800}
                        fontSize="0.78rem"
                        durationMs={300}
                        colors={{ bg: `${a.color}10`, hoverBg: `${a.color}20`, text: a.color, hoverText: a.color, border: `${a.color}40` }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <Modal onClose={() => setShowModal(false)} onSave={handleCreate} error={createError} />}
      {qrEquipo && <QRModal equipo={qrEquipo} onClose={() => setQrEquipo(null)} />}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
