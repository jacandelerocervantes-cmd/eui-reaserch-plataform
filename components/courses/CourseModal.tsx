"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import styles from "./CourseModal.module.css";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  initialName?: string;
  title: string;
}

export default function CourseModal({ isOpen, onClose, onSubmit, initialName = "", title }: CourseModalProps) {
  const [courseName, setCourseName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Controlar la apertura nativa del modal
  useEffect(() => {
    if (isOpen && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
      setCourseName(initialName);
    } else if (!isOpen && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [isOpen, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) return;
    
    setLoading(true);
    try {
      // Si no hay nombre inicial, asumimos que es una creación de curso
      if (!initialName) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // 1. Primero insertamos la materia básica en Supabase para obtener el ID
          const { data: newCourse, error } = await supabase
            .from('materias')
            .insert([{ nombre: courseName, docente_id: user.id }])
            .select()
            .single();

          if (error) throw error;

          if (newCourse) {
            // 2. Disparamos la Edge Function para crear el entorno en Google
            const { error: fnError } = await supabase.functions.invoke('provision-course-environment', {
              body: { courseId: newCourse.id, nombre: courseName, clave: "CURSO-2026" }
            });

            if (fnError) throw fnError;
          }
        }
      }
      
      await onSubmit(courseName);
      onClose(); // Cerramos solo si todo sale bien
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { if (loading) e.preventDefault(); else onClose(); }}
      className={styles.dialog}
    >
      <div className={styles.modalContent}>
        
        {/* Cabecera */}
        <header className={styles.header}>
          <h3 className={styles.title}>
            <Sparkles className={styles.iconTitle} size={36} strokeWidth={2.5} />
            {title}
          </h3>
          <button 
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            disabled={loading}
            aria-label="Cerrar modal"
          >
            <X size={28} strokeWidth={2.5} />
          </button>
        </header>
        
        <form onSubmit={handleSubmit} className={styles.modalContent}>
          
          {/* Cuerpo (Input) */}
          <div className={styles.body}>
            <input
              type="text"
              placeholder="Nombre de la materia..."
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className={styles.input}
              required
              disabled={loading}
            />
          </div>
          
          {/* Pie (Botón Submit) */}
          <footer className={styles.footer}>
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading && <Loader2 size={32} className={styles.spinner} />}
              <span>{loading ? "Procesando..." : "Guardar Entorno Virtual"}</span>
            </button>
          </footer>

        </form>
      </div>
    </dialog>
  );
}