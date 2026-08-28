"use client";

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { GeminiCanvas } from '@/components/ia/GeminiCanvas';
import { useMasterCopilotChat } from '@/components/ia/useMasterCopilotChat';
import {
  Sparkles, Loader2, Zap, BookOpen,
  FlaskConical, MapPin, MessageCircleQuestion
} from 'lucide-react';

const SCOPES = [
  { value: 'DOCENCIA',      label: 'Docencia',       icon: <BookOpen size={16} />,    color: '#1B396A' },
  { value: 'INVESTIGACION', label: 'Investigación',   icon: <Sparkles size={16} />,   color: '#d97706' },
  { value: 'LABORATORIO',   label: 'Laboratorio',     icon: <FlaskConical size={16} />,color: '#10b981' },
  { value: 'CAMPO',         label: 'Campo',           icon: <MapPin size={16} />,     color: '#ea580c' },
];

export default function PaginaCreacionIA() {
  const { id: courseId } = useParams();
  const [prompt, setPrompt] = useState('');
  const [scope, setScope] = useState('DOCENCIA');

  const { messages, loading, executing, errorMsg, send, confirm, discard, reset, activeProposal } =
    useMasterCopilotChat({ scope, courseId: courseId as string });

  const activeScope = SCOPES.find(s => s.value === scope) ?? SCOPES[0];

  const handleSend = () => {
    if (!prompt.trim()) return;
    const text = prompt;
    setPrompt('');
    send(text);
  };

  const handleConfirm = (editedParams: Record<string, unknown>) => {
    if (!activeProposal) return;
    confirm(activeProposal.index, activeProposal.proposal, editedParams);
  };

  const handleDiscard = () => {
    if (!activeProposal) return;
    discard(activeProposal.index);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* HEADER */}
      <header style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '12px' }}>
            <Sparkles size={22} color="#1B396A" />
          </div>
          <h1 style={{ color: '#1B396A', fontSize: '2rem', fontWeight: '950', margin: 0, letterSpacing: '-0.02em' }}>
            Master Copilot · Modo Detallado
          </h1>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: '500', margin: 0 }}>
          Da una instrucción, revisa la propuesta y pide ajustes las veces que necesites — nada se crea en Drive ni en la base de datos hasta que confirmes.
        </p>
      </header>

      {/* PANEL DE DIRECTIVA */}
      <section style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 4px 12px rgba(27,57,106,0.04)' }}>

        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
            Módulo operativo
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {SCOPES.map(s => (
              <button
                key={s.value}
                onClick={() => { setScope(s.value); reset(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '9px 16px', borderRadius: '12px', border: '2px solid',
                  borderColor: scope === s.value ? s.color : '#e2e8f0',
                  backgroundColor: scope === s.value ? `${s.color}10` : 'white',
                  color: scope === s.value ? s.color : '#64748b',
                  fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Historial de la conversación */}
        {messages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f8fafc', borderRadius: '14px', padding: '16px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                {m.role === 'assistant' && <MessageCircleQuestion size={15} color={activeScope.color} style={{ flexShrink: 0, marginTop: '2px' }} />}
                <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: m.role === 'user' ? 700 : 500, color: m.role === 'user' ? '#1e293b' : '#475569' }}>
                  {m.role === 'user' ? 'Tú: ' : ''}{m.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Área de directiva — siempre visible, incluso con una propuesta activa,
            para poder pedir ajustes antes de confirmar */}
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '10px' }}>
            {messages.length === 0 ? 'Directiva para el Master Copilot' : activeProposal ? 'Pide ajustes o responde' : 'Tu respuesta'}
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={messages.length === 0 ? `Ejemplo: Crea una evaluación de la unidad 3 sobre normalización de bases de datos, del lunes 9am al lunes 11am.` : 'Ej: "hazlo más corto" o "cambia el título"...'}
            rows={4}
            style={{
              width: '100%', padding: '16px', borderRadius: '14px',
              border: '1.5px solid #e2e8f0',
              fontSize: '0.95rem', lineHeight: '1.6', outline: 'none',
              resize: 'vertical', fontFamily: 'inherit', color: '#1e293b',
              boxSizing: 'border-box', transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.target.style.borderColor = activeScope.color; }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: activeScope.color, fontWeight: '800' }}>
              Módulo: {activeScope.label}
            </span>
          </div>

          <button
            onClick={handleSend}
            disabled={loading || !prompt.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              width: '100%', padding: '16px', marginTop: '16px',
              backgroundColor: loading || !prompt.trim() ? '#cbd5e1' : activeScope.color,
              color: 'white', border: 'none', borderRadius: '14px',
              fontWeight: '900', fontSize: '1rem', cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              boxShadow: loading || !prompt.trim() ? 'none' : `0 8px 20px ${activeScope.color}30`,
              transition: 'all 0.3s',
            }}
          >
            {loading ? (
              <><Loader2 size={20} className="animate-spin" /> Pensando...</>
            ) : (
              <><Zap size={20} fill="white" /> {messages.length === 0 ? 'Enviar Directiva' : 'Enviar'}</>
            )}
          </button>
        </div>
      </section>

      {/* CANVAS — propuesta concreta lista para confirmar (o seguir ajustando) */}
      {activeProposal && (
        <section>
          <GeminiCanvas
            key={activeProposal.index}
            proposal={activeProposal.proposal}
            onConfirm={handleConfirm}
            onDiscard={handleDiscard}
            executing={executing}
            error={errorMsg}
          />
        </section>
      )}

    </div>
  );
}
