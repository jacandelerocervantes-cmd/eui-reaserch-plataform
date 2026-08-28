"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { MapPin, Camera, Mic, FileText, FlaskConical, ArrowLeft, Loader2, Sparkles, AlertTriangle, CheckCircle2, Radio, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useMisionDetalle } from "./_hooks/useMisionDetalle";

const TIPO_ICON: Record<string, React.ElementType> = { foto: Camera, audio: Mic, texto: FileText, muestra: FlaskConical };
const TIPO_COLOR: Record<string, string> = { foto: '#3b82f6', audio: '#8b5cf6', texto: '#10b981', muestra: '#f59e0b' };
const STATUS_COLOR: Record<string, string> = { planificada: '#3b82f6', activa: '#10b981', completada: '#94a3b8', cancelada: '#ef4444' };

function MisionDetalleContent({ id, onRetry }: { id: string; onRetry: () => void }) {
  const router = useRouter();
  const {
    result,
    mision,
    reportLoading, reportError, report,
    statusLoading, statusError,
    handleStatusChange,
    handleReport,
  } = useMisionDetalle(id);

  if (!result.ok) return (
    <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "40px", textAlign: "center" }}>
      <p style={{ color: "#ef4444", fontWeight: "700" }}>{result.error}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { capturas } = result;

  const fueraCount = capturas.filter(c => c.fuera_de_zona).length;
  const byType = capturas.reduce((acc, c) => { acc[c.tipo] = (acc[c.tipo] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  if (!mision) return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <p style={{ color: "#ef4444" }}>Misión no encontrada.</p>
      <div style={{ display: "flex", justifyContent: "center", marginTop: "12px" }}>
        <ExpandingButton icon={ArrowLeft} label="Volver" onClick={() => router.push('/campo')} variant="primary" size={44} radius={10} gap={10} padding="0 20px" fontWeight={700} durationMs={300} />
      </div>
    </div>
  );

  const sColor = STATUS_COLOR[mision.status] ?? '#94a3b8';

  return (
    <div style={{ padding: "40px", maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px" }}>

      <button onClick={() => router.push('/campo')} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontWeight: "700", alignSelf: "flex-start" }}>
        <ArrowLeft size={16} /> Volver a Campo
      </button>

      <header style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ backgroundColor: "#ffedd5", color: "#c2410c", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "1px" }}>Mundo Terracota</span>
              <span style={{ backgroundColor: `${sColor}15`, color: sColor, padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.7rem", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                {mision.status === 'activa' && <Radio size={10} />} {mision.status}
              </span>
            </div>
            <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "950", margin: "0 0 8px 0" }}>{mision.titulo}</h1>
            {mision.objetivo && <p style={{ color: "#64748b", margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>{mision.objetivo}</p>}
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {mision.status === 'planificada' && <ExpandingButton icon={Radio} label="Activar Misión" onClick={() => handleStatusChange('activa')} disabled={statusLoading} size={40} radius={12} gap={8} padding="0 18px" fontWeight={800} durationMs={300} colors={{ bg: "#ecfdf5", hoverBg: "#a7f3d0", text: "#059669", hoverText: "#059669", border: "#a7f3d0" }} />}
            {mision.status === 'activa' && <ExpandingButton icon={CheckCircle2} label="Marcar completada" onClick={() => handleStatusChange('completada')} disabled={statusLoading} size={40} radius={12} gap={8} padding="0 18px" fontWeight={800} durationMs={300} variant="secondary" />}
            <ExpandingButton icon={Camera} label="Nueva Captura" onClick={() => router.push(`/campo/captura?mision=${id}`)} variant="primary" size={40} radius={12} gap={8} padding="0 18px" fontWeight={800} durationMs={300} />
            {capturas.length > 0 && (
              <ExpandingButton
                icon={Sparkles}
                label="Generar Informe"
                loadingLabel="Generando..."
                onClick={handleReport}
                loading={reportLoading}
                size={40} radius={12} gap={8} padding="0 18px" fontWeight={800} durationMs={300}
                colors={{ bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white", hoverText: "white", border: "transparent" }}
              />
            )}
          </div>
        </div>

        {statusError && (
          <div style={{ marginTop: "12px", backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.85rem" }}>
            {statusError}
          </div>
        )}

        {reportError && (
          <div style={{ marginTop: "12px", backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.85rem" }}>
            {reportError}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
          {mision.latitud && <span style={{ fontSize: "0.8rem", color: "#64748b", backgroundColor: "#f8fafc", padding: "4px 10px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "4px" }}><MapPin size={12} /> {mision.latitud.toFixed(4)}°, {mision.longitud?.toFixed(4)}° · R: {mision.radio_metros}m</span>}
          {mision.fecha_inicio && <span style={{ fontSize: "0.8rem", color: "#64748b", backgroundColor: "#f8fafc", padding: "4px 10px", borderRadius: "8px" }}>{new Date(mision.fecha_inicio).toLocaleDateString('es-MX')} {mision.fecha_fin ? `→ ${new Date(mision.fecha_fin).toLocaleDateString('es-MX')}` : ''}</span>}
        </div>

        {/* Static map placeholder */}
        {mision.latitud && (
          <a href={`https://www.openstreetmap.org/#map=15/${mision.latitud}/${mision.longitud}`} target="_blank" rel="noreferrer"
            style={{ display: "block", marginTop: "16px", height: "120px", borderRadius: "12px", overflow: "hidden", border: "1px solid #e2e8f0", backgroundColor: "#f1f5f9", textDecoration: "none" }}>
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px", color: "#64748b" }}>
              <MapPin size={24} color="#c2410c" />
              <p style={{ margin: 0, fontWeight: "700", fontSize: "0.85rem" }}>Ver en OpenStreetMap → {mision.latitud.toFixed(4)}, {mision.longitud?.toFixed(4)}</p>
            </div>
          </a>
        )}
      </header>

      {/* Stats */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ backgroundColor: "white", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "16px 20px", flex: 1, minWidth: "140px" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>Capturas</p>
          <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: "900", color: "#1B396A" }}>{capturas.length}</p>
        </div>
        {Object.entries(byType).map(([tipo, count]) => {
          const Icon = TIPO_ICON[tipo] ?? FileText;
          const color = TIPO_COLOR[tipo] ?? '#94a3b8';
          return (
            <div key={tipo} style={{ backgroundColor: `${color}08`, borderRadius: "14px", border: `1px solid ${color}20`, padding: "16px 20px", flex: 1, minWidth: "120px" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.75rem", color, fontWeight: "800", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}><Icon size={12} /> {tipo}</p>
              <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: "900", color }}>{count}</p>
            </div>
          );
        })}
        {fueraCount > 0 && (
          <div style={{ backgroundColor: "#fef2f2", borderRadius: "14px", border: "1px solid #fca5a5", padding: "16px 20px", flex: 1, minWidth: "140px" }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "0.75rem", color: "#ef4444", fontWeight: "800", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> Fuera de zona</p>
            <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: "900", color: "#ef4444" }}>{fueraCount}</p>
          </div>
        )}
      </div>

      {/* AI Report */}
      {report && (
        <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "28px" }}>
          <h2 style={{ color: "#1B396A", fontWeight: "900", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}><Sparkles size={18} color="#8b5cf6" /> {report.titulo_informe}</h2>
          <p style={{ color: "#1e293b", lineHeight: 1.6, marginBottom: "16px" }}>{report.resumen_ejecutivo}</p>
          {(report.hallazgos_principales?.length ?? 0) > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ color: "#1B396A", margin: "0 0 10px 0", fontSize: "0.9rem", fontWeight: "900" }}>Hallazgos Principales</h4>
              {report.hallazgos_principales?.map((h, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: "2px" }} /><p style={{ margin: 0, color: "#1e293b", fontSize: "0.9rem" }}>{h}</p></div>
              ))}
            </div>
          )}
          {(report.recomendaciones?.length ?? 0) > 0 && (
            <div>
              <h4 style={{ color: "#1B396A", margin: "0 0 10px 0", fontSize: "0.9rem", fontWeight: "900" }}>Recomendaciones</h4>
              {report.recomendaciones?.map((r, i) => <p key={i} style={{ margin: "4px 0", color: "#64748b", fontSize: "0.85rem" }}>→ {r}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Capturas list */}
      <div>
        <h2 style={{ color: "#1B396A", fontWeight: "900", margin: "0 0 16px 0", fontSize: "1.3rem" }}>Capturas ({capturas.length})</h2>
        {capturas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", backgroundColor: "white", borderRadius: "20px", border: "1px dashed #cbd5e1", color: "#94a3b8" }}>
            <Camera size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
            <p style={{ margin: 0, fontWeight: "600" }}>Sin capturas. Toca &quot;Nueva Captura&quot; para registrar.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {capturas.map(c => {
              const Icon = TIPO_ICON[c.tipo] ?? FileText;
              const color = TIPO_COLOR[c.tipo] ?? '#94a3b8';
              return (
                <div key={c.id} style={{ backgroundColor: "white", borderRadius: "14px", border: `1px solid ${c.fuera_de_zona ? '#fca5a5' : '#e2e8f0'}`, padding: "16px 20px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div style={{ backgroundColor: `${color}15`, color, padding: "10px", borderRadius: "10px", flexShrink: 0 }}><Icon size={18} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "800", color, fontSize: "0.85rem", textTransform: "capitalize" }}>{c.tipo}</span>
                      <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{new Date(c.timestamp).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      {c.fuera_de_zona && <span style={{ backgroundColor: "#fef2f2", color: "#ef4444", padding: "2px 6px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "900" }}>FUERA DE ZONA</span>}
                    </div>
                    {c.notas && <p style={{ margin: "0 0 6px 0", color: "#1e293b", fontSize: "0.9rem", lineHeight: 1.5 }}>{c.notas}</p>}
                    {c.latitud && <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.75rem" }}>📍 {c.latitud.toFixed(4)}, {c.longitud?.toFixed(4)}</p>}
                    {c.content_url && <a href={c.content_url} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontSize: "0.8rem", fontWeight: "700", textDecoration: "none" }}>Ver archivo →</a>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function MisionDetalle() {
  const params = useParams();
  const id = params?.id as string;
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <Suspense fallback={
      <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={48} color="#1B396A" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <MisionDetalleContent key={reloadKey} id={id} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
