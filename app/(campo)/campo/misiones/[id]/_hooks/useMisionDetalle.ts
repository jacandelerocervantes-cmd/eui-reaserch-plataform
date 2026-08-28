import { useMemo, useState, use } from "react";
import { supabase } from "@/lib/supabase";

export type Mision = { id: string; titulo: string; descripcion: string | null; objetivo: string | null; latitud: number | null; longitud: number | null; radio_metros: number; fecha_inicio: string | null; fecha_fin: string | null; status: string };
export type Captura = { id: string; tipo: string; latitud: number | null; longitud: number | null; notas: string; timestamp: string; fuera_de_zona: boolean; content_url: string | null };
export type FieldReport = { titulo_informe: string; resumen_ejecutivo: string; hallazgos_principales?: string[]; recomendaciones?: string[] };

export type FetchResult = { ok: true; mision: Mision | null; capturas: Captura[] } | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchMision(id: string, _reloadKey: number): Promise<FetchResult> {
  try {
    const [{ data: m, error: mErr }, { data: c, error: cErr }] = await Promise.all([
      supabase.from('misiones_campo').select('*').eq('id', id).single(),
      supabase.from('capturas_campo').select('*').eq('mision_id', id).order('timestamp', { ascending: false }),
    ]);
    if (mErr) throw mErr;
    if (cErr) throw cErr;
    return { ok: true, mision: m ?? null, capturas: c ?? [] };
  } catch (e) {
    console.error("Error cargando misión:", e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cargar la misión." };
  }
}

export function useMisionDetalle(id: string) {
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchMision(id, reloadKey), [id, reloadKey]);
  const result = use(resource);

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<FieldReport | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [mision, setMision] = useState<Mision | null>(result.ok ? result.mision : null);

  const handleStatusChange = async (newStatus: string) => {
    if (!mision) return;
    setStatusLoading(true);
    setStatusError(null);
    const { error } = await supabase.from('misiones_campo').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setMision(prev => prev ? { ...prev, status: newStatus } : prev);
    } else {
      setStatusError(error.message ?? "No se pudo cambiar el estado de la misión.");
    }
    setStatusLoading(false);
  };

  const handleReport = async () => {
    setReportLoading(true); setReport(null); setReportError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-field-report', { body: { mision_id: id } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "El generador de informes no respondió correctamente.");
      setReport(data.data);
    } catch (e) {
      console.error("Error generando informe:", e);
      setReportError(e instanceof Error ? e.message : "No se pudo generar el informe.");
    } finally {
      setReportLoading(false);
    }
  };

  return {
    result,
    mision,
    reportLoading, reportError, report,
    statusLoading, statusError,
    handleStatusChange,
    handleReport,
    onRetry: () => setReloadKey((k) => k + 1),
  };
}
