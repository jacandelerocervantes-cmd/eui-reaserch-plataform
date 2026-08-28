import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export type TelRow = { id: string; sensor_id: string; tipo: string; valor: number; unidad: string; alert_level: 'normal' | 'warning' | 'alert'; created_at: string };

export function useSensoresIoT() {
  const [rows, setRows] = useState<TelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<{ anomaly: boolean; alert_level: string } | null>(null);
  const [simForm, setSimForm] = useState({ sensor_id: 'SEN-001', tipo: 'temp', valor: 36.5 });
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchInitial = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.from('telemetria_iot').select('*').order('created_at', { ascending: false }).limit(60);
      if (error) throw error;
      setRows(data ?? []);
    } catch (e) {
      console.error("Error cargando telemetría:", e);
      setLoadError(e instanceof Error ? e.message : "No se pudo cargar la telemetría.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchInitial(); }, 0);
    subRef.current = supabase.channel('telemetria_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telemetria_iot' }, (payload: { new: TelRow }) => {
        setRows(prev => [payload.new as TelRow, ...prev.slice(0, 99)]);
      })
      .subscribe();
    return () => { clearTimeout(t); subRef.current?.unsubscribe(); };
  }, []);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimLoading(true); setSimResult(null); setSimError(null);
    try {
      const { data, error } = await supabase.functions.invoke('ingest-telemetry', {
        body: { sensor_id: simForm.sensor_id, tipo: simForm.tipo, valor: Number(simForm.valor), unidad: simForm.tipo === 'temp' ? '°C' : simForm.tipo === 'humidity' ? '%' : simForm.tipo === 'cpu' ? '%' : 'pH' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "El sensor simulado no respondió correctamente.");
      setSimResult(data.data);
    } catch (e) {
      console.error("Error simulando lectura:", e);
      setSimError(e instanceof Error ? e.message : "No se pudo enviar la lectura simulada.");
    } finally {
      setSimLoading(false);
    }
  };

  // Group by sensor for sparklines
  const sensors = Array.from(new Set(rows.map(r => r.sensor_id)));
  const sensorGroups: Record<string, TelRow[]> = {};
  sensors.forEach(s => { sensorGroups[s] = rows.filter(r => r.sensor_id === s).slice(0, 20).reverse(); });

  const anomalies = rows.filter(r => r.alert_level !== 'normal').slice(0, 5);

  return {
    rows,
    loading,
    loadError,
    simLoading,
    simError,
    simResult,
    simForm, setSimForm,
    fetchInitial,
    handleSimulate,
    sensors,
    sensorGroups,
    anomalies,
  };
}
