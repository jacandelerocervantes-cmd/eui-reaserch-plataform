"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Edit3, Trash2, Users, BookOpen, ChevronDown } from "lucide-react";

interface CourseCardProps {
  id: string;
  title: string;
  studentsCount: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function CourseCard({ id, title, studentsCount, onEdit, onDelete }: CourseCardProps) {
  // Estado que controla si el mouse está encima de esta tarjeta específica
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white",
        borderRadius: "20px",
        border: "1px solid #e2e8f0",
        boxShadow: isHovered ? "0 20px 25px -5px rgba(27, 57, 106, 0.1)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
        overflow: "hidden",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
        display: "flex",
        flexDirection: "column",
        position: "relative"
      }}
    >
      {/* Barra de color superior */}
      <div style={{ height: "6px", width: "100%", background: "linear-gradient(90deg, #1B396A, #3b82f6)" }} />
      
      {/* ================= HEADER (Siempre Visible) ================= */}
      <div style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ color: "#1B396A", margin: "0 0 8px 0", fontSize: "1.3rem", fontWeight: "800", lineHeight: "1.2" }}>{title}</h3>
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", fontWeight: "600" }}>
            <Users size={16} /> {studentsCount} Alumnos inscritos
          </p>
        </div>
        {/* Icono animado que indica que hay más contenido */}
        <div style={{ color: isHovered ? "#1B396A" : "#cbd5e1", transition: "transform 0.4s", transform: isHovered ? "rotate(180deg)" : "rotate(0)" }}>
          <ChevronDown size={24} />
        </div>
      </div>

      {/* ================= BODY EXPANDIBLE (Solo en Hover) ================= */}
      <div style={{ 
        // ¡Aquí está la magia! max-height 0 lo oculta, 200px lo expande suavemente
        maxHeight: isHovered ? "200px" : "0px", 
        opacity: isHovered ? 1 : 0, 
        padding: isHovered ? "0 24px 24px 24px" : "0 24px",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", marginBottom: "8px" }} />
        
        <Link href={`/panel/materias/${id}`} style={{ backgroundColor: "#f8fafc", color: "#1B396A", border: "1px solid #e2e8f0", padding: "12px", borderRadius: "12px", textAlign: "center", fontWeight: "800", fontSize: "0.95rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", textDecoration: "none", transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.backgroundColor = "#e2e8f0"} onMouseOut={e => e.currentTarget.style.backgroundColor = "#f8fafc"}>
          <BookOpen size={18} /> Entrar a la Materia
        </Link>

        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={() => onEdit(id)} style={{ flex: 1, padding: "10px", backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "10px", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "0.85rem", fontWeight: "700", transition: "all 0.2s" }} onMouseOver={e => {e.currentTarget.style.borderColor = "#1B396A"; e.currentTarget.style.color = "#1B396A"}} onMouseOut={e => {e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"}}>
            <Edit3 size={16} /> Editar
          </button>
          <button onClick={() => onDelete(id)} style={{ flex: 1, padding: "10px", backgroundColor: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "10px", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "0.85rem", fontWeight: "700", transition: "all 0.2s" }} onMouseOver={e => {e.currentTarget.style.backgroundColor = "#ef4444"; e.currentTarget.style.color = "white"}} onMouseOut={e => {e.currentTarget.style.backgroundColor = "#fef2f2"; e.currentTarget.style.color = "#ef4444"}}>
            <Trash2 size={16} /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}