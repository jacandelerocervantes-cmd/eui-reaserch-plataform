"use client";
import React from 'react';
import { FileText, Video, Music, AlertCircle } from 'lucide-react';
import styles from './GeminiCanvas.module.css';

interface GeminiCanvasProps {
  content: any;
}

export const GeminiCanvas = ({ content }: GeminiCanvasProps) => {
  if (!content) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}><AlertCircle size={48} /></div>
        <h2>Esperando instrucciones maestras...</h2>
        <p>Usa el copiloto flotante para generar anuncios, actividades o evaluaciones.</p>
      </div>
    );
  }

  return (
    <div className={styles.canvasCard}>
      <header className={styles.canvasHeader}>
        {content.type === 'document' && <FileText className={styles.typeIcon} />}
        {content.type === 'video' && <Video className={styles.typeIcon} />}
        <h3>{content.title}</h3>
      </header>
      <div className={styles.canvasBody}>
        {content.body}
      </div>
    </div>
  );
};