"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Pencil, Trash2 } from "lucide-react";
import styles from "./CourseCard.module.css";

interface CourseCardProps {
  id: string;
  title: string;
  studentsCount: number;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const ActionBtn = ({
  icon: Icon, label, onClick, color,
}: {
  icon: React.ElementType; label: string; onClick: (e: React.MouseEvent) => void; color: string;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: hovered ? "6px" : "0px",
        backgroundColor: "white", color, border: `1px solid ${color}22`,
        borderRadius: "10px", padding: "0 10px", height: "34px",
        fontWeight: "700", fontSize: "0.78rem", cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        overflow: "hidden", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <Icon size={14} style={{ flexShrink: 0 }} />
      <span style={{
        maxWidth: hovered ? "80px" : "0px", opacity: hovered ? 1 : 0,
        transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      }}>
        {label}
      </span>
    </button>
  );
};

export default function CourseCard({ id, title, studentsCount, onEdit, onDelete }: CourseCardProps) {
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "16px" }}>
        <div className={styles.studentInfo}>
          <Users size={18} />
          <span>{studentsCount} Alumnos inscritos</span>
        </div>

        <div style={{ display: "flex", gap: "6px" }} onClick={e => e.stopPropagation()}>
          {onEdit && (
            <ActionBtn
              icon={Pencil} label="Editar" color="#1B396A"
              onClick={e => { e.stopPropagation(); onEdit(id); }}
            />
          )}
          {onDelete && (
            <ActionBtn
              icon={Trash2} label="Eliminar" color="#ef4444"
              onClick={e => { e.stopPropagation(); onDelete(id); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
