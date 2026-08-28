"use client";

import { useRef } from "react";
import { Camera, MapPin, Mic, FileText, FlaskConical, Loader2, Check, X, ArrowLeft, AlertTriangle, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useCaptura, type TipoCaptura } from "./_hooks/useCaptura";

const TIPOS = [
  { key: 'foto', label: 'Foto', icon: Camera, color: '#3b82f6', accept: 'image/*', capture: 'environment' },
  { key: 'texto', label: 'Nota', icon: FileText, color: '#10b981', accept: undefined, capture: undefined },
  { key: 'muestra', label: 'Muestra', icon: FlaskConical, color: '#f59e0b', accept: undefined, capture: undefined },
  { key: 'audio', label: 'Audio', icon: Mic, color: '#8b5cf6', accept: 'audio/*', capture: 'user' },
] as const;

export default function CapturaPage() {
  const c = useCaptura();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTipo = TIPOS.find(t => t.key === c.tipo)!;
  const Icon = currentTipo.icon;

  if (c.saved) return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", backgroundColor: "#ecfdf5" }}>
      <div style={{ width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check size={40} color="white" strokeWidth={3} />
      </div>
      <h2 style={{ color: "#059669", margin: 0, fontWeight: "900" }}>Captura guardada</h2>
      <p style={{ color: "#64748b", margin: 0 }}>Guardada localmente. Sincroniza cuando tengas conexión.</p>
    </div>
  );

  return (
    <div style={{ padding: "40px", maxWidth: "680px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>

      <button onClick={() => c.router.back()} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontWeight: "700", alignSelf: "flex-start" }}>
        <ArrowLeft size={16} /> Volver
      </button>

      <header style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "20px" }}>
        <span style={{ backgroundColor: "#ffedd5", color: "#c2410c", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Mundo Terracota</span>
        <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Nueva Captura</h1>
      </header>

      {/* GPS status */}
      <div style={{ backgroundColor: c.gps ? "#ecfdf5" : c.gpsError ? "#fef2f2" : "#fffbeb", borderRadius: "14px", padding: "14px 18px", display: "flex", gap: "10px", alignItems: "center" }}>
        {c.gpsLoading ? <Loader2 size={16} color="#f59e0b" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} /> : c.gps ? <MapPin size={16} color="#059669" style={{ flexShrink: 0 }} /> : <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />}
        <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "700", color: c.gps ? "#059669" : c.gpsError ? "#ef4444" : "#d97706" }}>
          {c.gpsLoading ? 'Obteniendo ubicación...' : c.gps ? `${c.gps.lat.toFixed(5)}°, ${c.gps.lon.toFixed(5)}°` : c.gpsError || 'Sin GPS'}
        </p>
        {!c.gpsLoading && !c.gps && <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={c.captureGPS} small smallSize={28} radius={8} gap={6} padding="0 10px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#3b82f6", text: "#3b82f6", hoverText: "white", border: "transparent" }} />}
      </div>

      {c.misionesError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {c.misionesError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={c.fetchMisiones} small smallSize={28} radius={8} gap={6} padding="0 10px" fontWeight={700} fontSize="0.78rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      {/* Tipo selector */}
      <div>
        <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "10px" }}>Tipo de captura</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px" }}>
          {TIPOS.map(t => {
            const TIcon = t.icon;
            const active = c.tipo === t.key;
            return (
              <button key={t.key} onClick={() => c.setTipo(t.key as TipoCaptura)}
                style={{ padding: "16px 8px", borderRadius: "14px", border: `2px solid ${active ? t.color : '#e2e8f0'}`, backgroundColor: active ? `${t.color}10` : "white", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", transition: "all 0.15s" }}>
                <TIcon size={22} color={active ? t.color : '#94a3b8'} />
                <span style={{ fontSize: "0.8rem", fontWeight: "800", color: active ? t.color : '#94a3b8' }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mision selector */}
      <div>
        <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Misión *</label>
        <select value={c.misionId} onChange={e => c.setMisionId(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", cursor: "pointer" }}>
          <option value="">Seleccionar misión...</option>
          {c.misiones.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
        </select>
      </div>

      {/* File input for foto/audio */}
      {(c.tipo === 'foto' || c.tipo === 'audio') && (
        <div>
          <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Archivo ({c.tipo === 'foto' ? 'imagen' : 'audio'})</label>
          <input ref={fileInputRef} type="file" accept={currentTipo.accept} capture={currentTipo.capture} onChange={e => c.setFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            style={{ width: "100%", padding: "14px", borderRadius: "12px", border: `2px dashed ${c.file ? currentTipo.color : '#cbd5e1'}`, backgroundColor: c.file ? `${currentTipo.color}08` : "white", color: c.file ? currentTipo.color : "#94a3b8", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <Icon size={18} /> {c.file ? c.file.name : `Capturar ${c.tipo}`}
          </button>
          {c.file && <button onClick={() => c.setFile(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.8rem", marginTop: "4px" }}><X size={12} /> Quitar</button>}
        </div>
      )}

      {/* Notas */}
      <div>
        <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Notas / Observaciones</label>
        <textarea value={c.notas} onChange={e => c.setNotas(e.target.value)} rows={4} placeholder="Describe lo observado, condiciones ambientales, características relevantes..."
          style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }}
          onFocus={e => e.target.style.borderColor = "#c2410c"} onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
      </div>

      {/* Sample fields */}
      {c.tipo === 'muestra' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {['id_muestra', 'temperatura', 'ph', 'observacion'].map(field => (
            <div key={field}>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>{field.replace('_', ' ')}</label>
              <input value={c.additionalFields[field] ?? ''} onChange={e => c.setAdditionalFields(f => ({ ...f, [field]: e.target.value }))}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
      )}

      <ExpandingButton
        icon={c.saving ? Loader2 : Check}
        label={c.saving ? "Guardando..." : "Guardar Captura"}
        onClick={c.handleSave}
        disabled={c.saving || !c.misionId}
        variant="primary"
        size={56}
        radius={16}
        gap={10}
        padding="0 24px"
        fontWeight={900}
        fontSize="1.1rem"
        durationMs={300}
        fullWidth
      />

      {c.saveError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.85rem", textAlign: "center" }}>
          {c.saveError}
        </div>
      )}

      <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", margin: 0 }}>
        Se guarda localmente en el dispositivo. Sincroniza después en /campo/sincronizar.
      </p>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
