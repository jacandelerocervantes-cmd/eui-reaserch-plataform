"use client";

import React, { useState, useEffect } from "react";
import styles from "./CourseModal.module.css";

// Interfaz actualizada para soportar Creación (4 datos) y Edición (1 dato + Eliminar)
interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Hacemos que los últimos 3 parámetros sean opcionales para que funcione en Edición
  onSubmit: (name: string, units?: number, semester?: string, year?: number) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  courseId?: string | null;
  title?: string;
  initialName?: string;
}

export default function CourseModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onDelete,
  courseId,
  title = "Apertura de Asignatura",
  initialName = ""
}: CourseModalProps) {
  const [name, setName] = useState("");
  const [units, setUnits] = useState(1);
  const [semester, setSemester] = useState("Enero - Julio");
  const [year, setYear] = useState(new Date().getFullYear());

  // Cargar datos iniciales si estamos en modo edición
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      if (!courseId) {
        setUnits(1);
        setSemester("Enero - Julio");
        setYear(new Date().getFullYear());
      }
    }
  }, [isOpen, initialName, courseId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name, units, semester, year);
    // Limpiar form
    if (!courseId) {
      setName("");
      setUnits(1);
      setSemester("Enero - Julio");
      setYear(new Date().getFullYear());
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>{title}</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Nombre de la Asignatura</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Taller de Investigación I"
              autoFocus
              required
            />
          </div>

          {/* Estos campos SOLO se muestran al crear una materia nueva */}
          {!courseId && (
            <>
              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label>Número de Unidades</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={units}
                    onChange={(e) => setUnits(Number(e.target.value))}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Año</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Semestre</label>
                <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                  <option value="Enero - Julio">Enero - Julio</option>
                  <option value="Agosto - Diciembre">Agosto - Diciembre</option>
                </select>
              </div>
            </>
          )}

          <div className={styles.footer} style={{ justifyContent: courseId ? "space-between" : "flex-end" }}>
            {/* Botón Eliminar: Solo aparece si hay un courseId (Edición) */}
            {courseId && onDelete && (
              <button 
                type="button" 
                onClick={() => onDelete(courseId)}
                style={{ backgroundColor: "#fef2f2", color: "#ef4444", border: "1px solid #fee2e2", padding: "10px 16px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" }}
              >
                Eliminar Materia
              </button>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button type="button" onClick={onClose} className={styles.cancelBtn}>
                Cancelar
              </button>
              <button type="submit" className={styles.submitBtn} disabled={!name.trim()}>
                {courseId ? "Guardar Cambios" : "Aperturar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}