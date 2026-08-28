"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { FondoForm, FondoPayload } from "./types";

export default function NuevoMovimientoModal({ onClose, onSave, error }: { onClose: () => void; onSave: (d: FondoPayload) => void; error: string | null }) {
  const [form, setForm] = useState<FondoForm>({ nombre: '', tipo: 'entrada', monto_total: '', fuente: '', fecha_inicio: '', fecha_fin: '', descripcion: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FondoForm, v: string) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await onSave({ ...form, monto_total: Number(form.monto_total), fecha_inicio: form.fecha_inicio || null, fecha_fin: form.fecha_fin || null, fuente: form.fuente || null, descripcion: form.descripcion || null });
    setSaving(false);
  };
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "500px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ color: "#1B396A", fontSize: "1.4rem", fontWeight: "900", margin: 0 }}>Registrar Movimiento</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={24} /></button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Tipo *</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(['entrada', 'gasto'] as const).map(t => (
                <button key={t} type="button" onClick={() => set('tipo', t)}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid", fontWeight: "800", fontSize: "0.9rem", cursor: "pointer", borderColor: form.tipo === t ? (t === 'entrada' ? '#10b981' : '#ef4444') : '#e2e8f0', backgroundColor: form.tipo === t ? (t === 'entrada' ? '#ecfdf5' : '#fef2f2') : 'white', color: form.tipo === t ? (t === 'entrada' ? '#059669' : '#ef4444') : '#64748b' }}>
                  {t === 'entrada' ? '↑ Entrada' : '↓ Gasto'}
                </button>
              ))}
            </div>
          </div>
          {([['nombre', 'Nombre o concepto *', 'text', true], ['monto_total', 'Monto (MXN) *', 'number', true], ['fuente', 'Fuente o convocatoria', 'text', false], ['fecha_inicio', 'Fecha inicio', 'date', false], ['fecha_fin', 'Fecha vencimiento', 'date', false]] as [keyof FondoForm, string, string, boolean][]).map(([k, label, type, req]) => (
            <div key={k}>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>{label}</label>
              <input type={type} required={req} value={form[k]} onChange={e => set(k, e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#f59e0b"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          ))}
          <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
            <div style={{ flex: 1 }}>
              <ExpandingButton label="Cancelar" onClick={onClose} type="button" variant="cancel" fullWidth size={44} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
            </div>
            <div style={{ flex: 2 }}>
              <ExpandingButton label="Registrar" loading={saving} loadingLabel="Guardando..." type="submit" disabled={saving} expanded fullWidth size={44} radius={12} gap={8} padding="0 16px" fontWeight={900} durationMs={300} />
            </div>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
