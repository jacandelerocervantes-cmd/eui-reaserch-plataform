"use client";

import { useState } from 'react';
import { Loader2, ShieldCheck, AlertCircle, Check, Ban } from 'lucide-react';
import styles from './GeminiCanvas.module.css';

interface Proposal {
  tool_name: string;
  params: Record<string, unknown>;
  summary: string;
}

const TOOL_LABELS: Record<string, string> = {
  crear_aviso: 'Publicar Aviso',
  crear_material_boveda: 'Crear Material en la Bóveda',
  crear_evaluacion: 'Crear Evaluación',
  crear_actividad: 'Crear Actividad',
  cerrar_unidad: 'Cerrar Unidad',
  cerrar_entrega: 'Cerrar Entrega',
};

function humanizeKey(key: string) {
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

interface Props {
  proposal: Proposal | null;
  onConfirm: (params: Record<string, unknown>) => void;
  onDiscard: () => void;
  executing: boolean;
  error?: string;
}

export const GeminiCanvas = ({ proposal, onConfirm, onDiscard, executing, error }: Props) => {
  // Quien llama monta este componente con una key distinta por cada
  // propuesta (activeProposal.index), así que este estado inicial solo se
  // lee una vez al montar — no hace falta un efecto que lo resincronice
  // cada vez que cambia la propuesta.
  const [editedParams, setEditedParams] = useState<Record<string, unknown>>(proposal?.params ?? {});

  if (!proposal) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}><AlertCircle size={48} color="#64748b" /></div>
        <h2>Canvas en espera de directivas...</h2>
        <p>Escribe una instrucción arriba para que el Master Copilot proponga una acción aquí.</p>
      </div>
    );
  }

  return (
    <div className={styles.canvasCard}>
      <header className={styles.canvasHeader}>
        <ShieldCheck className={styles.typeIcon} color="#10b981" />
        <div>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Acción Propuesta</span>
          <h3 style={{ margin: '2px 0 0 0' }}>{TOOL_LABELS[proposal.tool_name] ?? proposal.tool_name}</h3>
        </div>
      </header>

      <div className={styles.canvasBody}>
        <p style={{ color: '#475569', marginBottom: '20px' }}>{proposal.summary}</p>

        {Object.entries(editedParams).map(([key, value]) => {
          if (key.endsWith('_id')) return null;
          const isLong = typeof value === 'string' && value.length > 60;
          return (
            <div key={key} style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                {humanizeKey(key)}
              </label>
              {isLong ? (
                <textarea
                  value={value as string}
                  onChange={(e) => setEditedParams((p) => ({ ...p, [key]: e.target.value }))}
                  rows={5}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              ) : (
                <input
                  value={(value as string) ?? ''}
                  onChange={(e) => setEditedParams((p) => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              )}
            </div>
          );
        })}

        {error && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '10px', marginBottom: '14px' }}>
            <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onDiscard} disabled={executing} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <Ban size={15} /> Descartar
          </button>
          <button onClick={() => onConfirm(editedParams)} disabled={executing} style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#1B396A', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            {executing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {executing ? 'Ejecutando...' : 'Confirmar y Ejecutar'}
          </button>
        </div>
      </div>
    </div>
  );
};
