"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Activity, Cpu, ClipboardList, Wrench, Loader2, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useLaboratorio } from "./_hooks/useLaboratorio";

const MetricCard = ({ label, value, sub, color, icon: Icon, onClick }: {
  label: string; value: number; sub?: string; color: string; icon: React.ElementType; onClick?: () => void;
}) => (
  <div onClick={onClick} style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px", display: "flex", alignItems: "center", gap: "20px", cursor: "pointer", transition: "all 0.3s", flex: 1 }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 10px 20px -5px ${color}20`; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
    <div style={{ backgroundColor: `${color}15`, color, padding: "16px", borderRadius: "16px", flexShrink: 0 }}><Icon size={28} /></div>
    <div>
      <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>{label}</p>
      <p style={{ margin: "4px 0 2px 0", fontSize: "1.8rem", fontWeight: "900", color: "#1B396A", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>{sub}</p>}
    </div>
  </div>
);

export default function LaboratorioHub() {
  const router = useRouter();
  const { loading, loadError, stats, latestTelemetria, equiposAlerta, fetchAll } = useLaboratorio();

  const ALERT_COLOR: Record<string, string> = { normal: '#10b981', warning: '#f59e0b', alert: '#ef4444' };

  if (loading) return (
    <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={48} color="#1B396A" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (loadError) return (
    <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
      <p style={{ color: "#ef4444", fontWeight: "700" }}>{loadError}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={fetchAll} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>

      <header style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "24px" }}>
        <span style={{ backgroundColor: "#ede9fe", color: "#7c3aed", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Laboratorio</span>
        <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>Centro de Control</h1>
        <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>Estado del laboratorio en tiempo real</p>
      </header>

      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
        <MetricCard label="Equipo" value={stats.equipos} sub={`${stats.equiposMant} en mantenimiento`} color="#8b5cf6" icon={Wrench} onClick={() => router.push('/laboratorio/equipo')} />
        <MetricCard label="Telemetría Hoy" value={stats.entradas_hoy} sub={`${stats.anomalias_24h} anomalías 24h`} color={stats.anomalias_24h > 0 ? '#ef4444' : '#10b981'} icon={Activity} onClick={() => router.push('/laboratorio/sensores')} />
        <MetricCard label="Bitácora" value={stats.bitacoras} sub="entradas totales" color="#3b82f6" icon={ClipboardList} onClick={() => router.push('/laboratorio/bitacora')} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "28px" }}>

        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
          <h2 style={{ color: "#1B396A", fontWeight: "900", fontSize: "1.2rem", margin: "0 0 20px 0", display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={18} color="#8b5cf6" /> Telemetría Reciente
          </h2>
          {latestTelemetria.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
              <Cpu size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
              <p style={{ margin: 0, fontWeight: "600" }}>Sin datos de sensores</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem" }}>Conecta un sensor vía IoT API</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {latestTelemetria.map((t, i) => {
                const aColor = ALERT_COLOR[t.alert_level ?? 'normal'];
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "12px", backgroundColor: `${aColor}08`, border: `1px solid ${aColor}20` }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: aColor, flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontWeight: "800", color: "#1e293b", fontSize: "0.9rem" }}>{t.sensor_id}</p>
                        <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem" }}>{t.tipo}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontWeight: "900", color: aColor, fontSize: "1rem" }}>{t.valor}{t.unidad}</p>
                      <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.75rem" }}>{new Date(t.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: "16px" }}>
            <ExpandingButton icon={Activity} label="Ver panel completo de sensores" onClick={() => router.push('/laboratorio/sensores')} variant="secondary" fullWidth size={40} radius={12} gap={8} padding="0 16px" fontWeight={800} fontSize="0.9rem" durationMs={300} />
          </div>
        </section>

        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
          <h2 style={{ color: "#1B396A", fontWeight: "900", fontSize: "1.2rem", margin: "0 0 20px 0", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={18} color="#f59e0b" /> Equipos con Alerta
          </h2>
          {equiposAlerta.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
              <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: "12px" }} />
              <p style={{ margin: 0, fontWeight: "600" }}>Todo el equipo está operativo</p>
            </div>
          ) : equiposAlerta.map(e => (
            <div key={e.id} style={{ padding: "14px", borderRadius: "12px", border: "1px solid #fcd34d", backgroundColor: "#fffbeb", marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, fontWeight: "800", color: "#1B396A", fontSize: "0.9rem" }}>{e.nombre}</p>
                <span style={{ fontSize: "0.75rem", fontWeight: "900", color: e.estado === 'dado_de_baja' ? '#ef4444' : '#f59e0b', backgroundColor: e.estado === 'dado_de_baja' ? '#fef2f2' : '#fffbeb', padding: "2px 8px", borderRadius: "6px" }}>{e.estado}</span>
              </div>
              {e.proxima_calibracion && new Date(e.proxima_calibracion) < new Date() && (
                <p style={{ margin: "4px 0 0 0", color: "#d97706", fontSize: "0.8rem" }}>⚠ Calibración vencida: {new Date(e.proxima_calibracion).toLocaleDateString('es-MX')}</p>
              )}
            </div>
          ))}
          <div style={{ marginTop: equiposAlerta.length > 0 ? "8px" : "0" }}>
            <ExpandingButton icon={Wrench} label="Gestionar equipo" onClick={() => router.push('/laboratorio/equipo')} variant="secondary" fullWidth size={40} radius={12} gap={8} padding="0 16px" fontWeight={800} fontSize="0.9rem" durationMs={300} />
          </div>
        </section>
      </div>

      <div style={{ display: "flex", gap: "16px" }}>
        {[{ label: 'Ir a Bitácora ELN', path: '/laboratorio/bitacora', color: '#3b82f6', Icon: ClipboardList }, { label: 'Ver Sensores IoT', path: '/laboratorio/sensores', color: '#8b5cf6', Icon: Activity }, { label: 'Gestionar Equipo', path: '/laboratorio/equipo', color: '#10b981', Icon: Wrench }].map(({ label, path, color, Icon }) => (
          <div key={path} style={{ flex: 1 }}>
            <ExpandingButton icon={Icon} label={label} onClick={() => router.push(path)} fullWidth size={56} radius={16} gap={8} padding="0 16px" fontWeight={800} fontSize="0.95rem" durationMs={300} colors={{ bg: `${color}08`, hoverBg: `${color}20`, text: color, hoverText: color, border: `${color}30` }} />
          </div>
        ))}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
