"use client";

import React, { useState } from 'react';
import { Upload, FileText, X, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import styles from './ImportModal.module.css'; // Usando el mismo CSS con ajustes

export default function ImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
    }
  };

  const handleGeminiProcess = () => {
    if (!file) return;
    
    setStatus('analyzing');
    
    // Aquí es donde entrará Gemini en el futuro
    // Por ahora simulamos la lectura del PDF/Doc
    setTimeout(() => {
      setStatus('success');
      setTimeout(() => {
        onClose();
        setFile(null);
        setStatus('idle');
      }, 2000);
    }, 3000);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>

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

        <div className={`${styles.dropZone} ${file ? styles.fileSelected : ''}`}>
          <input 
            type="file" 
            accept=".pdf, .doc, .docx, .png, .jpg, .csv, .xlsx" 
            onChange={handleFileChange} 
            className={styles.hiddenInput}
            id="fileInput"
          />
          <label htmlFor="fileInput" className={styles.dropLabel}>
            {status === 'analyzing' ? (
              <Loader2 size={40} className={styles.spin} />
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

        {status === 'analyzing' && (
          <div className={styles.aiStatus}>
            <Sparkles size={18} className={styles.pulse} />
            <span>Gemini está leyendo el documento...</span>
          </div>
        )}

        {status === 'success' && (
          <div className={styles.statusSuccess}>
            <CheckCircle2 size={18} />
            <span>¡Datos extraídos con éxito!</span>
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose} disabled={status === 'analyzing'}>
            Cancelar
          </button>
          <button 
            className={styles.confirmButton} 
            disabled={!file || status === 'analyzing' || status === 'success'}
            onClick={handleGeminiProcess}
          >
            {status === 'analyzing' ? 'Procesando...' : 'Analizar con IA'}
          </button>
        </div>
      </div>
    </div>
  );
}