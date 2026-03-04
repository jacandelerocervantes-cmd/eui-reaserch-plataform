"use client";

import React from "react";
import { Plus } from "lucide-react";
import styles from "./FloatingActionButton.module.css";

interface Props {
  /** Función que se ejecutará al presionar el botón (ej: abrir el setup de materia) */
  onClick: () => void;
  /** Texto opcional para personalizar la etiqueta según el módulo */
  label?: string; 
}

export default function FloatingActionButton({ 
  onClick, 
  label = "Crear Nueva Asignatura" 
}: Props) {
  return (
    <div className={styles.container}>
      <button 
        onClick={onClick} 
        className={styles.wrapper}
        aria-label={label}
        type="button"
      >
        <span className={styles.label}>{label}</span>
        <div className={styles.iconCircle}>
          <Plus size={28} strokeWidth={2.5} />
        </div>
      </button>
    </div>
  );
}