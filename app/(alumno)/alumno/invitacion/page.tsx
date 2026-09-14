'use client';

import { use, Suspense, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  FlaskConical, CheckCircle2, XCircle, Clock,
  Loader2, ShieldAlert, UserCheck, BookOpen, RotateCcw
} from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";

const ROL_INFO: Record<string, { label: string; desc: string; color: string; bg: string }> = {
  capturista: {
    label: 'Capturista de Datos',
    desc: 'Podrás registrar observaciones, capturas de campo y datos de sensores en el proyecto.',
    color: '#2563eb',
    bg: '#eff6ff',
  },
  analista: {
    label: 'Analista',
    desc: 'Podrás insertar datos y acceder a los resultados del proyecto para su análisis.',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  lector: {
    label: 'Lector',
    desc: 'Tendrás acceso de solo lectura a los datos y avances del proyecto.',
    color: '#64748b',
    bg: '#f8fafc',
  },
};

type InvitacionInfo = {
  status: string;
  rol: string;
  expira_en: string;
  expirada: boolean;
  proyecto: { titulo: string; descripcion: string | null };
};

type Estado = 'preview' | 'aceptando' | 'rechazando' | 'aceptada' | 'rechazada' | 'error' | 'expirada' | 'procesada';

type FetchResult =
  | { kind: 'error'; message: string }
  | { kind: 'expirada' }
  | { kind: 'procesada' }
  | { kind: 'preview'; invitacion: InvitacionInfo };

async function callEdge(token: string, accion: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/confirm-invitacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ token_invitacion: token, accion }),
    });
    return await res.json();
  } catch (err) {
    console.error('Error de red al procesar la invitación:', err);
    return { ok: false, error: 'Error de red. Verifica tu conexión e intenta de nuevo.' };
  }
}

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchInvitacion(token: string, _reloadKey: number): Promise<FetchResult> {
  if (!token) return { kind: 'error', message: 'No se encontró token de invitación en la URL.' };

  const data = await callEdge(token, 'preview');
  if (!data) return { kind: 'error', message: 'No hay sesión activa.' };
  if (!data.ok) {
    if (data.status === 'activo' || data.status === 'rechazado') return { kind: 'procesada' };
    return { kind: 'error', message: data.error ?? 'Error desconocido' };
  }
  const inv: InvitacionInfo = data.invitacion;
  if (inv.expirada) return { kind: 'expirada' };
  if (inv.status === 'activo' || inv.status === 'rechazado') return { kind: 'procesada' };
  return { kind: 'preview', invitacion: inv };
}

function InvitacionContent({ resource, token, onRetry }: { resource: Promise<FetchResult>; token: string; onRetry: () => void }) {
  const result = use(resource);
  const router = useRouter();

  const initialEstado: Estado = result.kind === 'error' ? 'error' : result.kind === 'expirada' ? 'expirada' : result.kind === 'procesada' ? 'procesada' : 'preview';
  const [estado, setEstado] = useState<Estado>(initialEstado);
  const [invitacion] = useState<InvitacionInfo | null>(result.kind === 'preview' ? result.invitacion : null);
  const [errorMsg] = useState(result.kind === 'error' ? result.message : '');

  const handleAceptar = async () => {
    setEstado('aceptando');
    const data = await callEdge(token, 'aceptar');
    if (data?.ok) { setEstado('aceptada'); }
    else { setEstado('error'); }
  };

  const handleRechazar = async () => {
    setEstado('rechazando');
    const data = await callEdge(token, 'rechazar');
    if (data?.ok) setEstado('rechazada');
    else { setEstado('error'); }
  };

  // ── Renders por estado ──────────────────────────────────────────────────

  if (estado === 'aceptando' || estado === 'rechazando') {
    return (
      <Screen>
        <Loader2 size={48} className="animate-spin" style={{ color: '#1B396A' }} />
        <p style={{ color: '#64748b', fontWeight: '700', marginTop: '16px' }}>
          {estado === 'aceptando' ? 'Aceptando invitación...' : 'Procesando...'}
        </p>
      </Screen>
    );
  }

  if (estado === 'error') {
    return (
      <Screen>
        <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '20px', borderRadius: '20px', maxWidth: '500px', textAlign: 'center' }}>
          <ShieldAlert size={40} style={{ margin: '0 auto 12px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: '900' }}>Invitación inválida</h2>
          <p style={{ margin: 0, fontWeight: '600', fontSize: '0.95rem' }}>{errorMsg}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} expanded size={44} radius={14} gap={8} padding="0 20px" fontWeight={700} fontSize="0.9rem" durationMs={300} colors={{ bg: "white", hoverBg: "#f8fafc", text: "#64748b", hoverText: "#64748b", border: "#e2e8f0" }} />
          <button onClick={() => router.push('/alumno')} style={btnSecondary}>
            Ir al inicio
          </button>
        </div>
      </Screen>
    );
  }

  if (estado === 'expirada') {
    return (
      <Screen>
        <div style={{ backgroundColor: '#fff7ed', color: '#c2410c', padding: '24px 32px', borderRadius: '20px', maxWidth: '480px', textAlign: 'center' }}>
          <Clock size={40} style={{ margin: '0 auto 12px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: '900' }}>Invitación expirada</h2>
          <p style={{ margin: 0, fontWeight: '600', fontSize: '0.9rem' }}>
            Esta invitación ya no es válida. Solicita al docente que te envíe una nueva.
          </p>
        </div>
        <button onClick={() => router.push('/alumno')} style={btnSecondary}>
          Ir al inicio
        </button>
      </Screen>
    );
  }

  if (estado === 'procesada') {
    return (
      <Screen>
        <div style={{ backgroundColor: '#f0fdf4', color: '#15803d', padding: '24px 32px', borderRadius: '20px', maxWidth: '480px', textAlign: 'center' }}>
          <CheckCircle2 size={40} style={{ margin: '0 auto 12px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: '900' }}>Invitación ya procesada</h2>
          <p style={{ margin: 0, fontWeight: '600', fontSize: '0.9rem' }}>
            Ya respondiste a esta invitación anteriormente.
          </p>
        </div>
        <button onClick={() => router.push('/alumno')} style={btnSecondary}>
          Ir al inicio
        </button>
      </Screen>
    );
  }

  if (estado === 'aceptada') {
    return (
      <Screen>
        <div style={{ backgroundColor: '#f0fdf4', padding: '40px', borderRadius: '28px', maxWidth: '480px', textAlign: 'center', border: '1px solid #bbf7d0' }}>
          <UserCheck size={52} color="#16a34a" style={{ margin: '0 auto 16px' }} />
          <h1 style={{ color: '#15803d', fontSize: '1.8rem', fontWeight: '950', margin: '0 0 8px' }}>¡Bienvenido al proyecto!</h1>
          <p style={{ color: '#166534', fontWeight: '600', fontSize: '0.95rem', margin: '0 0 24px' }}>
            Ya eres parte del equipo de investigación. Puedes empezar a contribuir.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={() => router.push('/alumno')} style={btnPrimary}>
              Ir a mis proyectos
            </button>
          </div>
        </div>
      </Screen>
    );
  }

  if (estado === 'rechazada') {
    return (
      <Screen>
        <div style={{ backgroundColor: '#f8fafc', padding: '40px', borderRadius: '28px', maxWidth: '480px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <XCircle size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: '#475569', fontSize: '1.4rem', fontWeight: '900', margin: '0 0 8px' }}>Invitación rechazada</h2>
          <p style={{ color: '#94a3b8', fontWeight: '600', fontSize: '0.9rem', margin: '0 0 24px' }}>
            Has declinado la invitación. Si cambias de opinión, pide al docente que te invite de nuevo.
          </p>
          <button onClick={() => router.push('/alumno')} style={btnSecondary}>
            Ir al inicio
          </button>
        </div>
      </Screen>
    );
  }

  // ── Estado principal: preview ───────────────────────────────────────────
  const rolInfo = ROL_INFO[invitacion?.rol ?? 'lector'] ?? ROL_INFO.lector;

  return (
    <Screen>
      <div style={{ backgroundColor: 'white', borderRadius: '28px', border: '1px solid #e2e8f0', padding: '40px', maxWidth: '540px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>

        {/* Logo / Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '14px' }}>
            <FlaskConical size={28} color="#1B396A" />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Plataforma EUI Research
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '900', color: '#1B396A' }}>Invitación a Proyecto</div>
          </div>
        </div>

        {/* Nombre del proyecto */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Proyecto de investigación
          </div>
          <h1 style={{ color: '#1B396A', fontSize: '1.5rem', fontWeight: '950', margin: '0 0 8px', lineHeight: 1.2 }}>
            {invitacion?.proyecto.titulo}
          </h1>
          {invitacion?.proyecto.descripcion && (
            <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '500', margin: 0, lineHeight: 1.5 }}>
              {invitacion.proyecto.descripcion}
            </p>
          )}
        </div>

        {/* Chip de rol */}
        <div style={{ backgroundColor: rolInfo.bg, borderRadius: '16px', padding: '16px 20px', marginBottom: '28px', border: `1px solid ${rolInfo.color}20` }}>
          <div style={{ fontSize: '0.7rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Tu rol en el proyecto
          </div>
          <div style={{ fontWeight: '900', color: rolInfo.color, fontSize: '1.05rem', marginBottom: '6px' }}>
            {rolInfo.label}
          </div>
          <p style={{ color: '#475569', fontSize: '0.85rem', fontWeight: '500', margin: 0 }}>{rolInfo.desc}</p>
        </div>

        {/* Aviso de limitaciones */}
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px 16px', marginBottom: '28px', display: 'flex', gap: '10px' }}>
          <BookOpen size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#92400e', fontWeight: '600', lineHeight: 1.5 }}>
            Como colaborador externo, solo tendrás acceso a funciones básicas de captura y visualización.
            Las herramientas de IA y la gestión del proyecto son exclusivas del investigador principal.
          </p>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleRechazar} style={{ ...btnSecondary, flex: '0 0 auto' }}>
            Rechazar
          </button>
          <button onClick={handleAceptar} style={{ ...btnPrimary, flex: 1 }}>
            <CheckCircle2 size={18} /> Aceptar invitación
          </button>
        </div>

        {/* Expiración */}
        {invitacion?.expira_en && (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600', marginTop: '16px', marginBottom: 0 }}>
            Esta invitación vence el {new Date(invitacion.expira_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', backgroundColor: '#f8fafc', padding: '32px 16px' }}>
      {children}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  backgroundColor: '#1B396A', color: 'white', border: 'none',
  padding: '14px 20px', borderRadius: '14px', fontWeight: '800',
  fontSize: '0.95rem', cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'white', color: '#64748b', border: '1px solid #e2e8f0',
  padding: '14px 20px', borderRadius: '14px', fontWeight: '700',
  fontSize: '0.9rem', cursor: 'pointer',
};

function InvitacionLoader() {
  // useSearchParams() requiere estar dentro de un límite de Suspense (lo
  // provee el default export) para poder prerenderizar la página.
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchInvitacion(token, reloadKey), [token, reloadKey]);

  return (
    <Suspense fallback={
      <Screen>
        <Loader2 size={48} className="animate-spin" style={{ color: '#1B396A' }} />
        <p style={{ color: '#64748b', fontWeight: '700', marginTop: '16px' }}>Cargando invitación...</p>
      </Screen>
    }>
      <InvitacionContent key={reloadKey} resource={resource} token={token} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}

export default function InvitacionColaborador() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }} />}>
      <InvitacionLoader />
    </Suspense>
  );
}
