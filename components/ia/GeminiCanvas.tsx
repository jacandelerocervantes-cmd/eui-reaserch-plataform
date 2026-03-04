"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  FileText, Save, AlertCircle, Loader2, 
  ShieldCheck, Zap, CheckCircle 
} from 'lucide-react';
import { publishHybridMaterial } from '@/lib/ai-actions';
import { supabase } from '@/lib/supabase';
import styles from './GeminiCanvas.module.css';

// Definimos qué estructura esperamos del contenido (viene de la IEO)
interface CanvasContent {
  titulo_profesional: string;
  cuerpo_enriquecido: string;
  triage_analisis?: string;
  pilar_operativo?: string;
}

export const GeminiCanvas = ({ content }: { content: CanvasContent | null }) => {
  const { id: courseId } = useParams();
  const [publishing, setPublishing] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [materialsFolderId, setMaterialsFolderId] = useState("");
  const [published, setPublished] = useState(false);

  // 1. Carga de metadatos de la Materia (Unidades y Carpetas)
  useEffect(() => {
    async function loadMetaData() {
      if (!courseId) return;
      
      const { data: materia, error } = await supabase
        .from('materias')
        .select('drive_folder_id, course_units(id, name)')
        .eq('id', courseId)
        .single();

      if (!error && materia) {
        setUnits(materia.course_units || []);
        setMaterialsFolderId(materia.drive_folder_id); 
      }
    }
    loadMetaData();
  }, [courseId]);

  // 2. Acción de Publicación Atómica (Bóveda + Drive)
  const handlePublish = async () => {
    if (!selectedUnit) return alert("Por favor, seleccione una unidad académica.");
    if (!content) return;

    setPublishing(true);
    try {
      await publishHybridMaterial(
        courseId as string, 
        selectedUnit, 
        content, 
        materialsFolderId
      );
      setPublished(true);
      setTimeout(() => setPublished(false), 3000); // Feedback visual
    } catch (err) {
      console.error("Error en publicación:", err);
      alert("Error al sincronizar con el ecosistema de Google.");
    } finally {
      setPublishing(false);
    }
  };

  // 3. Estado: Sin contenido (Canvas vacío)
  if (!content) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}><AlertCircle size={48} color="#64748b" /></div>
        <h2>Canvas en espera de directivas...</h2>
        <p>Utilice el Control Maestro para proyectar un protocolo o material técnico aquí.</p>
      </div>
    );
  }

  return (
    <div className={styles.canvasCard}>
      <header className={styles.canvasHeader}>
        <div className={styles.headerInfo}>
          <ShieldCheck className={styles.typeIcon} color="#10b981" />
          <div className={styles.titleStack}>
            <span className={styles.pilarBadge}>{content.pilar_operativo || 'DOCENCIA'}</span>
            <h3>{content.titulo_profesional}</h3>
          </div>
        </div>
        
        <div className={styles.actions}>
          <select 
            value={selectedUnit} 
            onChange={(e) => setSelectedUnit(e.target.value)}
            className={styles.unitSelect}
          >
            <option value="">Seleccionar Unidad...</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          
          <button 
            onClick={handlePublish} 
            disabled={publishing || !selectedUnit || published}
            className={`${styles.publishBtn} ${published ? styles.successBtn : ""}`}
          >
            {publishing ? <Loader2 size={16} className={styles.spin} /> : 
             published ? <CheckCircle size={16} /> : <Save size={16} />}
            {publishing ? "Sincronizando..." : published ? "¡Publicado!" : "Publicar en Bóveda"}
          </button>
        </div>
      </header>

      <div className={styles.canvasBody}>
        {/* TRIAGE DE INTELIGENCIA: Justificación técnica del material */}
        {content.triage_analisis && (
          <div className={styles.triageAlert}>
            <Zap size={14} color="#f59e0b" />
            <span><strong>Análisis IEO:</strong> {content.triage_analisis}</span>
          </div>
        )}

        <div className={styles.markdownContent}>
          {/* Aquí se renderiza el cuerpo enriquecido redactado por Gemini */}
          <pre className={styles.rawText}>{content.cuerpo_enriquecido}</pre>
        </div>
      </div>
    </div>
  );
};