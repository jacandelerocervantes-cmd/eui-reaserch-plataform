"use client";

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { 
  Sparkles, X, Send, Bell, ClipboardList, 
  FileText, Loader2, Zap, ShieldCheck 
} from 'lucide-react';
import { getAiDraft, applyAIAction } from '@/lib/ai-actions';
import styles from './FloatingCopilot.module.css';

interface Props {
  forceOpen?: boolean;
  onClose?: () => void;
  scope?: string; // DOCENCIA, INVESTIGACION, LABORATORIO, CAMPO
}

export const FloatingCopilot = ({ onClose, scope = "DOCENCIA" }: Props) => {
  const [command, setCommand] = useState("");
  const [preview, setPreview] = useState<any>(null); // JSON de la IEO
  const [loading, setLoading] = useState(false);
  
  const { id: courseId } = useParams();

  // 🧠 PROCESO 1: Razonamiento de la IEO
  const handleProcess = async () => {
    if (!command.trim()) return;
    setLoading(true);
    setPreview(null);

    try {
      const aiResponse = await getAiDraft(command, scope);
      setPreview(aiResponse);
    } catch (error) {
      console.error("Error en IEO:", error);
      alert("El motor de razonamiento técnico no pudo procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  // ⚡ PROCESO 2: Ejecución vía Gateway
  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Usamos los datos editados en el Canvas local del Copilot
      const finalPayload = {
        titulo: preview.canvas_draft.titulo_profesional,
        contenido: preview.canvas_draft.cuerpo_enriquecido,
        courseId: courseId // Contexto de base de datos
      };

      await applyAIAction(
        preview.ejecucion_sugerida.function_name, 
        preview.pilar_operativo, 
        finalPayload
      );

      alert(`Acción ejecutada: ${preview.ejecucion_sugerida.action_button_label}`);
      setPreview(null);
      setCommand("");
      if (onClose) onClose();
    } catch (error) {
      alert("Error crítico en la ejecución del Gateway.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.chatWindow}>
      {/* HEADER PROFESIONAL */}
      <div className={styles.chatHeader} style={{ borderBottom: `2px solid ${preview ? '#10b981' : '#1B396A'}` }}>
        <div className={styles.headerTitle}>
          <Sparkles size={16} color="#7C3AED" /> 
          <span>IEO: {scope}</span>
        </div>
        {onClose && <X size={18} onClick={onClose} className={styles.close} />}
      </div>

      <div className={styles.chatBody}>
        {/* ESTADO: CARGANDO ANALISIS */}
        {loading && (
          <div className={styles.loadingArea}>
            <Loader2 className="animate-spin" size={32} color="#1B396A" />
            <p>Realizando Triage de Impacto...</p>
          </div>
        )}

        {/* ESTADO: SIN PREVIEW (INPUT INICIAL) */}
        {!preview && !loading && (
          <>
            <p className={styles.welcome}>Establezca una directiva para el módulo <strong>{scope}</strong>.</p>
            <div className={styles.quickActions}>
              <button onClick={() => setCommand("Generar aviso oficial sobre...")}><Bell size={14}/> Aviso</button>
              <button onClick={() => setCommand("Diseñar protocolo técnico de...")}><ClipboardList size={14}/> Protocolo</button>
              <button onClick={() => setCommand("Estructurar evaluación por competencias...")}><FileText size={14}/> Evaluación</button>
            </div>
          </>
        )}

        {/* ESTADO: CANVAS DE EDICIÓN (TRIAGE IA) */}
        {preview && !loading && (
          <div className={styles.previewCard}>
            <div className={styles.triageBox}>
              <Zap size={14} color="#f59e0b" />
              <span><strong>Análisis IEO:</strong> {preview.triage_analisis}</span>
            </div>

            <div className={styles.previewTag}>
              <ShieldCheck size={12} /> BORRADOR NIVEL {preview.pilar_operativo}
            </div>

            <input 
              value={preview.canvas_draft.titulo_profesional} 
              onChange={e => setPreview({...preview, canvas_draft: {...preview.canvas_draft, titulo_profesional: e.target.value}})}
              className={styles.editTitle}
              placeholder="Título Técnico..."
            />
            
            <textarea 
              value={preview.canvas_draft.cuerpo_enriquecido} 
              onChange={e => setPreview({...preview, canvas_draft: {...preview.canvas_draft, cuerpo_enriquecido: e.target.value}})}
              className={styles.editContent}
              placeholder="Desarrollo del protocolo..."
              rows={8}
            />

            <div className={styles.previewActions}>
              <button onClick={() => setPreview(null)} className={styles.backBtn}>Descartar</button>
              <button onClick={handleConfirm} className={styles.saveBtn}>
                {preview.ejecucion_sugerida.action_button_label}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ÁREA DE INPUT FIJA */}
      {!preview && !loading && (
        <div className={styles.inputArea}>
          <textarea 
            placeholder="Escriba su comando maestro..." 
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleProcess())}
          />
          <button className={styles.sendBtn} onClick={handleProcess} disabled={!command.trim()}>
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
};