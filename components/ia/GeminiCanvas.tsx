"use client";
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Video, AlertCircle, Save, CheckCircle, Loader2 } from 'lucide-react';
import { generateHybridMaterial, publishHybridMaterial } from '@/lib/ai-actions';
import { supabase } from '@/lib/supabase'; // Cambiado de supabaseClient a supabase
import styles from './GeminiCanvas.module.css';

export const GeminiCanvas = ({ content }: { content: any }) => {
  const { id: courseId } = useParams();
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [materialsFolderId, setMaterialsFolderId] = useState("");

  // 1. Cargar metadatos necesarios (Unidades e ID de carpeta de Drive)
  useEffect(() => {
    async function loadMetaData() {
      const { data: materia } = await supabase
        .from('materias')
        .select('drive_folder_id, course_units(id, name)')
        .eq('id', courseId)
        .single();

      if (materia) {
        setUnits(materia.course_units || []);
        // Aquí asumimos que guardamos el ID de la subcarpeta 'materiales' en un JSON o lo buscamos
        // Por ahora, usamos el ID raíz o el que devuelva tu lógica de setup
        setMaterialsFolderId(materia.drive_folder_id); 
      }
    }
    loadMetaData();
  }, [courseId]);

  const handlePublish = async () => {
    if (!selectedUnit) return alert("Por favor, selecciona una unidad antes de publicar.");
    
    setPublishing(true);
    try {
      await publishHybridMaterial(
        courseId as string, 
        selectedUnit, 
        generatedData, 
        materialsFolderId
      );
      alert("¡Material publicado con éxito en la Bóveda y en Drive!");
      setGeneratedData(null); // Limpiamos para el siguiente
    } catch (err) {
      console.error(err);
      alert("Error al sincronizar con Google Drive.");
    } finally {
      setPublishing(false);
    }
  };

  const activeContent = generatedData ? {
    title: generatedData.title,
    body: generatedData.content,
    type: 'document'
  } : content;

  if (loading) {
    return (
      <div className={styles.empty}>
        <Loader2 className={styles.spin} size={48} />
        <h2>Gemini está redactando tu material técnico...</h2>
      </div>
    );
  }

  if (!activeContent) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}><AlertCircle size={48} /></div>
        <h2>Canvas en espera...</h2>
        <p>Utiliza el Copiloto para generar nuevo material o selecciona un archivo de la bóveda.</p>
      </div>
    );
  }

  return (
    <div className={styles.canvasCard}>
      <header className={styles.canvasHeader}>
        <div className={styles.headerInfo}>
          {activeContent.type === 'document' && <FileText className={styles.typeIcon} />}
          <h3>{activeContent.title}</h3>
        </div>
        
        {/* Lógica de Publicación */}
        {generatedData && (
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
              disabled={publishing || !selectedUnit}
              className={styles.publishBtn}
            >
              {publishing ? <Loader2 size={16} className={styles.spin} /> : <Save size={16} />}
              {publishing ? "Publicando..." : "Publicar en Bóveda"}
            </button>
          </div>
        )}
      </header>

      <div className={styles.canvasBody}>
        {/* Aquí podrías usar un renderizador de Markdown */}
        <div className={styles.markdownContent}>
          {activeContent.body}
        </div>
      </div>
    </div>
  );
};