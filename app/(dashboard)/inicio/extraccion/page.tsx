"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, CheckCircle2, AlertCircle, Edit3, 
  Save, Trash2, Calendar, BookOpen, Target, 
  ClipboardCheck, ArrowRight, Loader2
} from "lucide-react";

export default function VistaPreviaExtraccion() {
  const [isMounted, setIsMounted] = useState(false);
  const [step, setStep] = useState("analizando"); // analizando | revisando | guardado

  // Simulación de los datos que la IA extrajo del PDF
  const [courseData, setCourseData] = useState({
    nombre: "Redes de Computadoras",
    clave: "SCD-1021",
    unidades: [
      { id: 1, nombre: "Introducción a las Redes", criterios: [
        { nombre: "Examen Teórico", peso: 40 },
        { nombre: "Prácticas de Laboratorio", peso: 50 },
        { nombre: "Asistencia", peso: 10 }
      ]},
      { id: 2, nombre: "Capa de Enlace de Datos", criterios: [
        { nombre: "Proyecto Integrador", peso: 100 }
      ]}
    ],
    competencias: [
      "Diseña e instala redes de computadoras bajo estándares internacionales.",
      "Configura dispositivos de interconectividad."
    ]
  });

  useEffect(() => {
    setIsMounted(true);
    // Simular tiempo de lectura de la IA
    setTimeout(() => setStep("revisando"), 3000);
  }, []);

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      
      {/* --- ESTADO 1: ANALIZANDO (Animación Premium) --- */}
      {step === "analizando" && (
        <div style={{ height: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: "24px" }}>
          <div style={{ position: "relative" }}>
            <div className="pulse-ring" /> {/* Animación de pulso azul */}
            <Loader2 size={64} color="#1B396A" className="animate-spin" />
          </div>
          <div>
            <h2 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "900", margin: 0 }}>Leyendo Programa de Estudios...</h2>
            <p style={{ color: "#64748b", marginTop: "8px" }}>La IA está extrayendo unidades, criterios y competencias del PDF.</p>
          </div>
        </div>
      )}

      {/* --- ESTADO 2: REVISIÓN (El Espejo) --- */}
      {step === "revisando" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ backgroundColor: "#f3f0ff", color: "#7c3aed", padding: "6px 12px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "800", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                <Sparkles size={14} /> EXTRACCIÓN EXITOSA
              </div>
              <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0 }}>Valida la Información</h1>
              <p style={{ color: "#64748b", fontSize: "1.1rem", marginTop: "4px" }}>Revisa que la IA haya interpretado correctamente tu Syllabus.</p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button style={{ backgroundColor: "#f1f5f9", color: "#64748b", border: "none", padding: "12px 24px", borderRadius: "14px", fontWeight: "700", cursor: "pointer" }}>Descartar</button>
              <button 
                onClick={() => setStep("guardado")}
                style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "12px 32px", borderRadius: "14px", fontWeight: "800", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", boxShadow: "0 10px 15px -3px rgba(27, 57, 106, 0.3)" }}
              >
                <Save size={20} /> Guardar y Configurar Todo
              </button>
            </div>
          </header>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "32px" }}>
            
            {/* COLUMNA IZQUIERDA: ESTRUCTURA DE LA MATERIA */}
            <section style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Card de Unidades y Rúbricas */}
              {courseData.unidades.map((uni) => (
                <div key={uni.id} style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 8px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "900" }}>U{uni.id}</span>
                      <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.1rem", fontWeight: "800" }}>{uni.nombre}</h3>
                    </div>
                    <Edit3 size={18} color="#94a3b8" style={{ cursor: "pointer" }} />
                  </div>
                  
                  <div style={{ padding: "24px" }}>
                    <p style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", marginBottom: "12px" }}>Rúbrica de Evaluación Detectada</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {uni.criterios.map((crit, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "12px" }}>
                          <span style={{ fontWeight: "600", color: "#475569" }}>{crit.nombre}</span>
                          <span style={{ fontWeight: "800", color: "#10b981" }}>{crit.peso}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* COLUMNA DERECHA: DATOS GENERALES Y COMPETENCIAS */}
            <aside style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Datos Generales */}
              <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
                <h3 style={{ color: "#1B396A", fontSize: "1rem", fontWeight: "800", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <BookOpen size={18} color="#3b82f6" /> Materia
                </h3>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "800" }}>NOMBRE OFICIAL</label>
                  <div style={{ fontWeight: "700", color: "#1e293b" }}>{courseData.nombre}</div>
                </div>
                <div>
                  <label style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "800" }}>CLAVE</label>
                  <div style={{ fontWeight: "700", color: "#1e293b" }}>{courseData.clave}</div>
                </div>
              </div>

              {/* Competencias */}
              <div style={{ backgroundColor: "#1B396A", borderRadius: "24px", padding: "24px", color: "white" }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: "1rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Target size={18} /> Competencias
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {courseData.competencias.map((comp, i) => (
                    <div key={i} style={{ fontSize: "0.85rem", opacity: 0.9, lineHeight: "1.4", display: "flex", gap: "8px" }}>
                      <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: "2px" }} /> {comp}
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* --- ESTADO 3: ÉXITO FINAL --- */}
      {step === "guardado" && (
        <div style={{ height: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: "24px" }}>
          <div style={{ backgroundColor: "#ecfdf5", color: "#10b981", padding: "24px", borderRadius: "50%" }}>
            <CheckCircle2 size={64} />
          </div>
          <div>
            <h2 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "900", margin: 0 }}>¡Materia Configurada!</h2>
            <p style={{ color: "#64748b", marginTop: "8px" }}>Hemos creado las unidades, rúbricas y el calendario según tu Syllabus.</p>
          </div>
          <button 
            onClick={() => window.location.href = "/panel"}
            style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "14px 32px", borderRadius: "14px", fontWeight: "800", cursor: "pointer" }}
          >
            Ir a Mis Materias
          </button>
        </div>
      )}

    </div>
  );
}