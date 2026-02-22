"use client";

import { Users, Edit2, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";
import styles from "./CourseCard.module.css";

interface CourseCardProps {
  id: string;
  title: string;
  studentsCount: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function CourseCard({ id, title, studentsCount, onEdit, onDelete }: CourseCardProps) {
  return (
    <div className={styles.card}>
      {/* Línea decorativa superior institucional */}
      <div className={styles.accentLine}></div>
      
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        
        <div className={styles.stats}>
          <Users size={16} className={styles.icon} />
          <span>{studentsCount} estudiantes inscritos</span>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.actions}>
          <button 
            onClick={() => onEdit(id)} 
            className={`${styles.actionBtn} ${styles.editBtn}`}
            title="Editar nombre"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={() => onDelete(id)} 
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            title="Eliminar materia"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Botón para entrar a la materia */}
        <Link href={`/panel/materias/${id}`} className={styles.enterBtn}>
          <span>Entrar</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}