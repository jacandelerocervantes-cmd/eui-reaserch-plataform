"use client";

import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import styles from "@/components/courses/CourseCard.module.css";

interface AlumnoCourseCardProps {
  id: string;
  title: string;
}

export default function AlumnoCourseCard({ id, title }: AlumnoCourseCardProps) {
  const router = useRouter();

  return (
    <div
      className={styles.card}
      onClick={() => router.push(`/alumno/materia/${id}`)}
      title={`Entrar a ${title}`}
    >
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
      </div>

      <div className={styles.studentInfo}>
        <BookOpen size={18} />
        <span>Entrar a la materia</span>
      </div>
    </div>
  );
}
