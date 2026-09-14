"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Sparkles, X, Send, Bell, ClipboardList,
  FileText, Loader2, ShieldCheck, AlertCircle, Maximize2, Check, Ban
} from 'lucide-react';
import { useMasterCopilotChat } from './useMasterCopilotChat';
import styles from './FloatingCopilot.module.css';

interface Props {
  forceOpen?: boolean;
  onClose?: () => void;
  scope?: string;
}

const SCOPE_COLORS: Record<string, string> = {
  DOCENCIA:      '#1B396A',
  INVESTIGACION: '#d97706',
  LABORATORIO:   '#10b981',
  CAMPO:         '#ea580c',
};

const QUICK_ACTIONS: Record<string, { label: string; icon: React.ReactNode; cmd: string }[]> = {
  DOCENCIA: [
    { label: 'Aviso',      icon: <Bell size={13}/>,        cmd: 'Publica un aviso sobre...' },
    { label: 'Evaluación', icon: <FileText size={13}/>,    cmd: 'Crea una evaluación de la unidad sobre...' },
    { label: 'Actividad',  icon: <ClipboardList size={13}/>, cmd: 'Crea una actividad para que entreguen...' },
  ],
  INVESTIGACION: [],
  LABORATORIO: [],
  CAMPO: [],
};

export const FloatingCopilot = ({ onClose, scope = 'DOCENCIA' }: Props) => {
  const [input, setInput] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string | undefined;

  const { messages, loading, executing, errorMsg, send, confirm, discard } = useMasterCopilotChat({ scope, courseId });

  const accentColor = SCOPE_COLORS[scope] ?? '#1B396A';
  const quickActions = QUICK_ACTIONS[scope] ?? [];

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    const text = input;
    setInput('');
    send(text);
  };

  return (
    <div className={styles.chatWindow}>
      <div className={styles.chatHeader} style={{ borderBottom: `2px solid ${accentColor}` }}>
        <div className={styles.headerTitle}>
          <Sparkles size={15} color={accentColor} />
          <span style={{ color: accentColor }}>Master Copilot · {scope}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {courseId && (
            <span title="Abrir formulario detallado" onClick={() => router.push(`/panel/materias/${courseId}/crear-ia`)}>
              <Maximize2 size={15} className={styles.expandIcon} />
            </span>
          )}
          {onClose && <X size={17} onClick={onClose} className={styles.close} />}
        </div>
      </div>

      <div className={styles.chatBody} ref={bodyRef} style={{ maxHeight: '420px', overflowY: 'auto' }}>
        {messages.length === 0 && !loading && (
          <>
            <p className={styles.welcome}>
              Dame una instrucción para el módulo <strong style={{ color: accentColor }}>{scope}</strong> — puedo crear avisos, evaluaciones, actividades, material, o cerrar una unidad/entrega.
            </p>
            {quickActions.length > 0 && (
              <div className={styles.quickActions}>
                {quickActions.map(a => (
                  <button key={a.label} onClick={() => setInput(a.cmd)}>
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? styles.userBubble : styles.botBubble}>
            <p style={{ margin: 0 }}>{m.content}</p>
            {m.role === 'assistant' && m.proposal && !m.resolved && (
              <div className={styles.previewCard} style={{ marginTop: '8px' }}>
                <div className={styles.previewTag}><ShieldCheck size={11} /> ACCIÓN PROPUESTA</div>
                <div className={styles.previewActions}>
                  <button className={styles.backBtn} onClick={() => discard(i)} disabled={executing}>
                    <Ban size={13} /> Descartar
                  </button>
                  <button className={styles.saveBtn} style={{ backgroundColor: accentColor }} onClick={() => confirm(i, m.proposal!)} disabled={executing}>
                    {executing ? <Loader2 size={14} className="animate-spin" /> : <Check size={13} />}
                    {executing ? 'Ejecutando...' : 'Confirmar y Ejecutar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className={styles.loadingArea}>
            <Loader2 className="animate-spin" size={22} color={accentColor} />
            <p>Pensando...</p>
          </div>
        )}

        {errorMsg && !loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '10px', marginTop: '12px' }}>
            <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: 0, lineHeight: '1.4' }}>{errorMsg}</p>
          </div>
        )}
      </div>

      <div className={styles.inputArea}>
        <textarea
          placeholder="Escribe tu instrucción..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{ backgroundColor: input.trim() ? accentColor : undefined }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
