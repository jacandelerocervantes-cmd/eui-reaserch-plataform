"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ClipboardList, Target, CheckCircle2, Clock, 
  ChevronRight, AlertCircle, Map, Calendar
} from "lucide-react";

export default function ListaMisionesCampo() {
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setIsMounted(true), []);

  const misiones = [
    { 
      id: "M-101", 
      titulo: "Muestreo Suelo Cuadrante B-12", 
      prioridad: "Alta", 
      status: "Pendiente", 
      fecha: "Hoy", 
      desc: "Tomar 5 muestras de suelo a 20cm de profundidad." 
    },
    { 
      id: "M-102", 
      titulo: "Fotos Estrés Hídrico Invernadero", 
      prioridad: "Media", 
      status: "Completado", 
      fecha: "Ayer", 
      desc: "Documentar estado de las hojas en sector C." 
    },
    { 
      id: "M-103", 
      titulo: "Calibración Nodos Lora B1", 
      prioridad: "Baja", 
      status: "Pendiente", 
      fecha: "25 Feb", 
      desc: "Verificar conexión de los 3 nodos de la torre norte." 
    }
  ];

  if (!isMounted) return null;

  return (
    <div style={{ backgroundColor: "#fdf8f6", minHeight: "calc(100vh - 80px)", padding: "30px" }}>
      
      <header style={{ marginBottom: "30px" }}>
        <h1 style={{ color: "#431407", fontSize: "2rem", fontWeight: "900", margin: 0 }}>Mis Misiones</h1>
        <p style={{ color: "#9a3412", fontWeight: "600" }}>Tareas asignadas para tu jornada de campo.</p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {misiones.map((m) => (
          <div 
            key={m.id}
            onClick={() => m.status === 'Pendiente' && router.push(`/campo/captura`)}
            style={{ 
              backgroundColor: "white", borderRadius: "24px", padding: "20px", 
              border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", 
              alignItems: "center", cursor: m.status === 'Pendiente' ? "pointer" : "default",
              opacity: m.status === 'Completado' ? 0.7 : 1,
              transition: "transform 0.2s"
            }}
          >
            <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
              <div style={{ 
                backgroundColor: m.status === 'Completado' ? "#ecfdf5" : "#fff7ed", 
                color: m.status === 'Completado' ? "#10b981" : "#ea580c", 
                padding: "12px", borderRadius: "16px" 
              }}>
                {m.status === 'Completado' ? <CheckCircle2 size={24}/> : <Target size={24} />}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ margin: 0, color: "#431407", fontSize: "1.1rem", fontWeight: "800" }}>{m.titulo}</h3>
                  <span style={{ fontSize: "0.6rem", fontWeight: "900", padding: "2px 6px", borderRadius: "4px", backgroundColor: "#f1f5f9", color: "#64748b" }}>{m.id}</span>
                </div>
                <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#64748b", fontWeight: "500" }}>{m.desc}</p>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#9a3412", display: "flex", alignItems: "center", gap: "4px" }}><Calendar size={12}/> {m.fecha}</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: "800", color: m.prioridad === 'Alta' ? "#ef4444" : "#64748b" }}>• Prioridad {m.prioridad}</span>
                </div>
              </div>
            </div>
            
            {m.status === 'Pendiente' ? (
              <div style={{ backgroundColor: "#431407", color: "white", padding: "10px", borderRadius: "50%" }}>
                <ChevronRight size={20} />
              </div>
            ) : (
              <span style={{ color: "#10b981", fontWeight: "900", fontSize: "0.8rem" }}>LOGRADO</span>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}