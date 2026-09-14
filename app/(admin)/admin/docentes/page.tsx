'use client';

import React, { use, useState, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, UserPlus, X, Save, Users, ShieldCheck, RotateCcw } from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";

type Docente = { id: string; first_name: string; last_name: string; access_level: number | null };
type DocentesResult = { ok: true; docentes: Docente[] } | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchDocentes(_reloadKey: number): Promise<DocentesResult> {
  const { data: res, error: invokeError } = await supabase.functions.invoke('admin-overview', { body: {} });
  if (invokeError || !res?.success) {
    return { ok: false, error: res?.error || invokeError?.message || 'No se pudo cargar la lista de docentes.' };
  }
  return { ok: true, docentes: res.docentes as Docente[] };
}

function DocentesList({ resource, onRetry }: { resource: Promise<DocentesResult>; onRetry: () => void }) {
  const result = use(resource);

  if (!result.ok) return (
    <div className="bg-red-50 border border-red-200 rounded-[20px] p-6 text-red-600 font-semibold flex items-center justify-between gap-4">
      {result.error}
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={40} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const docentes = result.docentes;

  return (
    <>
      <p className="text-slate-500 font-medium -mt-4">Total: {docentes.length}</p>
      <div className="bg-white rounded-[20px] border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {docentes.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-blue-500" />
              <span className="font-bold text-slate-700">{d.first_name} {d.last_name}</span>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase">Nivel de acceso {d.access_level ?? 3}</span>
          </div>
        ))}
        {docentes.length === 0 && <div className="p-8 text-center text-slate-400">No hay docentes registrados.</div>}
      </div>
    </>
  );
}

export default function AdminDocentes() {
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', access_level: '3' });
  const [feedback, setFeedback] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchDocentes(reloadKey), [reloadKey]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback('');
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-account', {
        body: { ...form, access_level: parseInt(form.access_level, 10), role: 'docente' },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'No se pudo crear la cuenta.');
      setFeedback(`Cuenta creada y correo de invitación enviado a ${form.email}.`);
      setForm({ email: '', first_name: '', last_name: '', access_level: '3' });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setFeedback(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <header className="flex justify-between items-end">
        <h1 className="text-3xl font-black text-[#0f172a] tracking-tight flex items-center gap-3">
          <Users /> Docentes
        </h1>
        <ExpandingButton icon={UserPlus} label="Agregar Docente" onClick={() => { setShowModal(true); setFeedback(''); }} size={44} radius={14} gap={8} padding="0 20px" fontWeight={800} fontSize="0.9rem" durationMs={300} colors={{ bg: "#0f172a", hoverBg: "#1e293b", text: "white", hoverText: "white", border: "transparent" }} />
      </header>

      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#0f172a]" size={40} /></div>}>
        <DocentesList resource={resource} onRetry={() => setReloadKey((k) => k + 1)} />
      </Suspense>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-[24px] p-8 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-[#0f172a]">Nuevo Docente</h2>
              <button onClick={() => setShowModal(false)}><X size={22} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <input required type="email" placeholder="Correo institucional" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-300 rounded-[12px] px-4 py-3 outline-none focus:border-[#0f172a]" />
              <div className="flex gap-3">
                <input required placeholder="Nombre(s)" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full border border-slate-300 rounded-[12px] px-4 py-3 outline-none focus:border-[#0f172a]" />
                <input required placeholder="Apellidos" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full border border-slate-300 rounded-[12px] px-4 py-3 outline-none focus:border-[#0f172a]" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Nivel de acceso</label>
                <select value={form.access_level} onChange={(e) => setForm({ ...form, access_level: e.target.value })} className="w-full border border-slate-300 rounded-[12px] px-4 py-3 outline-none focus:border-[#0f172a]">
                  <option value="1">1 — Acceso total (Investigación, Laboratorio, Campo)</option>
                  <option value="2">2 — Investigación</option>
                  <option value="3">3 — Solo Docencia</option>
                </select>
              </div>
              {feedback && <p className={`text-sm font-semibold ${feedback.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>{feedback}</p>}
              <ExpandingButton icon={Save} label="Crear Cuenta" loading={isSaving} loadingLabel="Creando..." type="submit" disabled={isSaving} expanded fullWidth size={48} radius={14} gap={8} padding="0 16px" fontWeight={800} durationMs={300} colors={{ bg: "#0f172a", hoverBg: "#1e293b", text: "white", hoverText: "white", border: "transparent" }} />
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
