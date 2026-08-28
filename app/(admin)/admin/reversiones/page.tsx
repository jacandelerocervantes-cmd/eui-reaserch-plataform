'use client';

import React, { use, useState, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, RotateCcw, Lock, BookOpen, FileX, Users2 } from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";

type ClosedExam = { id: string; title: string; course_units: { title: string; courses: { title: string } | null } | null };
type ClosedUnit = { id: string; unit_number: number; title: string; courses: { title: string } | null };
type LockedSubmission = { id: string; students: { nombres: string; apellido_paterno: string } | null; assignments: { title: string; courses: { title: string } | null } | null };
type LockedTeam = { id: string; name: string; assignments: { title: string; courses: { title: string } | null } | null };

type ReversionesData = {
  closedExams: ClosedExam[];
  closedUnits: ClosedUnit[];
  lockedSubmissions: LockedSubmission[];
  lockedTeams: LockedTeam[];
};

type FetchResult = { ok: true; data: ReversionesData } | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchReversiones(_reloadKey: number): Promise<FetchResult> {
  const { data: res, error: invokeError } = await supabase.functions.invoke('admin-overview', { body: {} });
  if (invokeError || !res?.success) {
    return { ok: false, error: res?.error || invokeError?.message || 'No se pudo cargar la lista de reversiones.' };
  }
  return { ok: true, data: res.reversiones };
}

function ReversionesContent({ resource, onRetry }: { resource: Promise<FetchResult>; onRetry: () => void }) {
  const result = use(resource);
  const [reverting, setReverting] = useState<string | null>(null);

  if (!result.ok || !result.data) return (
    <div className="bg-red-50 border border-red-200 rounded-[20px] p-8 text-red-600 font-semibold flex items-center justify-between gap-4">
      {result.ok ? 'No se pudo cargar la información de reversiones.' : result.error}
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={40} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { data } = result;

  const handleRevert = async (action: string, id: string) => {
    setReverting(id);
    try {
      const { data: res, error } = await supabase.functions.invoke('admin-revert-action', { body: { action, id } });
      if (error || !res?.success) throw new Error(res?.error || error?.message || 'No se pudo revertir.');
      onRetry();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReverting(null);
    }
  };

  const isEmpty = data.closedExams.length === 0 && data.closedUnits.length === 0 && data.lockedSubmissions.length === 0 && data.lockedTeams.length === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-black text-[#0f172a] tracking-tight flex items-center gap-3">
          <RotateCcw /> Reversiones
        </h1>
        <p className="text-slate-500 font-medium mt-1">
          Acciones que un docente no puede deshacer por sí mismo. Solo cambia el estado en la base de datos —
          si también se revocó acceso de edición en Drive, puede que el docente necesite volver a compartir el archivo manualmente.
        </p>
      </header>

      {isEmpty ? (
        <div className="bg-white rounded-[20px] border border-slate-200 p-10 text-center text-slate-400">No hay nada pendiente de revertir.</div>
      ) : (
        <div className="space-y-6">
          {data.closedExams.length > 0 && (
            <Seccion title="Exámenes cerrados" icon={BookOpen}>
              {data.closedExams.map((e) => (
                <Fila key={e.id} title={e.title} subtitle={`${e.course_units?.courses?.title ?? ''} · ${e.course_units?.title ?? ''}`}>
                  <BotonRevertir loading={reverting === e.id} onClick={() => handleRevert('reopen_exam', e.id)} label="Reabrir" />
                </Fila>
              ))}
            </Seccion>
          )}

          {data.closedUnits.length > 0 && (
            <Seccion title="Unidades cerradas" icon={Lock}>
              {data.closedUnits.map((u) => (
                <Fila key={u.id} title={`U${u.unit_number}: ${u.title}`} subtitle={u.courses?.title ?? ''}>
                  <BotonRevertir loading={reverting === u.id} onClick={() => handleRevert('reopen_unit', u.id)} label="Reabrir" />
                </Fila>
              ))}
            </Seccion>
          )}

          {data.lockedSubmissions.length > 0 && (
            <Seccion title="Entregas bloqueadas" icon={FileX}>
              {data.lockedSubmissions.map((s) => (
                <Fila key={s.id} title={`${s.students?.nombres ?? ''} ${s.students?.apellido_paterno ?? ''}`} subtitle={`${s.assignments?.courses?.title ?? ''} · ${s.assignments?.title ?? ''}`}>
                  <BotonRevertir loading={reverting === s.id} onClick={() => handleRevert('unlock_submission', s.id)} label="Desbloquear" />
                </Fila>
              ))}
            </Seccion>
          )}

          {data.lockedTeams.length > 0 && (
            <Seccion title="Equipos bloqueados" icon={Users2}>
              {data.lockedTeams.map((t) => (
                <Fila key={t.id} title={t.name} subtitle={`${t.assignments?.courses?.title ?? ''} · ${t.assignments?.title ?? ''}`}>
                  <BotonRevertir loading={reverting === t.id} onClick={() => handleRevert('unlock_team', t.id)} label="Desbloquear" />
                </Fila>
              ))}
            </Seccion>
          )}
        </div>
      )}
    </div>
  );
}

function Seccion({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2"><Icon size={18} /> {title}</h2>
      <div className="bg-white rounded-[20px] border border-slate-200 divide-y divide-slate-100 overflow-hidden">{children}</div>
    </section>
  );
}

function Fila({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <p className="font-bold text-slate-700 text-sm">{title}</p>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function BotonRevertir({ loading, onClick, label }: { loading: boolean; onClick: () => void; label: string }) {
  return (
    <ExpandingButton
      icon={RotateCcw}
      label={label}
      loading={loading}
      onClick={onClick}
      expanded
      small
      smallSize={34}
      radius={10}
      gap={6}
      padding="0 16px"
      fontWeight={800}
      fontSize="0.85rem"
      durationMs={300}
      colors={{ bg: "#fffbeb", hoverBg: "#fef3c7", text: "#b45309", hoverText: "#b45309", border: "#fde68a" }}
    />
  );
}

export default function AdminReversiones() {
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchReversiones(reloadKey), [reloadKey]);

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[#0f172a]" size={48} /></div>}>
      <ReversionesContent key={reloadKey} resource={resource} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
