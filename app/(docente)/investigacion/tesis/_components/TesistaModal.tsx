"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { ETAPAS, ETAPA_LABELS } from "./constants";
import type { TesistaForm, TesistaPayload } from "../_hooks/useTesistas";

export const TesistaModal = ({ onClose, onSave, error }: { onClose: () => void; onSave: (d: TesistaPayload) => void; error: string | null }) => {
  const [form, setForm] = useState<TesistaForm>({ nombre: '', email: '', titulo_tesis: '', etapa: 'protocolo', avance: 0, fecha_defensa: '', notas: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof TesistaForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await onSave({ ...form, avance: Number(form.avance), fecha_defensa: form.fecha_defensa || null });
    setSaving(false);
  };
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "520px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ color: "#1B396A", fontSize: "1.4rem", fontWeight: "900", margin: 0 }}>Registrar Tesista</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={24} /></button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}
          {([['nombre', 'Nombre completo *', 'text', true], ['email', 'Correo *', 'email', true], ['titulo_tesis', 'Título de tesis *', 'text', true], ['fecha_defensa', 'Fecha estimada de defensa', 'date', false]] as [keyof TesistaForm, string, string, boolean][]).map(([k, label, type, req]) => (
            <div key={k}>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>{label}</label>
              <input type={type} required={req} value={form[k] as string} onChange={e => set(k, e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#f59e0b"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Etapa</label>
              <select value={form.etapa} onChange={e => set('etapa', e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none", cursor: "pointer" }}>
                {ETAPAS.map(e => <option key={e} value={e}>{ETAPA_LABELS[e]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Avance %</label>
              <input type="number" min="0" max="100" value={form.avance} onChange={e => set('avance', e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
            <div style={{ flex: 1 }}>
              <ExpandingButton label="Cancelar" onClick={onClose} type="button" variant="cancel" fullWidth size={44} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
            </div>
            <div style={{ flex: 2 }}>
              <ExpandingButton label="Registrar tesista" loading={saving} loadingLabel="Guardando..." type="submit" disabled={saving} expanded fullWidth size={44} radius={12} gap={8} padding="0 16px" fontWeight={900} durationMs={300} />
            </div>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};
