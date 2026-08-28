'use client';

import { use, useState, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, GraduationCap, Search, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";

type AlumnoOverview = { nombre: string; correo: string | null; tieneCuenta: boolean; materias: string[] };
type AlumnosResult = { ok: true; alumnos: AlumnoOverview[] } | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
// El parámetro _reloadKey no se usa en el cuerpo: existe para que useMemo()
// en el componente sepa que debe generar una promesa nueva al reintentar.
async function fetchAlumnos(_reloadKey: number): Promise<AlumnosResult> {
  const { data: res, error: invokeError } = await supabase.functions.invoke('admin-overview', { body: {} });
  if (invokeError || !res?.success) {
    return { ok: false, error: res?.error || invokeError?.message || 'No se pudo cargar la lista de alumnos.' };
  }
  return { ok: true, alumnos: res.alumnos as AlumnoOverview[] };
}

function AlumnosList({ resource, onRetry }: { resource: Promise<AlumnosResult>; onRetry: () => void }) {
  const result = use(resource);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'con_cuenta' | 'sin_cuenta'>('todos');

  if (!result.ok) return (
    <div className="bg-red-50 border border-red-200 rounded-[20px] p-8 text-red-600 font-semibold flex items-center justify-between gap-4">
      {result.error}
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={40} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const alumnos = result.alumnos;
  const filtered = alumnos
    .filter((a) => a.nombre.toLowerCase().includes(search.toLowerCase()) || (a.correo ?? '').toLowerCase().includes(search.toLowerCase()))
    .filter((a) => filtro === 'todos' || (filtro === 'con_cuenta' ? a.tieneCuenta : !a.tieneCuenta));

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-black text-[#0f172a] tracking-tight flex items-center gap-3">
          <GraduationCap /> Alumnos
        </h1>
        <p className="text-slate-500 font-medium mt-1">{alumnos.length} alumnos únicos en toda la plataforma (un alumno puede estar en varias materias)</p>
      </header>

      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o correo..." className="w-full border border-slate-300 rounded-[12px] pl-11 pr-4 py-3 outline-none focus:border-[#0f172a]" />
        </div>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as 'todos' | 'con_cuenta' | 'sin_cuenta')} className="border border-slate-300 rounded-[12px] px-4 py-3 outline-none">
          <option value="todos">Todos</option>
          <option value="con_cuenta">Con cuenta</option>
          <option value="sin_cuenta">Sin cuenta</option>
        </select>
      </div>

      <div className="bg-white rounded-[20px] border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {filtered.map((a, i) => (
          <div key={i} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-bold text-slate-700">{a.nombre || 'Sin nombre'}</p>
              <p className="text-xs text-slate-400">{a.correo ?? 'Sin correo registrado'} · {a.materias.join(', ')}</p>
            </div>
            {a.tieneCuenta ? (
              <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold"><CheckCircle2 size={14} /> Con cuenta</span>
            ) : (
              <span className="flex items-center gap-1 text-red-500 text-xs font-bold"><XCircle size={14} /> Sin cuenta</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="p-8 text-center text-slate-400">No hay alumnos que coincidan.</div>}
      </div>
    </div>
  );
}

export default function AdminAlumnos() {
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchAlumnos(reloadKey), [reloadKey]);

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[#0f172a]" size={48} /></div>}>
      <AlumnosList resource={resource} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
