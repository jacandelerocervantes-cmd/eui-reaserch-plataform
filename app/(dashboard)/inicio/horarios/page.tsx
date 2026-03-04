"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  UploadCloud, FileText, Calendar, Plus, 
  Trash2, CheckCircle2, Sparkles, AlertCircle, 
  Clock, MapPin, BookOpen, Save, Loader2, Bookmark
} from "lucide-react";
import { supabase } from "@/lib/supabase"; 

// Mapeo de colores para los 3 Pilares Oficiales
const PILAR_COLORS: Record<string, string> = {
  DOCENCIA: "#3b82f6",
  INVESTIGACION: "#f59e0b",
  INSTITUCIONAL: "#64748b"
};

interface MateriaExtraida {
  id?: number;
  materia: string;
  tipo: "DOCENCIA" | "INVESTIGACION" | "INSTITUCIONAL";
  dias: string[];
  hora: string;
  salon: string;
}

export default function ConfigurarHorariosIEO() {
  const [isMounted, setIsMounted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduleData, setScheduleData] = useState<MateriaExtraida[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setIsMounted(true), []);

  // --- LÓGICA DE DRAG & DROP Y EXTRACCIÓN IA ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processScheduleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processScheduleFile(e.target.files[0]);
    }
  };

  const processScheduleFile = async (file: File) => {
    setIsScanning(true);
    try {
      // Ruta 1: Enviamos el archivo crudo (Multipart)
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('sync-schedule', {
        body: formData,
      });

      if (error) throw error;

      if (data && data.success) {
        setScheduleData(data.data); 
      } else {
        alert(`Anomalía de Extracción: ${data.error}`);
      }
    } catch (err) {
      console.error("Fallo de conexión IEO:", err);
      alert("Error crítico: Pérdida de conexión con Gemini 2.5 Flash.");
    } finally {
      setIsScanning(false);
      // Limpiamos el input para permitir subir el mismo archivo si hubo error
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- LÓGICA PARA GUARDAR EN SUPABASE Y APPS SCRIPT ---
  const handleConfirmarHorario = async () => {
    try {
      setIsSaving(true);
      
      // Ruta 2: Enviamos el JSON confirmado
      const { data, error } = await supabase.functions.invoke('sync-schedule', {
        body: { 
          action: 'guardarHorario', 
          payload: { materias: scheduleData } 
        }
      });

      if (error) throw error;

      if (data?.success) {
        alert("¡Horario confirmado, inyectado en base de datos y sincronizado con Google Calendar!");
        // Aquí podrías redirigir al inicio: window.location.href = "/inicio";
      } else {
        alert(`Fallo en el despliegue: ${data?.error}`);
      }
    } catch (err) {
      console.error("Error al guardar horario:", err);
      alert("Anomalía: Hubo un problema al guardar la carga académica en el Gateway.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMateria = (indexToDelete: number) => {
    setScheduleData(prev => prev.filter((_, idx) => idx !== indexToDelete));
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {/* HEADER */}
      <header>
        <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0 }}>Carga Académica</h1>
        <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>
          Configura tus materias y horarios para automatizar tu agenda y pases de lista.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "32px", alignItems: "start" }}>
        
        {/* BLOQUE IZQUIERDO: CARGA DE ARCHIVO */}
        <section style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ 
            backgroundColor: dragActive ? "#f8fafc" : "white", 
            borderRadius: "24px", padding: "40px", 
            border: `2px dashed ${dragActive ? "#1B396A" : "#cbd5e1"}`, 
            textAlign: "center", display: "flex", 
            flexDirection: "column", alignItems: "center", gap: "16px",
            transition: "all 0.3s ease", cursor: "pointer"
          }}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          >
            <input 
              ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" 
              onChange={handleChange} style={{ display: "none" }} 
            />
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: dragActive ? "#1B396A" : "#eff6ff", color: dragActive ? "white" : "#1B396A", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
              <UploadCloud size={32} />
            </div>
            <div>
              <h3 style={{ margin: "0 0 8px 0", color: "#1B396A", fontWeight: "800" }}>Subir Horario Oficial</h3>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Arrastra tu PDF o imagen de carga horaria aquí.</p>
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#8b5cf6", backgroundColor: "#f3f0ff", padding: "6px 12px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} /> IEO Multimodal (Gemini 2.5)
            </span>
          </div>

          {/* Estado del Escaneo */}
          {isScanning && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#1B396A", fontWeight: "700", justifyContent: "center", backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
              <Loader2 className="animate-spin" size={20} />
              Extrayendo bloques y pilares horarios...
            </div>
          )}

          {/* Información de Ayuda */}
          <div style={{ backgroundColor: "#fcfcfd", borderRadius: "20px", padding: "20px", display: "flex", gap: "16px", border: "1px solid #f1f5f9" }}>
            <AlertCircle size={24} color="#3b82f6" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569", lineHeight: "1.5" }}>
              <b>Soberanía Operativa:</b> Al confirmar este horario, el sistema bloqueará automáticamente estas horas en tu agenda para evitar que el portal de alumnos agende citas durante tus clases.
            </p>
          </div>
        </section>

        {/* BLOQUE DERECHO: RESULTADOS / EDICIÓN MANUAL */}
        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ color: "#1B396A", fontSize: "1.2rem", fontWeight: "800", margin: 0 }}>Carga Detectada</h2>
            {scheduleData.length > 0 && <button style={{ color: "#1B396A", background: "none", border: "none", fontWeight: "700", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}><Plus size={16}/> Añadir Bloque</button>}
          </div>

          {scheduleData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {scheduleData.map((item, idx) => {
                const pilarColor = PILAR_COLORS[item.tipo] || PILAR_COLORS["INSTITUCIONAL"];
                
                return (
                  <div key={idx} style={{ padding: "16px", borderRadius: "16px", border: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fcfcfd", borderLeft: `4px solid ${pilarColor}` }}>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: `${pilarColor}15`, color: pilarColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <div style={{ fontWeight: "800", color: "#1e293b", fontSize: "0.95rem" }}>{item.materia}</div>
                          <span style={{ fontSize: "0.65rem", fontWeight: "800", color: pilarColor, backgroundColor: `${pilarColor}15`, padding: "2px 6px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Bookmark size={10} /> {item.tipo}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}><Clock size={12}/> {item.hora}</span>
                          <span style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}><MapPin size={12}/> {item.salon}</span>
                        </div>
                        <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {item.dias.map((d:string) => (
                            <span key={d} style={{ fontSize: "0.65rem", fontWeight: "800", backgroundColor: "#e2e8f0", color: "#334155", padding: "2px 8px", borderRadius: "6px" }}>{d}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteMateria(idx)}
                      style={{ color: "#ef4444", padding: "8px", borderRadius: "8px", border: "none", background: "none", cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#fee2e2"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
              
              <button 
                onClick={handleConfirmarHorario}
                disabled={isSaving}
                style={{ 
                  marginTop: "16px", backgroundColor: "#10b981", color: "white", 
                  padding: "16px", borderRadius: "14px", fontWeight: "800", 
                  border: "none", cursor: isSaving ? "not-allowed" : "pointer", display: "flex", 
                  alignItems: "center", justifyContent: "center", gap: "10px",
                  opacity: isSaving ? 0.7 : 1, boxShadow: "0 4px 6px rgba(16, 185, 129, 0.2)"
                }}
              >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {isSaving ? "Inyectando en Base de Datos..." : "Confirmar e Inyectar"}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
              <Calendar size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
              <h3 style={{ margin: "0 0 8px 0", color: "#475569" }}>Radar Vacío</h3>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>La IEO espera tu documento oficial para operar.</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}