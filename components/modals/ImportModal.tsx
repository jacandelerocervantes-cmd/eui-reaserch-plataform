"use client";

import React, { useState } from 'react';
import { FileText, X, CheckCircle2, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import styles from './ImportModal.module.css';
import { supabase } from '@/lib/supabase';
import { validateFileContent } from '@/lib/fileValidation';

// Añadimos courseId a las props para que sepa a qué materia asignar los alumnos
export default function ImportModal({ isOpen, onClose, courseId }: { isOpen: boolean; onClose: () => void, courseId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>(''); // Para guardar mensajes de éxito o error amigables

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const check = await validateFileContent(f);
    if (!check.ok) {
      setFile(null);
      setStatus('error');
      setMessage(check.reason);
      e.target.value = '';
      return;
    }
    setFile(f);
    setStatus('idle');
    setMessage('');
  };

  const handleGeminiProcess = async () => {
    if (!file) return;
    
    setStatus('analyzing');
    setMessage('');
    
    try {
      // 1. Preparamos el archivo y el ID del curso para enviarlo a la Edge Function
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('courseId', courseId);

      // 2. Llamada real a tu Edge Function
      const { data, error } = await supabase.functions.invoke('import-ia-students', {
        body: formData,
      });

      // 3. Manejo de errores de red o crasheos de la función
      if (error) {
        throw new Error("Error de conexión con el servidor.");
      }

      // 4. Manejo de los errores lógicos (los "UI_ERROR" que configuramos en el backend)
      if (!data.success) {
        throw new Error(data.error || "No se pudo procesar el documento.");
      }

      // 5. ¡Éxito!
      setStatus('success');
      setMessage(data.message || '¡Datos extraídos con éxito!');
      
      setTimeout(() => {
        onClose();
        setFile(null);
        setStatus('idle');
        setMessage('');
        // Opcional: Aquí podrías disparar un evento para recargar la tabla de alumnos
      }, 2500);

    } catch (err) {
      console.error("Error en el Modal de Importación:", err);
      setStatus('error');
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose} disabled={status === 'analyzing'}><X size={20} /></button>

        <div className={styles.header}>
          <div className={styles.aiBadge}>
            <Sparkles size={14} />
            <span>Powered by Gemini</span>
          </div>
          <h2 className={styles.title}>Importación Inteligente</h2>
          <p className={styles.subtitle}>
            Sube un **PDF, Word o Imagen**. Gemini extraerá nombres, apellidos y correos automáticamente.
          </p>
        </div>

        <div className={`${styles.dropZone} ${file ? styles.fileSelected : ''} ${status === 'error' ? styles.errorZone : ''}`}>
          <input 
            type="file" 
            accept=".pdf, .doc, .docx, .png, .jpg, .csv, .xlsx" 
            onChange={handleFileChange} 
            className={styles.hiddenInput}
            id="fileInput"
            disabled={status === 'analyzing' || status === 'success'}
          />
          <label htmlFor="fileInput" className={styles.dropLabel}>
            {status === 'analyzing' ? (
              <Loader2 size={40} className={styles.spin} />
            ) : status === 'error' ? (
              <AlertCircle size={40} color="#ef4444" />
            ) : (
              <FileText size={40} />
            )}
            
            {file ? (
              <span className={styles.fileName}>{file.name}</span>
            ) : (
              <span>Suelta cualquier archivo aquí</span>
            )}
          </label>
        </div>

        {/* MENSAJES DE ESTADO */}
        {status === 'analyzing' && (
          <div className={styles.aiStatus}>
            <Sparkles size={18} className={styles.pulse} />
            <span>Gemini está leyendo el documento...</span>
          </div>
        )}

        {status === 'success' && (
          <div className={styles.statusSuccess}>
            <CheckCircle2 size={18} />
            <span>{message}</span>
          </div>
        )}

        {status === 'error' && (
          <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', padding: '10px', borderRadius: '8px', marginTop: '15px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <AlertCircle size={18} />
            <span>{message}</span>
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose} disabled={status === 'analyzing'}>
            {status === 'success' ? 'Cerrar' : 'Cancelar'}
          </button>
          <button 
            className={styles.confirmButton} 
            disabled={!file || status === 'analyzing' || status === 'success'}
            onClick={handleGeminiProcess}
          >
            {status === 'analyzing' ? 'Procesando...' : status === 'error' ? 'Reintentar' : 'Analizar con IA'}
          </button>
        </div>
      </div>
    </div>
  );
}