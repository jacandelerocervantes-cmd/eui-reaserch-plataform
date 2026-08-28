'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, School, Users, GraduationCap, UserX, Sparkles, CheckCircle2, XCircle } from 'lucide-react';

type AdminOverviewData = {
  counts: { courses: number; docentes: number; alumnosUnicos: number; alumnosConCuenta: number; alumnosSinCuenta: number };
  recentActions: {
    id: string; success: boolean; tool_name: string; created_at: string;
    profiles: { first_name: string | null; last_name: string | null } | null;
    courses: { title: string } | null;
  }[];
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: res, error: invokeError } = await supabase.functions.invoke('admin-overview', { body: {} });
      if (invokeError || !res?.success) {
        setError(res?.error || invokeError?.message || 'No se pudo cargar el estado general.');
      } else {
        setData(res as AdminOverviewData);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[#0f172a]" size={48} /></div>
  );

  if (error || !data) return (
    <div className="bg-red-50 border border-red-200 rounded-[20px] p-8 text-red-600 font-semibold">{error || 'No se pudo cargar el estado general.'}</div>
  );

  const c = data.counts;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Estado General</h1>
        <p className="text-slate-500 font-medium mt-1">Control Maestro de la plataforma</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={School} label="Materias" value={c.courses} color="#2563eb" />
        <StatCard icon={Users} label="Docentes" value={c.docentes} color="#1B396A" />
        <StatCard icon={GraduationCap} label="Alumnos únicos" value={c.alumnosUnicos} color="#7c3aed" />
        <StatCard icon={CheckCircle2} label="Con cuenta" value={c.alumnosConCuenta} color="#16a34a" />
        <StatCard icon={UserX} label="Sin cuenta" value={c.alumnosSinCuenta} color="#dc2626" />
      </div>

      <section>
        <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
          <Sparkles size={20} className="text-violet-500" /> Actividad reciente del Master Copilot
        </h2>
        {data.recentActions.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-slate-200 p-8 text-center text-slate-400">Sin actividad registrada todavía.</div>
        ) : (
          <div className="bg-white rounded-[20px] border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {data.recentActions.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  {a.success ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-red-500" />}
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{a.tool_name}</p>
                    <p className="text-xs text-slate-400">
                      {a.profiles ? `${a.profiles.first_name ?? ''} ${a.profiles.last_name ?? ''}`.trim() : 'Docente'} · {a.courses?.title ?? 'Sin materia'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {new Date(a.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-[20px] border border-slate-200 p-5">
      <Icon size={22} style={{ color }} className="mb-3" />
      <div className="text-3xl font-black text-slate-800">{value}</div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}
