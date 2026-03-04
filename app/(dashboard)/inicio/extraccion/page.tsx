"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, CheckCircle2, AlertCircle, Edit3, 
  Save, Trash2, Calendar, BookOpen, Target, 
  ClipboardCheck, ArrowRight, Loader2, ShieldCheck,
  UploadCloud, FileText
} from "lucide-react";
import { supabase } from "@/lib/supabase"; 

export default function VistaPreviaExtraccionIEO() {
  const [isMounted, setIsMounted] = useState(false);
  // El flujo ahora inicia en "upload" esperando el archivo real
  const [step, setStep] = useState("upload"); // upload | analizando | revisando | guardado
  const [isSaving, setIsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Aquí se guardará lo que responda Gemini 2.5 Flash
  const [courseData, setCourseData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- LÓGICA DE DRAG & DROP Y CONEXIÓN CON IA ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setStep("analizando");
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Llamada al motor IEO de extracción
      const { data, error } = await supabase.functions.invoke('intelligent-file-parser', {
        body: formData,
      });

      if (error) throw error;

      if (data && data.success) {
        setCourseData(data.data);
        setStep("revisando");
      } else {
        console.error("Error en la extracción IEO:", data);
        alert(`Anomalía de Extracción: ${data.error || "No se pudo procesar el documento."}`);
        setStep("upload");
      }
    } catch (err) {
      console.error("Fallo de conexión:", err);
      alert("Error crítico: Pérdida de conexión con el Orquestador IEO al leer el archivo.");
      setStep("upload");
    }
  };

  // --- LÓGICA DE DESPLIEGUE FINAL ---
  const handleGuardar = async () => {
    try {
      setIsSaving(true);
      
      const { data, error } = await supabase.functions.invoke('setup-materia', {
        body: { 
          action: 'setupMateria', 
          payload: courseData    
        }
      });

      if (error) throw error;

      if (data && data.success) {
        setStep("guardado");
      } else {
        console.error("Error IEO en la respuesta:", data);
        alert("Anomalía: Hubo un problema al configurar la infraestructura en Google Workspace.");
      }
    } catch (err) {
      console.error("Fallo de conexión:", err);
      alert("Error crítico: Pérdida de conexión con el Orquestador IEO.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      
      {/* --- ESTADO 0: SUBIR ARCHIVO (Nuevo Diseño Respetando tu Estilo) --- */}
      {step === "upload" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px", alignItems: "center", paddingTop: "40px" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ color: "#1B396A", fontSize: "2.5rem", fontWeight: "950", margin: 0 }}>Carga de Syllabus</h1>
            <p style={{ color: "#64748b", fontSize: "1.1rem", marginTop: "8px" }}>
              Sube tu Programa de Estudios y la IEO extraerá automáticamente la estructura.
            </p>
          </div>

          <div 
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%", maxWidth: "800px", height: "300px",
              backgroundColor: dragActive ? "#f8fafc" : "white",
              border: `3px dashed ${dragActive ? "#1B396A" : "#cbd5e1"}`,
              borderRadius: "24px", display: "flex", flexDirection: "column", 
              justifyContent: "center", alignItems: "center", cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: dragActive ? "0 10px 25px -5px rgba(27, 57, 106, 0.1)" : "0 4px 6px rgba(0,0,0,0.02)"
            }}
          >
            <input 
              ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" 
              onChange={handleChange} style={{ display: "none" }} 
            />
            <div style={{ backgroundColor: dragActive ? "#1B396A" : "#f1f5f9", color: dragActive ? "white" : "#1B396A", padding: "20px", borderRadius: "50%", marginBottom: "16px", transition: "all 0.2s ease" }}>
              <UploadCloud size={48} />
            </div>
            <h3 style={{ color: "#1B396A", fontSize: "1.2rem", fontWeight: "800", margin: "0 0 8px 0" }}>
              {dragActive ? "Suelta el documento aquí" : "Haz clic o arrastra tu PDF aquí"}
            </h3>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0, fontWeight: "500" }}>
              Soporta PDF o Word (Syllabus Oficial TecNM)
            </p>
          </div>
        </div>
      )}

      {/* --- ESTADO 1: ANALIZANDO --- */}
      {step === "analizando" && (
        <div style={{ height: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: "24px" }}>
          <div style={{ position: "relative" }}>
            <Loader2 size={64} color="#1B396A" className="animate-spin" />
          </div>
          <div>
            <h2 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "900", margin: 0, display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
              <ShieldCheck size={28} color="#8b5cf6" /> Procesando Syllabus...
            </h2>
            <p style={{ color: "#64748b", marginTop: "8px", fontWeight: "500" }}>El Motor IEO está extrayendo unidades, rúbricas y competencias para estructurar la materia.</p>
          </div>
        </div>
      )}

      {/* --- ESTADO 2: REVISIÓN --- */}
      {step === "revisando" && courseData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ backgroundColor: "#f3f0ff", color: "#7c3aed", padding: "6px 12px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "800", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                <Sparkles size={14} /> EXTRACCIÓN IEO COMPLETADA
              </div>
              <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0 }}>Validación Táctica</h1>
              <p style={{ color: "#64748b", fontSize: "1.1rem", marginTop: "4px" }}>Confirma la estructura antes de que la IEO despliegue la bóveda en Drive y Sheets.</p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={() => setStep("upload")}
                style={{ backgroundColor: "#f1f5f9", color: "#64748b", border: "none", padding: "12px 24px", borderRadius: "14px", fontWeight: "700", cursor: "pointer" }}
              >
                Descartar
              </button>
              <button 
                onClick={handleGuardar}
                disabled={isSaving}
                style={{ 
                  backgroundColor: "#1B396A", color: "white", border: "none", 
                  padding: "12px 32px", borderRadius: "14px", fontWeight: "800", 
                  display: "flex", alignItems: "center", gap: "10px", 
                  cursor: isSaving ? "not-allowed" : "pointer", 
                  boxShadow: "0 10px 15px -3px rgba(27, 57, 106, 0.3)",
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                {isSaving ? "Desplegando Infraestructura..." : "Aprobar y Desplegar"}
              </button>
            </div>
          </header>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "32px" }}>
            
            {/* COLUMNA IZQUIERDA: ESTRUCTURA DE LA MATERIA */}
            <section style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {courseData.unidades?.map((uni: any) => (
                <div key={uni.id} style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 8px", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "900" }}>U{uni.id}</span>
                      <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.1rem", fontWeight: "800" }}>{uni.nombre}</h3>
                    </div>
                    <Edit3 size={18} color="#94a3b8" style={{ cursor: "pointer" }} />
                  </div>
                  
                  <div style={{ padding: "24px" }}>
                    <p style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", marginBottom: "12px" }}>Rúbrica Extraída</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {uni.criterios?.map((crit: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: "#fcfcfd", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                          <span style={{ fontWeight: "600", color: "#475569" }}>{crit.nombre}</span>
                          <span style={{ fontWeight: "800", color: "#10b981", backgroundColor: "#ecfdf5", padding: "4px 8px", borderRadius: "6px" }}>{crit.peso}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* COLUMNA DERECHA: DATOS GENERALES */}
            <aside style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
                <h3 style={{ color: "#1B396A", fontSize: "1rem", fontWeight: "800", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <BookOpen size={18} color="#3b82f6" /> Ficha Técnica
                </h3>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "800" }}>NOMBRE OFICIAL</label>
                  <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "1.1rem" }}>{courseData.nombre}</div>
                </div>
                <div>
                  <label style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "800" }}>CLAVE</label>
                  <div style={{ fontWeight: "700", color: "#64748b" }}>{courseData.clave}</div>
                </div>
              </div>

              <div style={{ backgroundColor: "#1B396A", borderRadius: "24px", padding: "24px", color: "white" }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: "1rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Target size={18} /> Competencias
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {courseData.competencias?.map((comp: string, i: number) => (
                    <div key={i} style={{ fontSize: "0.85rem", opacity: 0.9, lineHeight: "1.4", display: "flex", gap: "8px" }}>
                      <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0, marginTop: "2px" }} /> {comp}
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* --- ESTADO 3: ÉXITO --- */}
      {step === "guardado" && (
        <div style={{ height: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: "24px" }}>
          <div style={{ backgroundColor: "#ecfdf5", color: "#10b981", padding: "24px", borderRadius: "50%" }}>
            <CheckCircle2 size={64} />
          </div>
          <div>
            <h2 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "900", margin: 0 }}>Despliegue Exitoso</h2>
            <p style={{ color: "#64748b", marginTop: "8px", fontSize: "1.1rem" }}>La materia, bóveda y matriz de evaluación han sido creadas.</p>
          </div>
          <button 
            onClick={() => window.location.href = "/inicio"}
            style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "14px 32px", borderRadius: "14px", fontWeight: "800", cursor: "pointer", marginTop: "16px" }}
          >
            Volver al Centro de Mando
          </button>
        </div> 
      )}

    </div>
  );
}