"use client";

import React, { useState } from "react";
import { MapPin, X } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import type { MisionForm, MisionPayload } from "./types";

export default function NuevaMisionModal({ onClose, onSave, error }: { onClose: () => void; onSave: (d: MisionPayload) => void; error: string | null }) {
  const [form, setForm] = useState<MisionForm>({ titulo: '', descripcion: '', objetivo: '', latitud: '', longitud: '', radio_metros: '500', fecha_inicio: '', fecha_fin: '' });
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const set = (k: keyof MisionForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const captureGPS = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(pos => {
      set('latitud', String(pos.coords.latitude.toFixed(6)));
      set('longitud', String(pos.coords.longitude.toFixed(6)));
      setGpsLoading(false);
    }, () => setGpsLoading(false), { timeout: 8000 });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await onSave({
      ...form,
      latitud: form.latitud ? Number(form.latitud) : null,
      longitud: form.longitud ? Number(form.longitud) : null,
      radio_metros: Number(form.radio_metros),
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      descripcion: form.descripcion || null,
      objetivo: form.objetivo || null,
      status: 'planificada',
      campos_requeridos: [],
    });
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "560px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ color: "#1B396A", fontSize: "1.4rem", fontWeight: "900", margin: 0 }}>Nueva Misión de Campo</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={24} /></button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {error && (
            <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.85rem" }}>
              {error}
            </div>
          )}
          {([['titulo', 'Título *', 'text', true], ['objetivo', 'Objetivo de la misión', 'text', false], ['descripcion', 'Descripción', 'text', false]] as [keyof MisionForm, string, string, boolean][]).map(([k, label, type, req]) => (
            <div key={k}>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>{label}</label>
              <input type={type} required={req} value={form[k]} onChange={e => set(k, e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Coordenadas del Centro</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input placeholder="Latitud" value={form.latitud} onChange={e => set('latitud', e.target.value)} style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none" }} />
              <input placeholder="Longitud" value={form.longitud} onChange={e => set('longitud', e.target.value)} style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none" }} />
              <ExpandingButton icon={MapPin} label="GPS" loading={gpsLoading} type="button" onClick={captureGPS} expanded small smallSize={36} radius={10} gap={4} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "#ecfdf5", hoverBg: "#a7f3d0", text: "#059669", hoverText: "#059669", border: "transparent" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Radio de zona (metros)</label>
            <input type="number" value={form.radio_metros} onChange={e => set('radio_metros', e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {([['fecha_inicio', 'Fecha inicio'], ['fecha_fin', 'Fecha fin']] as [keyof MisionForm, string][]).map(([k, label]) => (
              <div key={k}>
                <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>{label}</label>
                <input type="date" value={form[k]} onChange={e => set(k, e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
            <div style={{ flex: 1 }}>
              <ExpandingButton label="Cancelar" onClick={onClose} type="button" variant="cancel" fullWidth size={44} radius={12} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
            </div>
            <div style={{ flex: 2 }}>
              <ExpandingButton label="Crear misión" loading={saving} loadingLabel="Guardando..." type="submit" disabled={saving} expanded fullWidth size={44} radius={12} gap={8} padding="0 16px" fontWeight={900} durationMs={300} />
            </div>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
