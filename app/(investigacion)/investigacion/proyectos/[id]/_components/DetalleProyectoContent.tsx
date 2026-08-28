"use client";

import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, Mail, Plus, Loader2,
  CheckCircle2, Clock, XCircle, Trash2,
  Globe, AlertCircle, Send, RotateCcw
} from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";
import { useProyectoDetalleContent, type FetchResult } from "../_hooks/useProyectoDetalle";

const ROL_OPTIONS = [
  { value: 'capturista', label: 'Capturista de datos', desc: 'Puede insertar datos: campo, bitácora, sensores' },
  { value: 'analista',   label: 'Analista',            desc: 'Insertar datos + ver resultados del proyecto' },
  { value: 'lector',     label: 'Lector',              desc: 'Solo visualización de datos y avances' },
];

const STATUS_STYLE: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  pendiente: { icon: <Clock size={13} />,        label: 'Pendiente', color: '#d97706', bg: '#fef3c7' },
  activo:    { icon: <CheckCircle2 size={13} />, label: 'Activo',    color: '#059669', bg: '#ecfdf5' },
  rechazado: { icon: <XCircle size={13} />,      label: 'Rechazado', color: '#dc2626', bg: '#fef2f2' },
};

export default function DetalleProyectoContent({
  resource, proyectoId, onReload,
}: { resource: Promise<FetchResult>; proyectoId: string; onReload: () => void }) {
  const c = useProyectoDetalleContent(resource, proyectoId, onReload);
  const router = useRouter();

  if (c.result.kind === "redirect") return (
    <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={40} className="animate-spin" style={{ color: '#1B396A' }} />
    </div>
  );

  if (c.result.kind === "error") return (
    <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      <p style={{ color: '#ef4444', fontWeight: '700' }}>{c.result.message}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onReload} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { proyecto } = c.result;

  return (
    <div style={{ padding: '40px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* HEADER */}
      <header>
        <button
          onClick={() => router.push('/investigacion/proyectos')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '16px' }}
        >
          <ArrowLeft size={16} /> Volver al portafolio
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '3px 10px', borderRadius: '8px', fontWeight: '900', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Mundo Dorado
              </span>
              {proyecto.is_public && (
                <span style={{ backgroundColor: '#f0fdf4', color: '#15803d', padding: '3px 10px', borderRadius: '8px', fontWeight: '800', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={11} /> Público
                </span>
              )}
            </div>
            <h1 style={{ color: '#1B396A', fontSize: '2.2rem', fontWeight: '950', margin: '0 0 6px', lineHeight: 1.2 }}>
              {proyecto.titulo}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: '500', margin: 0 }}>
              {proyecto.descripcion ?? 'Sin descripción registrada.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginLeft: '24px', flexShrink: 0 }}>
            <div style={{ textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px 24px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#1B396A' }}>{c.activos}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Activos</div>
            </div>
            <div style={{ textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '16px 24px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#d97706' }}>{c.pendientes}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Pendientes</div>
            </div>
          </div>
        </div>
      </header>

      {/* PANEL DE COLABORADORES */}
      <section style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#1B396A', fontSize: '1.2rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} color="#1B396A" /> Colaboradores
          </h2>
          <ExpandingButton
            icon={Plus}
            label="Invitar colaborador"
            onClick={() => { c.setShowInviteForm(v => !v); c.setSendMsg(null); }}
            variant="primary"
            expanded
            size={40}
            radius={12}
            gap={8}
            padding="0 18px"
            fontWeight={800}
            fontSize="0.9rem"
            durationMs={300}
          />
        </div>

        {/* Formulario de invitación */}
        {c.showInviteForm && (
          <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
            <h3 style={{ margin: '0 0 16px', color: '#1B396A', fontSize: '1rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={16} /> Nueva invitación
            </h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Correo del alumno
                </label>
                <input
                  type="email"
                  value={c.correo}
                  onChange={e => c.setCorreo(e.target.value)}
                  placeholder="alumno@universidad.edu.mx"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '0 1 200px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Rol
                </label>
                <select
                  value={c.rol}
                  onChange={e => c.setRol(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', backgroundColor: 'white' }}
                >
                  {ROL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <ExpandingButton
                icon={Send}
                label="Enviar invitación"
                loading={c.sending}
                loadingLabel="Enviando..."
                onClick={c.handleInvitar}
                disabled={c.sending || !c.correo.trim()}
                expanded
                size={44}
                radius={12}
                gap={8}
                padding="0 20px"
                fontWeight={800}
                fontSize="0.9rem"
                durationMs={300}
                colors={{ bg: "#10b981", hoverBg: "#059669", text: "white", hoverText: "white", border: "transparent" }}
              />
            </div>

            {/* Descripción del rol seleccionado */}
            <div style={{ marginTop: '10px', fontSize: '0.82rem', color: '#64748b', fontWeight: '600' }}>
              {ROL_OPTIONS.find(o => o.value === c.rol)?.desc}
            </div>

            {c.sendMsg && (
              <div style={{ marginTop: '12px', padding: '10px 16px', borderRadius: '10px', backgroundColor: c.sendMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2', color: c.sendMsg.type === 'ok' ? '#15803d' : '#dc2626', fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {c.sendMsg.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {c.sendMsg.text}
              </div>
            )}
          </div>
        )}

        {/* Lista de colaboradores */}
        {c.deleteError && (
          <div style={{ margin: '16px 28px 0', backgroundColor: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', fontWeight: '600', fontSize: '0.85rem' }}>
            {c.deleteError}
          </div>
        )}
        {c.colaboradores.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <Users size={40} style={{ marginBottom: '12px' }} />
            <p style={{ fontWeight: '600', margin: 0 }}>Aún no hay colaboradores en este proyecto.</p>
          </div>
        ) : (
          <div>
            {c.colaboradores.map((col, i) => {
              const st = STATUS_STYLE[col.status] ?? STATUS_STYLE.pendiente;
              const rolInfo = ROL_OPTIONS.find(r => r.value === col.rol);
              return (
                <div
                  key={col.id}
                  style={{ padding: '16px 28px', borderBottom: i < c.colaboradores.length - 1 ? '1px solid #f8fafc' : 'none', display: 'flex', alignItems: 'center', gap: '16px' }}
                >
                  {/* Avatar */}
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#1B396A', fontSize: '1rem', flexShrink: 0 }}>
                    {col.correo_invitado[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.95rem' }}>{col.correo_invitado}</div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600', marginTop: '2px' }}>
                      {rolInfo?.label ?? col.rol} •{' '}
                      Invitado el {new Date(col.invitado_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Status chip */}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: '900', padding: '4px 10px', borderRadius: '10px', backgroundColor: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                    {st.icon} {st.label}
                  </span>

                  {/* Eliminar */}
                  <button
                    onClick={() => c.handleEliminar(col.id)}
                    title="Eliminar colaborador"
                    style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '4px', borderRadius: '6px', transition: 'color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* DETALLES DEL PROYECTO */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <InfoCard label="Estado" value={proyecto.estado ?? 'No definido'} />
        <InfoCard label="Inicio" value={proyecto.fecha_inicio ? new Date(proyecto.fecha_inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
        <InfoCard label="Fin estimado" value={proyecto.fecha_fin_estimada ? new Date(proyecto.fecha_fin_estimada).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'} />
        <InfoCard label="DOI / Publicación" value={proyecto.doi_link ?? 'No registrado'} />
        {(proyecto.tags?.length ?? 0) > 0 && (
          <div style={{ gridColumn: '1 / -1', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px 24px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Etiquetas</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {proyecto.tags?.map((t) => (
                <span key={t} style={{ fontSize: '0.78rem', fontWeight: '800', backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: '8px' }}>{t}</span>
              ))}
            </div>
          </div>
        )}
      </section>

    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px 24px' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.95rem' }}>{value}</div>
    </div>
  );
}
