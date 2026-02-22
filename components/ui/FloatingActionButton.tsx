"use client";

import { Plus } from "lucide-react";
import styles from "./FloatingActionButton.module.css";

// 1. Aquí le decimos a TypeScript que este componente acepta una función onClick
interface Props {
  onClick: () => void;
}

// 2. Recibimos el onClick en los parámetros
export default function FloatingActionButton({ onClick }: Props) {
  return (
    <div className={styles.container}>
      {/* 3. Cambiamos el <Link> por un <button> que ejecuta el onClick */}
      <button 
        onClick={onClick} 
        className={styles.wrapper}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span className={styles.label}>Crear Nueva Asignatura</span>
        <div className={styles.iconCircle}>
          <Plus size={28} />
        </div>
      </button>
    </div>
  );
}