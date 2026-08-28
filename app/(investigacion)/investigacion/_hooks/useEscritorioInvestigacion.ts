import { useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FileText, AlertCircle } from "lucide-react";
import type React from "react";

export type ProyectoActivo = { id: string; titulo: string; avance: number | null; proximo_hito: string | null; fecha_hito: string | null };
export type Alerta = { id: string; type: string; title: string; desc: string; color: string; icon: React.ElementType; action: string };

export type FetchResult =
  | { kind: "ok"; userName: string; metrics: { proyectos: number; tesistas: number; literatura: number; saldo: number }; proyectosActivos: ProyectoActivo[]; alertas: Alerta[] }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchEscritorio(router: ReturnType<typeof useRouter>, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return { kind: "redirect" }; }
    const userName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Investigador';

    const [
      { count: cProyectos },
      { count: cTesistas },
      { count: cLiteratura },
      { data: fondos },
      { data: activos },
    ] = await Promise.all([
      supabase.from('proyectos_investigacion').select('*', { count: 'exact', head: true }).eq('docente_id', user.id),
      supabase.from('tesistas').select('*', { count: 'exact', head: true }).eq('docente_id', user.id),
      supabase.from('literatura_referencias').select('*', { count: 'exact', head: true }).eq('docente_id', user.id),
      supabase.from('fondos_investigacion').select('monto_total, tipo').eq('docente_id', user.id),
      supabase.from('proyectos_investigacion').select('id, titulo, avance, proximo_hito, fecha_hito').eq('docente_id', user.id).eq('status', 'En Ejecución').order('updated_at', { ascending: false }).limit(3),
    ]);

    type FondoRow = { monto_total: number | null; tipo: string };
    const entradas = ((fondos ?? []) as FondoRow[]).filter((f) => f.tipo === 'entrada').reduce((s, f) => s + (f.monto_total ?? 0), 0);
    const gastos = ((fondos ?? []) as FondoRow[]).filter((f) => f.tipo === 'gasto').reduce((s, f) => s + (f.monto_total ?? 0), 0);

    const metrics = { proyectos: cProyectos ?? 0, tesistas: cTesistas ?? 0, literatura: cLiteratura ?? 0, saldo: entradas - gastos };

    // Build action alerts from real data
    const alertas: Alerta[] = [];
    const { data: tesistasPendientes } = await supabase.from('tesistas').select('id, nombre, titulo_tesis').eq('docente_id', user.id).not('etapa', 'eq', 'graduado').limit(1);
    if (tesistasPendientes?.[0]) {
      alertas.push({ id: 't1', type: 'tesis', title: 'Tesista pendiente de revisión', desc: `${tesistasPendientes[0].nombre}: "${tesistasPendientes[0].titulo_tesis}"`, color: '#f59e0b', icon: FileText, action: 'Revisar Tesis' });
    }
    const { data: fondosVenciendo } = await supabase.from('fondos_investigacion').select('nombre, fecha_fin').eq('docente_id', user.id).not('fecha_fin', 'is', null).lte('fecha_fin', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).limit(1);
    if (fondosVenciendo?.[0]) {
      alertas.push({ id: 'f1', type: 'fondo', title: '¡Fondo próximo a vencer!', desc: `"${fondosVenciendo[0].nombre}" vence el ${new Date(fondosVenciendo[0].fecha_fin).toLocaleDateString('es-MX')}`, color: '#ef4444', icon: AlertCircle, action: 'Ir a Finanzas' });
    }

    return { kind: "ok", userName, metrics, proyectosActivos: activos ?? [], alertas };
  } catch (e) {
    console.error("Error cargando el escritorio de investigación:", e);
    return { kind: "error", message: e instanceof Error ? e.message : "No se pudo cargar el escritorio." };
  }
}

export function useEscritorioInvestigacion() {
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchEscritorio(router, reloadKey), [router, reloadKey]);
  const result = use(resource);
  const [alertas, setAlertas] = useState<Alerta[]>(result.kind === "ok" ? result.alertas : []);

  const handleAlertAction = (type: string, id: string) => {
    setAlertas(prev => prev.filter(a => a.id !== id));
    if (type === 'tesis') router.push('/investigacion/tesis');
    if (type === 'fondo') router.push('/investigacion/financiamiento');
    if (type === 'cita') router.push('/investigacion/radar');
  };

  return {
    router,
    result,
    alertas,
    handleAlertAction,
    onRetry: () => setReloadKey((k) => k + 1),
  };
}
