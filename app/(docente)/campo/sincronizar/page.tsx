"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getPendingCapturas, markSynced } from "@/lib/campoDb";
import type { LocalCaptura } from "@/lib/campoDb";
import { RefreshCw, CheckCircle2, AlertTriangle, Loader2, Wifi, WifiOff, Camera, FileText, Mic, FlaskConical, ArrowLeft, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import ExpandingButton from "@/components/ui/ExpandingButton";

const TIPO_ICON: Record<string, React.ElementType> = { foto: Camera, audio: Mic, texto: FileText, muestra: FlaskConical };
const TIPO_COLOR: Record<string, string> = { foto: '#3b82f6', audio: '#8b5cf6', texto: '#10b981', muestra: '#f59e0b' };

type SyncResult = { local_id: string; status: 'success' | 'error' | 'pending'; fuera_de_zona?: boolean; error?: string };

export default function SincronizarPage() {
  const router = useRouter();
  const [pending, setPending] = useState<LocalCaptura[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<Record<string, SyncResult>>({});
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    loadPending();
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const loadPending = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await getPendingCapturas();
      setPending(items);
    } catch (e) {
      console.error("Error leyendo capturas locales:", e);
      setLoadError(e instanceof Error ? e.message : "No se pudo leer la cola local de capturas.");
    } finally {
      setLoading(false);
    }
  };

  const syncAll = async () => {
    if (!online || pending.length === 0) return;
    setSyncing(true);

    const initialResults: Record<string, SyncResult> = {};
    pending.forEach(p => { initialResults[p.local_id] = { local_id: p.local_id, status: 'pending' }; });
    setResults(initialResults);

    for (const captura of pending) {
      try {
        const { data, error } = await supabase.functions.invoke('sync-field-captures', {
          body: {
            local_id: captura.local_id,
            mision_id: captura.mision_id,
            tipo: captura.tipo,
            latitud: captura.latitud,
            longitud: captura.longitud,
            notas: captura.notas,
            campos_datos: captura.campos_datos,
            content_url: captura.content_url,
            timestamp: captura.timestamp,
          },
        });

        if (error || !data?.success) throw new Error(data?.error ?? error?.message ?? 'Error de sincronización');

        await markSynced(captura.local_id);
        setResults(r => ({ ...r, [captura.local_id]: { local_id: captura.local_id, status: 'success', fuera_de_zona: data.data?.fuera_de_zona } }));
      } catch (e) {
        setResults(r => ({ ...r, [captura.local_id]: { local_id: captura.local_id, status: 'error', error: e instanceof Error ? e.message : String(e) } }));
      }
    }

    setSyncing(false);
    await loadPending();
  };

  const successCount = Object.values(results).filter(r => r.status === 'success').length;
  const errorCount = Object.values(results).filter(r => r.status === 'error').length;
  const pendingCount = Object.values(results).filter(r => r.status === 'pending').length;

  return (
    <div style={{ padding: "40px", maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px" }}>

      <button onClick={() => router.push('/campo')} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontWeight: "700", alignSelf: "flex-start" }}>
        <ArrowLeft size={16} /> Volver a Campo
      </button>

      <header style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "20px" }}>
        <span style={{ backgroundColor: "#ffedd5", color: "#c2410c", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", display: "inline-block", marginBottom: "8px" }}>Mundo Terracota</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "950", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>Sincronizar Capturas</h1>
            <p style={{ color: "#64748b", margin: 0, fontWeight: "500" }}>Cola local → Supabase</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", backgroundColor: online ? "#ecfdf5" : "#fef2f2" }}>
            {online ? <Wifi size={16} color="#059669" /> : <WifiOff size={16} color="#ef4444" />}
            <span style={{ fontWeight: "800", fontSize: "0.85rem", color: online ? "#059669" : "#ef4444" }}>{online ? 'En línea' : 'Sin conexión'}</span>
          </div>
        </div>
      </header>

      {loadError && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {loadError}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={loadPending} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      {/* Status summary after sync */}
      {Object.keys(results).length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
          {[{ label: 'Sincronizadas', count: successCount, color: '#10b981', bg: '#ecfdf5' }, { label: 'Pendientes', count: pendingCount, color: '#f59e0b', bg: '#fffbeb' }, { label: 'Con error', count: errorCount, color: '#ef4444', bg: '#fef2f2' }].map(({ label, count, color, bg }) => (
            <div key={label} style={{ backgroundColor: bg, borderRadius: "14px", padding: "16px", textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "0.75rem", color, fontWeight: "900", textTransform: "uppercase" }}>{label}</p>
              <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: "900", color }}>{count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sync button */}
      <ExpandingButton
        icon={syncing ? Loader2 : RefreshCw}
        label={syncing ? `Sincronizando ${pendingCount} restantes...` : `Sincronizar ${pending.length} captura${pending.length !== 1 ? 's' : ''}`}
        onClick={syncAll}
        disabled={syncing || !online || pending.length === 0}
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

      {!online && (
        <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "14px", padding: "14px 18px", display: "flex", gap: "10px", alignItems: "center" }}>
          <WifiOff size={18} color="#ef4444" />
          <p style={{ margin: 0, color: "#dc2626", fontWeight: "700", fontSize: "0.9rem" }}>Sin conexión a internet. Las capturas están guardadas localmente y se sincronizarán cuando tengas red.</p>
        </div>
      )}

      {/* Queue list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : pending.length === 0 && Object.keys(results).length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", color: "#94a3b8" }}>
          <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: "16px" }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#64748b" }}>Todo sincronizado</h3>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>No hay capturas pendientes en el dispositivo</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {pending.map(cap => {
            const res = results[cap.local_id];
            const Icon = TIPO_ICON[cap.tipo] ?? FileText;
            const color = TIPO_COLOR[cap.tipo] ?? '#94a3b8';
            const statusColor = res?.status === 'success' ? '#10b981' : res?.status === 'error' ? '#ef4444' : res?.status === 'pending' ? '#f59e0b' : '#94a3b8';
            return (
              <div key={cap.local_id} style={{ backgroundColor: "white", borderRadius: "14px", border: `1px solid ${statusColor}30`, padding: "16px 20px", display: "flex", gap: "14px", alignItems: "center" }}>
                <div style={{ backgroundColor: `${color}15`, color, padding: "10px", borderRadius: "10px", flexShrink: 0 }}><Icon size={18} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px 0", fontWeight: "800", color: "#1B396A", fontSize: "0.9rem", textTransform: "capitalize" }}>{cap.tipo}</p>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem" }}>
                    {new Date(cap.timestamp).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {cap.latitud ? ` · 📍 ${cap.latitud.toFixed(3)}°` : ''}
                  </p>
                  {cap.notas && <p style={{ margin: "2px 0 0 0", color: "#94a3b8", fontSize: "0.8rem" }}>{cap.notas.slice(0, 80)}{cap.notas.length > 80 ? '...' : ''}</p>}
                  {res?.error && <p style={{ margin: "4px 0 0 0", color: "#ef4444", fontSize: "0.8rem" }}>⚠ {res.error}</p>}
                  {res?.fuera_de_zona && <p style={{ margin: "4px 0 0 0", color: "#f59e0b", fontSize: "0.8rem", fontWeight: "700" }}>⚠ Fuera de zona de misión</p>}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {!res && <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "700" }}>Pendiente</span>}
                  {res?.status === 'pending' && <Loader2 size={18} color="#f59e0b" style={{ animation: "spin 1s linear infinite" }} />}
                  {res?.status === 'success' && <CheckCircle2 size={20} color="#10b981" />}
                  {res?.status === 'error' && <AlertTriangle size={20} color="#ef4444" />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
