"use client";

import React, { useState, useEffect } from "react";
import { 
  UploadCloud, FileText, Calendar, Plus, 
  Trash2, CheckCircle2, Sparkles, AlertCircle, 
  Clock, MapPin, BookOpen, Save, Loader2 
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Inicializamos el cliente de Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ConfigurarHorarios() {
  const [isMounted, setIsMounted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduleData, setScheduleData] = useState<any[]>([]);

  useEffect(() => setIsMounted(true), []);

  // Simulación de escaneo por IA (Aquí podrías conectar Gemini Vision después)
  const handleFileUpload = () => {
    setIsScanning(true);
    setTimeout(() => {
      setScheduleData([
        { id: 1, materia: "Redes de Computadoras", dias: ["Lunes", "Miércoles"], hora: "10:00 - 12:00", salon: "K-4" },
        { id: 2, materia: "Programación Web", dias: ["Martes", "Jueves"], hora: "08:00 - 10:00", salon: "Laboratorio B" },
        { id: 3, materia: "Taller de Investigación", dias: ["Viernes"], hora: "12:00 - 14:00", salon: "Virtual" }
      ]);
      setIsScanning(false);
    }, 2000);
  };

  // FUNCIÓN PARA GUARDAR DATOS REALES
  const handleConfirmarHorario = async () => {
    try {
      setIsSaving(true);
      const { data, error } = await supabase.functions.invoke('sync-schedule', {
        body: { 
          action: 'guardarHorario', 
          payload: { materias: scheduleData } 
        }
      });

      if (error) throw error;

      if (data?.success) {
        alert("¡Horario confirmado y sincronizado con Google Calendar!");
      }
    } catch (err) {
      console.error("Error al guardar horario:", err);
      alert("Hubo un problema al guardar la carga académica.");
    } finally {
      setIsSaving(false);
    }
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
            backgroundColor: "white", borderRadius: "24px", padding: "40px", 
            border: "2px dashed #cbd5e1", textAlign: "center", display: "flex", 
            flexDirection: "column", alignItems: "center", gap: "16px",
            transition: "all 0.3s ease", cursor: "pointer"
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = "#1B396A"}
          onMouseOut={(e) => e.currentTarget.style.borderColor = "#cbd5e1"}
          onClick={handleFileUpload}
          >
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "#eff6ff", color: "#1B396A", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UploadCloud size={32} />
            </div>
            <div>
              <h3 style={{ margin: "0 0 8px 0", color: "#1B396A", fontWeight: "800" }}>Subir Horario Oficial</h3>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Arrastra tu PDF o imagen de carga horaria aquí.</p>
            </div>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#8b5cf6", backgroundColor: "#f3f0ff", padding: "6px 12px", borderRadius: "20px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} /> Procesado por IA
            </span>
          </div>

          {/* Estado del Escaneo */}
          {isScanning && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#1B396A", fontWeight: "700", justifyContent: "center" }}>
              <Loader2 className="animate-spin" size={20} />
              Analizando documento con Gemini...
            </div>
          )}

          {/* Información de Ayuda */}
          <div style={{ backgroundColor: "#f8fafc", borderRadius: "20px", padding: "20px", display: "flex", gap: "16px" }}>
            <AlertCircle size={24} color="#3b82f6" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569", lineHeight: "1.5" }}>
              <b>Tip:</b> Si subes tu horario, el sistema bloqueará automáticamente esas horas para evitar que se agenden asesorías o reuniones en tiempo de clase.
            </p>
          </div>
        </section>

        {/* BLOQUE DERECHO: RESULTADOS / EDICIÓN MANUAL */}
        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ color: "#1B396A", fontSize: "1.2rem", fontWeight: "800", margin: 0 }}>Materias Detectadas</h2>
            {scheduleData.length > 0 && <button style={{ color: "#1B396A", background: "none", border: "none", fontWeight: "700", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}><Plus size={16}/> Añadir Materia</button>}
          </div>

          {scheduleData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {scheduleData.map((item) => (
                <div key={item.id} style={{ padding: "16px", borderRadius: "16px", border: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#1B396A", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.95rem" }}>{item.materia}</div>
                      <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12}/> {item.hora}</span>
                        <span style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}><MapPin size={12}/> {item.salon}</span>
                      </div>
                      <div style={{ marginTop: "6px", display: "flex", gap: "4px" }}>
                        {item.dias.map((d:string) => (
                          <span key={d} style={{ fontSize: "0.65rem", fontWeight: "800", backgroundColor: "#f1f5f9", color: "#1B396A", padding: "2px 6px", borderRadius: "4px" }}>{d}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button style={{ color: "#ef4444", padding: "8px", borderRadius: "8px", border: "none", background: "none", cursor: "pointer" }}><Trash2 size={18} /></button>
                </div>
              ))}
              
              <button 
                onClick={handleConfirmarHorario}
                disabled={isSaving}
                style={{ 
                  marginTop: "16px", backgroundColor: "#1B396A", color: "white", 
                  padding: "16px", borderRadius: "14px", fontWeight: "800", 
                  border: "none", cursor: isSaving ? "not-allowed" : "pointer", display: "flex", 
                  alignItems: "center", justifyContent: "center", gap: "10px",
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {isSaving ? "Guardando Carga..." : "Confirmar Carga Horaria"}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
              <Calendar size={48} style={{ marginBottom: "16px", opacity: 0.3 }} />
              <p>Aún no hay datos. Sube tu horario para comenzar.</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}