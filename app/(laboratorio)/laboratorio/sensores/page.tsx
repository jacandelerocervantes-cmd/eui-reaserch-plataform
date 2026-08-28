"use client";

import React from "react";
import { Activity, Thermometer, Droplets, Cpu, Wifi, AlertTriangle, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import IotCopilotPanel from "./_components/IotCopilotPanel";
import { useSensoresIoT, type TelRow } from "./_hooks/useSensoresIoT";

const TIPO_ICON: Record<string, React.ElementType> = { temp: Thermometer, humidity: Droplets, cpu: Cpu, ph: Activity };
const TIPO_COLOR: Record<string, string> = { temp: '#f59e0b', humidity: '#3b82f6', cpu: '#8b5cf6', ph: '#10b981' };
const ALERT_COLOR: Record<'normal' | 'warning' | 'alert', string> = { normal: '#10b981', warning: '#f59e0b', alert: '#ef4444' };

const SparkBar = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "40px" }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, backgroundColor: i === data.length - 1 ? color : `${color}50`, borderRadius: "2px 2px 0 0", height: `${(v / max) * 100}%`, transition: "height 0.3s", minHeight: "2px" }} />
      ))}
    </div>
  );
};

export default function SensoresIoT() {
  const c = useSensoresIoT();

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <header style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <span style={{ backgroundColor: "#ede9fe", color: "#7c3aed", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Laboratorio</span>
        <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>Sensores IoT</h1>
        <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>{c.rows.length} lecturas · Tiempo real vía Supabase Realtime</p>
      </header>

      {c.loadError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {c.loadError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={c.fetchInitial} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      <IotCopilotPanel />

      {/* IoT Simulator */}
      <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "24px" }}>
        <h3 style={{ color: "#1B396A", fontWeight: "900", margin: "0 0 16px 0", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
          <Wifi size={18} color="#8b5cf6" /> Simular Envío de Sensor
        </h3>
        <form onSubmit={c.handleSimulate} style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          {([['sensor_id', 'Sensor ID', 'text'], ['valor', 'Valor', 'number']] as ['sensor_id' | 'valor', string, string][]).map(([k, label, type]) => (
            <div key={k}>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>{label}</label>
              <input type={type} value={c.simForm[k]} step={type === 'number' ? '0.1' : undefined}
                onChange={e => c.setSimForm(f => ({ ...f, [k]: e.target.value }))}
                style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.95rem", outline: "none", width: k === 'sensor_id' ? "120px" : "100px" }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Tipo</label>
            <select value={c.simForm.tipo} onChange={e => c.setSimForm(f => ({ ...f, tipo: e.target.value }))}
              style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none", cursor: "pointer" }}>
              {['temp', 'humidity', 'cpu', 'ph'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <ExpandingButton label="Enviar lectura" loading={c.simLoading} loadingLabel="Enviando..." type="submit" disabled={c.simLoading} expanded size={40} radius={10} gap={6} padding="0 20px" fontWeight={800} fontSize="0.9rem" durationMs={300} colors={{ bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white", hoverText: "white", border: "transparent" }} />
          {c.simResult && (
            <div style={{ padding: "10px 16px", borderRadius: "10px", backgroundColor: c.simResult.alert_level === 'normal' ? '#ecfdf5' : c.simResult.alert_level === 'warning' ? '#fffbeb' : '#fef2f2', color: ALERT_COLOR[c.simResult.alert_level as keyof typeof ALERT_COLOR], fontWeight: "800", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
              {c.simResult.alert_level === 'normal' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {c.simResult.alert_level.toUpperCase()} {c.simResult.anomaly ? '· ANOMALÍA DETECTADA' : ''}
            </div>
          )}
          {c.simError && (
            <div style={{ padding: "10px 16px", borderRadius: "10px", backgroundColor: "#fef2f2", color: "#dc2626", fontWeight: "700", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertTriangle size={14} /> {c.simError}
            </div>
          )}
        </form>
      </div>

      {/* Anomaly alerts */}
      {c.anomalies.length > 0 && (
        <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "16px", padding: "16px 20px" }}>
          <h4 style={{ color: "#dc2626", margin: "0 0 12px 0", fontWeight: "900", display: "flex", alignItems: "center", gap: "6px" }}><AlertTriangle size={16} /> Anomalías Recientes</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {c.anomalies.map(a => (
              <div key={a.id} style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "0.85rem" }}>
                <span style={{ fontWeight: "900", color: ALERT_COLOR[a.alert_level] }}>[{a.alert_level.toUpperCase()}]</span>
                <span style={{ color: "#7f1d1d" }}>{a.sensor_id} · {a.tipo} = {a.valor}{a.unidad}</span>
                <span style={{ color: "#94a3b8", marginLeft: "auto" }}>{new Date(a.created_at).toLocaleTimeString('es-MX')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sensor cards with sparklines */}
      {c.loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} /> Cargando telemetría...
        </div>
      ) : c.sensors.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "1px dashed #cbd5e1" }}>
          <Wifi size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#64748b" }}>Sin datos de sensores</h3>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>Usa el simulador de arriba para enviar una primera lectura</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
          {c.sensors.map(sensorId => {
            const sRows = c.sensorGroups[sensorId];
            const last = sRows[sRows.length - 1];
            const color = TIPO_COLOR[last?.tipo] ?? '#94a3b8';
            const aColor = ALERT_COLOR[last?.alert_level ?? 'normal'];
            const Icon = TIPO_ICON[last?.tipo] ?? Activity;
            return (
              <div key={sensorId} style={{ backgroundColor: "white", borderRadius: "20px", border: `1px solid ${aColor}30`, padding: "24px", boxShadow: last?.alert_level !== 'normal' ? `0 4px 12px -2px ${aColor}30` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <p style={{ margin: "0 0 2px 0", fontWeight: "900", color: "#1B396A", fontSize: "1rem" }}>{sensorId}</p>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.8rem", fontWeight: "600" }}>{last?.tipo}</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: "900", padding: "3px 8px", borderRadius: "6px", backgroundColor: `${aColor}15`, color: aColor }}>{last?.alert_level?.toUpperCase()}</span>
                    <div style={{ backgroundColor: `${color}15`, color, padding: "8px", borderRadius: "10px" }}><Icon size={18} /></div>
                  </div>
                </div>
                <p style={{ margin: "0 0 16px 0", fontSize: "2rem", fontWeight: "900", color }}>
                  {last?.valor}<span style={{ fontSize: "1rem", color: "#94a3b8", marginLeft: "4px" }}>{last?.unidad}</span>
                </p>
                <SparkBar data={sRows.map(r => r.valor)} color={color} />
                <p style={{ margin: "8px 0 0 0", color: "#94a3b8", fontSize: "0.75rem" }}>
                  Última lectura: {last ? new Date(last.created_at).toLocaleTimeString('es-MX') : '—'} · {sRows.length} lecturas
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Raw log */}
      {c.rows.length > 0 && (
        <div style={{ backgroundColor: "#0f172a", borderRadius: "20px", padding: "24px", fontFamily: "monospace" }}>
          <p style={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: "700", margin: "0 0 12px 0", textTransform: "uppercase" }}>Log en vivo</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto" }}>
            {c.rows.slice(0, 20).map((r: TelRow, i: number) => (
              <div key={r.id ?? i} style={{ fontSize: "0.8rem", display: "flex", gap: "16px" }}>
                <span style={{ color: "#475569" }}>{new Date(r.created_at).toLocaleTimeString('es-MX')}</span>
                <span style={{ color: ALERT_COLOR[r.alert_level ?? 'normal'] }}>[{r.alert_level?.toUpperCase()}]</span>
                <span style={{ color: "#94a3b8" }}>{r.sensor_id}</span>
                <span style={{ color: "#e2e8f0" }}>{r.tipo}={r.valor}{r.unidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
