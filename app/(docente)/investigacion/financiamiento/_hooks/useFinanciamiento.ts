import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Fondo, Report, FondoPayload } from "../_components/types";

export function useFinanciamiento() {
  const [fondos, setFondos] = useState<Fondo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [rawNumbers, setRawNumbers] = useState<{ burn_rate_mensual?: number } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  // Lazy initializer: se evalúa una sola vez al montar, no en cada render
  // (evita llamar Date.now() de forma impura durante el render).
  const [now] = useState(() => Date.now());

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await supabase.from('fondos_investigacion').select('*').eq('docente_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setFondos(data ?? []);
    } catch (e) {
      console.error("Error cargando finanzas:", e);
      setLoadError(e instanceof Error ? e.message : "No se pudieron cargar los movimientos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchAll(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleCreate = async (formData: FondoPayload) => {
    if (!userId) return;
    setCreateError(null);
    const { data, error } = await supabase.from('fondos_investigacion').insert({ ...formData, docente_id: userId }).select().single();
    if (!error && data) {
      setFondos(prev => [data, ...prev]);
      setShowModal(false);
    } else {
      setCreateError(error?.message ?? "No se pudo registrar el movimiento.");
    }
  };

  const handleReport = async () => {
    setReportLoading(true); setReport(null); setReportError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-financial-report');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "El generador de informes no respondió correctamente.");
      setReport(data.data.report);
      setRawNumbers(data.data.raw_numbers);
    } catch (e) {
      console.error("Error generando informe financiero:", e);
      setReportError(e instanceof Error ? e.message : "No se pudo generar el informe financiero.");
    } finally {
      setReportLoading(false);
    }
  };

  const entradas = fondos.filter(f => f.tipo === 'entrada');
  const gastos = fondos.filter(f => f.tipo === 'gasto');
  const totalEntradas = entradas.reduce((s, f) => s + f.monto_total, 0);
  const totalGastos = gastos.reduce((s, f) => s + f.monto_total, 0);
  const saldo = totalEntradas - totalGastos;

  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;

  const venciendo = fondos.filter(f => f.fecha_fin && new Date(f.fecha_fin) < new Date(now + 30 * 24 * 60 * 60 * 1000));

  return {
    fondos, loading, loadError, fetchAll,
    showModal, setShowModal,
    createError, handleCreate,
    report, rawNumbers, reportLoading, reportError, handleReport,
    entradas, gastos, totalEntradas, totalGastos, saldo, fmt, venciendo,
  };
}
