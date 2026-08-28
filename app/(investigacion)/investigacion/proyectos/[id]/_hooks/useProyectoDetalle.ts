import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type Proyecto = {
  id: string;
  titulo: string;
  descripcion: string | null;
  is_public: boolean;
  estado: string | null;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
  doi_link: string | null;
  tags: string[] | null;
};
export type Colaborador = { id: string; correo_invitado: string; rol: string; status: string; invitado_en: string; aceptado_en: string | null; alumno_id: string | null };

export type FetchResult =
  | { kind: "ok"; proyecto: Proyecto; colaboradores: Colaborador[] }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchProyecto(proyectoId: string, router: ReturnType<typeof useRouter>, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return { kind: "redirect" }; }

    const [projRes, collabRes] = await Promise.all([
      supabase
        .from('proyectos_investigacion')
        .select('*')
        .eq('id', proyectoId)
        .eq('investigador_principal_id', user.id)
        .single(),
      supabase
        .from('proyecto_colaboradores')
        .select('id, correo_invitado, rol, status, invitado_en, aceptado_en, alumno_id')
        .eq('proyecto_id', proyectoId)
        .order('invitado_en', { ascending: false }),
    ]);

    // projRes.error distingue "no existe / no es tuyo" (código PGRST116 de
    // .single() sin filas) de una falla real de red — solo redirigimos en
    // el primer caso, para no sacar al usuario por un simple hipo de conexión.
    if (projRes.error) {
      if (projRes.error.code === 'PGRST116') {
        router.push('/investigacion/proyectos');
        return { kind: "redirect" };
      }
      throw projRes.error;
    }
    if (collabRes.error) throw collabRes.error;

    return { kind: "ok", proyecto: projRes.data as Proyecto, colaboradores: (collabRes.data ?? []) as Colaborador[] };
  } catch (e) {
    console.error("Error cargando proyecto:", e);
    return { kind: "error", message: e instanceof Error ? e.message : "No se pudo cargar el proyecto." };
  }
}

// Hook orquestador: resuelve el recurso de datos (patrón use()+Suspense con recarga manual).
export function useProyectoDetalle(proyectoId: string) {
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchProyecto(proyectoId, router, reloadKey), [proyectoId, router, reloadKey]);

  return {
    resource,
    reloadKey,
    onReload: () => setReloadKey((k) => k + 1),
  };
}

// Hook de la vista de contenido: consume el recurso, guarda estado local y expone
// los handlers que hacen llamadas a Supabase (invitar / eliminar colaborador).
export function useProyectoDetalleContent(resource: Promise<FetchResult>, proyectoId: string, onReload: () => void) {
  const result = use(resource);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState('capturista');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>(result.kind === "ok" ? result.colaboradores : []);

  const handleInvitar = async () => {
    if (!correo.trim()) return;
    setSending(true);
    setSendMsg(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSending(false); setSendMsg({ type: 'err', text: 'Tu sesión expiró, recarga la página.' }); return; }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-colaborador`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ proyecto_id: proyectoId, correo_invitado: correo.trim(), rol }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setSendMsg({ type: 'ok', text: `Invitación enviada a ${data.correo_invitado}` });
        setCorreo('');
        setRol('capturista');
        setShowInviteForm(false);
        onReload();
      } else {
        setSendMsg({ type: 'err', text: data.error ?? 'Error al enviar' });
      }
    } catch {
      setSendMsg({ type: 'err', text: 'Error de red' });
    } finally {
      setSending(false);
    }
  };

  const handleEliminar = async (colabId: string) => {
    setDeleteError(null);
    const { error } = await supabase.from('proyecto_colaboradores').delete().eq('id', colabId);
    if (error) {
      console.error("Error eliminando colaborador:", error);
      setDeleteError(error.message ?? "No se pudo eliminar al colaborador.");
      return;
    }
    setColaboradores(prev => prev.filter(c => c.id !== colabId));
  };

  const activos = colaboradores.filter(c => c.status === 'activo').length;
  const pendientes = colaboradores.filter(c => c.status === 'pendiente').length;

  return {
    result,
    onReload,
    showInviteForm, setShowInviteForm,
    correo, setCorreo,
    rol, setRol,
    sending,
    sendMsg, setSendMsg,
    deleteError,
    colaboradores,
    handleInvitar,
    handleEliminar,
    activos,
    pendientes,
  };
}
