"use client";
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Sparkles, X, Send, Bell, ClipboardList, FileText, Check, Edit3 } from 'lucide-react';
import { applyAIAction } from '@/lib/ai-actions';
import styles from './FloatingCopilot.module.css';

export const FloatingCopilot = ({ forceOpen, onClose }: { forceOpen?: boolean, onClose?: () => void }) => {
  const [command, setCommand] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const { id: courseId } = useParams();
  const router = useRouter();

  // Mapeo de rutas para que el Copiloto sepa exactamente a dónde ir después de publicar
  const moduleRoutes: Record<string, string> = {
    anuncio: '', // El tablón suele ser la raíz de la materia
    actividad: '/actividades',
    evaluacion: '/evaluaciones'
  };

  const handleProcess = () => {
    if (!command.trim()) return;

    const prompt = command.toLowerCase();
    
    // Aquí es donde entrará la API de Gemini más adelante
    if (prompt.includes("anuncio")) {
      setPreview({ type: 'anuncio', title: 'Aviso Importante', content: 'Cuerpo del anuncio sugerido...' });
    } else if (prompt.includes("tarea") || prompt.includes("actividad")) {
      setPreview({ type: 'actividad', title: 'Nueva Tarea', content: 'Instrucciones sugeridas...' });
    } else if (prompt.includes("examen") || prompt.includes("evaluacion")) {
      setPreview({ type: 'evaluacion', title: 'Examen de Reforzamiento', content: 'Pregunta 1: ...' });
    }
  };

  const handleConfirm = async () => {
    if (!courseId) return alert("Por favor, selecciona una materia primero.");
    setLoading(true);
    
    try {
      await applyAIAction(preview.type, courseId as string, preview);
      setPreview(null);
      setCommand("");
      
      // Redirección inteligente al módulo recién editado
      const targetPath = moduleRoutes[preview.type] || '';
      router.push(`/panel/materias/${courseId}${targetPath}`);
      
      if (onClose) onClose();
    } catch (error) {
      console.error("Error al aplicar acción maestra:", error);
      alert("Hubo un error al procesar la instrucción.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.chatWindow}>
      <div className={styles.chatHeader}>
        <div className={styles.headerTitle}><Sparkles size={16} /> Control Maestro IA</div>
        {onClose && <X size={18} onClick={onClose} className={styles.close} style={{cursor: 'pointer'}} />}
      </div>

      <div className={styles.chatBody}>
        {!preview ? (
          <>
            <p className={styles.welcome}>¿Qué cambio maestro desea realizar en esta materia?</p>
            <div className={styles.quickActions}>
              <button onClick={() => setCommand("Publica un anuncio sobre...")}><Bell size={14}/> Anuncio</button>
              <button onClick={() => setCommand("Crea una tarea de...")}><ClipboardList size={14}/> Actividad</button>
              <button onClick={() => setCommand("Diseña una evaluación de...")}><FileText size={14}/> Examen</button>
            </div>
          </>
        ) : (
          <div className={styles.previewCard}>
            <div className={styles.previewTag}>BORRADOR DE {preview.type.toUpperCase()}</div>
            <input 
              value={preview.title} 
              onChange={e => setPreview({...preview, title: e.target.value})}
              className={styles.editTitle}
              placeholder="Título..."
            />
            <textarea 
              value={preview.content} 
              onChange={e => setPreview({...preview, content: e.target.value})}
              className={styles.editContent}
              placeholder="Contenido..."
            />
            <div className={styles.previewActions}>
              <button onClick={() => setPreview(null)} className={styles.backBtn}>Descartar</button>
              <button onClick={handleConfirm} disabled={loading} className={styles.saveBtn}>
                {loading ? 'Procesando...' : 'Aprobar y Publicar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {!preview && (
        <div className={styles.inputArea}>
          <textarea 
            placeholder="Ej: Crea una tarea sobre la fotosíntesis para el viernes..." 
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleProcess();
              }
            }}
          />
          <button 
            className={styles.sendBtn} 
            onClick={handleProcess}
            disabled={!command.trim()}
          >
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
};