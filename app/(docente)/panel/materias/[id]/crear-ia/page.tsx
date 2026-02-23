"use client";
import { useParams } from 'next/navigation';
import { GeminiCanvas } from '@/components/ia/GeminiCanvas';
import styles from './crear-ia.module.css';

export default function PaginaCreacionIA() {
  const { id } = useParams(); // Obtenemos el ID de la materia actual

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Generador de Material Híbrido</h1>
          <p>Materia ID: <span className={styles.badge}>{id}</span></p>
        </div>
      </header>
      
      <div className={styles.canvasWrapper}>
        {/* Aquí es donde se conectará con la base de datos de materiales */}
        <GeminiCanvas content={null} />
      </div>
    </div>
  );
}