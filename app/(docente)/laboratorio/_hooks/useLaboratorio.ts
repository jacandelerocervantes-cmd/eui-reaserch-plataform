import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type TelemetriaRow = { sensor_id: string; tipo: string; valor: number; unidad: string; alert_level: string; created_at: string };
export type EquipoAlerta = { id: string; nombre: string; estado: string; proxima_calibracion: string | null };
export type LaboratorioStats = { equipos: number; equiposMant: number; entradas_hoy: number; anomalias_24h: number; bitacoras: number };

export function useLaboratorio() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<LaboratorioStats>({ equipos: 0, equiposMant: 0, entradas_hoy: 0, anomalias_24h: 0, bitacoras: 0 });
  const [latestTelemetria, setLatestTelemetria] = useState<TelemetriaRow[]>([]);
  const [equiposAlerta, setEquiposAlerta] = useState<EquipoAlerta[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const hoy = new Date().toISOString().split('T')[0];

      const [
        { count: cEquipos },
        { count: cMant },
        { count: cEntradas },
        { count: cAnomalias },
        { count: cBitacoras },
        { data: telemetria },
        { data: equiposMant },
      ] = await Promise.all([
        supabase.from('equipos_lab').select('*', { count: 'exact', head: true }).eq('docente_responsable_id', user.id),
        supabase.from('equipos_lab').select('*', { count: 'exact', head: true }).eq('docente_responsable_id', user.id).in('estado', ['mantenimiento']),
        supabase.from('telemetria_iot').select('*', { count: 'exact', head: true }).gte('created_at', hoy),
        supabase.from('telemetria_iot').select('*', { count: 'exact', head: true }).gte('created_at', ayer).neq('alert_level', 'normal'),
        supabase.from('entradas_bitacora').select('*', { count: 'exact', head: true }).eq('autor_id', user.id),
        supabase.from('telemetria_iot').select('sensor_id, tipo, valor, unidad, alert_level, created_at').gte('created_at', ayer).order('created_at', { ascending: false }).limit(6),
        supabase.from('equipos_lab').select('id, nombre, estado, proxima_calibracion').eq('docente_responsable_id', user.id).in('estado', ['mantenimiento', 'dado_de_baja']).limit(4),
      ]);

      setStats({ equipos: cEquipos ?? 0, equiposMant: cMant ?? 0, entradas_hoy: cEntradas ?? 0, anomalias_24h: cAnomalias ?? 0, bitacoras: cBitacoras ?? 0 });
      setLatestTelemetria(telemetria ?? []);
      setEquiposAlerta(equiposMant ?? []);
    } catch (e) {
      console.error("Error cargando el centro de control:", e);
      setLoadError(e instanceof Error ? e.message : "No se pudo cargar el estado del laboratorio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchAll(); }, 0);
    return () => clearTimeout(t);
  }, []);

  return {
    loading,
    loadError,
    stats,
    latestTelemetria,
    equiposAlerta,
    fetchAll,
  };
}
