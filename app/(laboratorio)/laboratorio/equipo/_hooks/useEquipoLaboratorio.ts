import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type Equipo = { id: string; nombre: string; tipo: string; modelo: string | null; numero_serie: string | null; ubicacion: string | null; estado: 'disponible' | 'en_uso' | 'mantenimiento' | 'dado_de_baja'; ultima_calibracion: string | null; proxima_calibracion: string | null; qr_code: string | null };

export type EquipoForm = { nombre: string; tipo: string; modelo: string; numero_serie: string; ubicacion: string };
export type EquipoPayload = Omit<EquipoForm, 'modelo' | 'numero_serie' | 'ubicacion'> & {
  estado: string; modelo: string | null; numero_serie: string | null; ubicacion: string | null;
};

export function useEquipoLaboratorio() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [qrEquipo, setQrEquipo] = useState<Equipo | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await supabase.from('equipos_lab').select('*').eq('docente_responsable_id', user.id).order('nombre');
      if (error) throw error;
      setEquipos(data ?? []);
    } catch (e) {
      console.error("Error cargando inventario:", e);
      setLoadError(e instanceof Error ? e.message : "No se pudo cargar el inventario de equipo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchAll(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleCreate = async (formData: EquipoPayload) => {
    if (!userId) return;
    setCreateError(null);
    const qr_code = `EUI-LAB-${Date.now()}`;
    const { data, error } = await supabase.from('equipos_lab').insert({ ...formData, docente_responsable_id: userId, qr_code }).select().single();
    if (!error && data) {
      setEquipos(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setShowModal(false);
    } else {
      setCreateError(error?.message ?? "No se pudo registrar el equipo.");
    }
  };

  const handleAction = async (equipo: Equipo, accion: string) => {
    setActionLoading(`${equipo.id}-${accion}`);
    setActionError(null);
    try {
      const { data, error } = await supabase.functions.invoke('update-equipment-status', { body: { equipo_id: equipo.id, accion } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "La acción no se pudo completar.");
      await fetchAll();
    } catch (e) {
      console.error("Error en acción de equipo:", e);
      setActionError(e instanceof Error ? e.message : "No se pudo completar la acción sobre el equipo.");
    } finally {
      setActionLoading(null);
    }
  };

  const calibVencida = (eq: Equipo) => eq.proxima_calibracion !== null && new Date(eq.proxima_calibracion) < new Date();

  return {
    equipos,
    loading,
    loadError,
    showModal, setShowModal,
    qrEquipo, setQrEquipo,
    actionLoading,
    actionError,
    createError,
    fetchAll,
    handleCreate,
    handleAction,
    calibVencida,
  };
}
