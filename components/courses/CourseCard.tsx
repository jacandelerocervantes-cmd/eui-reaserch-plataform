"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import styles from "./CourseCard.module.css";

interface CourseCardProps {
  id: string;
  title: string;
  studentsCount: number;
}

export default function CourseCard({ id, title, studentsCount }: CourseCardProps) {
  const router = useRouter();

  return (
    <div 
      className={styles.card}
      onClick={() => router.push(`/panel/materias/${id}`)}
      title={`Entrar a ${title}`}
    >
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
      </div>
      
      <div className={styles.studentInfo}>
        <Users size={18} />
        <span>{studentsCount} Alumnos inscritos</span>
      </div>
    </div>
  );
}