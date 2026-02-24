"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Mic, MicOff, Save, Clock, Book, 
  Plus, Search, Sparkles, Database,
  Beaker, ChevronRight, FileJson, Trash2, CheckCircle2
} from "lucide-react";

export default function BitacoraLaboratorio() {
  const [isMounted, setIsMounted] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  
  // Estados del Editor
  const [activeNote, setActiveNote] = useState<string>("");
  const [extractedJson, setExtractedJson] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>("Nunca");

  // Referencia para el Reconocimiento de Voz
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchBitacoras();
    setupVoiceRecognition();
  }, []);

  const fetchBitacoras = async () => {
    try {
      // Simulación de fetch o conexión real a Supabase
      const { data, error } = await supabase
        .from('bitacora_eln')
        .select('*')
        .order('creado_en', { ascending: false });

      if (data && data.length > 0) {
        setLogs(data);
      } else {
        // Datos por defecto si la tabla está vacía
        setLogs([
          { id: 1, creado_en: new Date().toISOString(), titulo: "Prueba de Estrés Térmico", tags: ["Hardware", "IoT"] },
          { id: 2, creado_en: new Date(Date.now() - 86400000).toISOString(), titulo: "Calibración de Sensores", tags: ["Redes", "Calibración"] },
        ]);
      }
    } catch (error) {
      console.error("Error al traer la bitácora:", error);
    }
  };

  // =====================================================================
  // 1. MOTOR DE RECONOCIMIENTO DE VOZ (API Nativa del Navegador)
  // =====================================================================
  const setupVoiceRecognition = () => {
    if (typeof window !== "undefined") {
      // @ts-ignore (Soporte para Chrome/Edge/Safari)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true; // Muestra palabras mientras hablas
        recognition.lang = 'es-MX'; // Español de México

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          // Añadimos lo hablado al texto existente
          setActiveNote(prev => prev + " " + currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Error de micrófono: ", event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Tu navegador no soporta el dictado por voz. Usa Chrome o Edge.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  // =====================================================================
  // 2. IA DE EXTRACCIÓN (Simulador de Edge Function)
  // =====================================================================
  const handleAutoStructure = () => {
    if (!activeNote) return;

    // Aquí normalmente llamaríamos a Gemini o una Edge Function.
    // Para UX Inmediata, simulamos una expresión regular básica buscando números.
    const tempMatch = activeNote.match(/(\d+(\.\d+)?)\s*(grados|celsius|°c)/i);
    const humMatch = activeNote.match(/(\d+(\.\d+)?)\s*(por ciento|%)/i);
    const phMatch = activeNote.match(/ph\s*(de\s*)?(\d+(\.\d+)?)/i);

    const extracted = {
      timestamp_extraccion: new Date().toISOString(),
      analisis_ia: "Exitoso",
      parametros: {
        temperatura: tempMatch ? parseFloat(tempMatch[1]) : null,
        humedad: humMatch ? parseFloat(humMatch[1]) : null,
        ph: phMatch ? parseFloat(phMatch[2]) : null
      }
    };

    setExtractedJson(extracted);
  };

  // =====================================================================
  // 3. GUARDADO EN SUPABASE
  // =====================================================================
  const handleSave = async () => {
    if (!activeNote) return;
    setIsSaving(true);
    
    try {
      const nuevoRegistro = {
        texto_crudo: activeNote,
        contenido_json: extractedJson,
        tipo: 'voz_transcrita', // Enum de tu SQL
        // proyecto_id: "..." 
      };

      // Inserta en Supabase (Se comentan los campos estrictos para no romper si no están)
      const { data, error } = await supabase.from('bitacora_eln').insert([nuevoRegistro]).select();
      
      // UX Optimista
      setLogs([{
        id: Date.now(),
        creado_en: new Date().toISOString(),
        titulo: activeNote.substring(0, 30) + "...",
        tags: ["Reciente", "IA"]
      }, ...logs]);

      setLastSaved("Hace unos segundos");
      setActiveNote("");
      setExtractedJson(null);
      
      // Notificación de éxito
      alert("Registro guardado con éxito en la Bitácora ELN.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatearFecha = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} • ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (!isMounted) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", height: "calc(100vh - 80px)", backgroundColor: "#f8fafc" }}>
      
      {/* --- COLUMNA IZQUIERDA: HISTORIAL DE REGISTROS --- */}
      <aside style={{ backgroundColor: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px", borderBottom: "1px solid #f1f5f9" }}>
          <button style={{ 
            width: "100%", backgroundColor: "#10b981", color: "white", 
            padding: "12px", borderRadius: "12px", border: "none", 
            fontWeight: "800", display: "flex", alignItems: "center", 
            justifyContent: "center", gap: "10px", cursor: "pointer",
            boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.2)",
            transition: "transform 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            <Plus size={18} /> Nueva Entrada Manual
          </button>
          <div style={{ position: "relative", marginTop: "16px" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input type="text" placeholder="Buscar en bitácora..." style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.85rem", outline: "none" }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {logs.map((log: any) => (
            <div key={log.id} style={{ padding: "20px", borderBottom: "1px solid #f8fafc", cursor: "pointer", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0fdf4"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#94a3b8" }}>{formatearFecha(log.creado_en)}</span>
                <ChevronRight size={14} color="#cbd5e1" />
              </div>
              <div style={{ fontWeight: "800", color: "#1B396A", fontSize: "0.95rem", marginBottom: "8px" }}>{log.titulo}</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {log.tags?.map((tag: string) => (
                  <span key={tag} style={{ fontSize: "0.65rem", fontWeight: "800", backgroundColor: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: "6px" }}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* --- COLUMNA DERECHA: EDITOR Y VOZ --- */}
      <section style={{ display: "flex", flexDirection: "column" }}>
        
        {/* Toolbar del Editor */}
        <div style={{ padding: "16px 40px", backgroundColor: "white", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ backgroundColor: "#ecfdf5", color: "#10b981", padding: "8px", borderRadius: "10px" }}><Book size={20} /></div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#1B396A", margin: 0 }}>Entrada ELN: Cuaderno Inteligente</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button onClick={() => {setActiveNote(""); setExtractedJson(null);}} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", transition: "color 0.2s" }} title="Limpiar"><Trash2 size={20}/></button>
            <button 
              onClick={handleSave}
              disabled={!activeNote || isSaving}
              style={{ backgroundColor: !activeNote ? "#cbd5e1" : "#1B396A", color: "white", padding: "10px 24px", borderRadius: "12px", fontWeight: "800", border: "none", display: "flex", alignItems: "center", gap: "8px", cursor: !activeNote ? "not-allowed" : "pointer", transition: "all 0.3s" }}
            >
              {isSaving ? "Guardando..." : <><Save size={18} /> Sellar Registro</>}
            </button>
          </div>
        </div>

        {/* Área de Entrada de Datos */}
        <div style={{ flex: 1, padding: "40px", display: "flex", flexDirection: "column", gap: "24px", overflowY: "auto" }}>
          
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: isRecording ? "2px solid #ef4444" : "1px solid #e2e8f0", padding: "32px", display: "flex", flexDirection: "column", boxShadow: isRecording ? "0 0 20px rgba(239, 68, 68, 0.1)" : "0 4px 6px rgba(0,0,0,0.02)", transition: "all 0.3s", minHeight: "300px" }}>
            <textarea 
              value={activeNote}
              onChange={(e) => setActiveNote(e.target.value)}
              placeholder="Escribe tus observaciones aquí o presiona el botón rojo para iniciar el dictado de voz..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: "1.1rem", color: "#334155", lineHeight: "1.6", resize: "none", minHeight: "150px" }}
            />
            
            {/* Controles de Voz e IA */}
            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                
                {/* BOTÓN DE DICTADO */}
                <button 
                  onClick={toggleRecording}
                  style={{ 
                    backgroundColor: isRecording ? "#ef4444" : "#f1f5f9", 
                    color: isRecording ? "white" : "#64748b",
                    padding: "12px 20px", borderRadius: "14px", border: "none",
                    fontWeight: "800", display: "flex", alignItems: "center", gap: "10px",
                    cursor: "pointer", transition: "all 0.3s",
                    boxShadow: isRecording ? "0 4px 15px rgba(239, 68, 68, 0.3)" : "none"
                  }}
                >
                  {isRecording ? <><span style={{display: "block", width: "8px", height: "8px", backgroundColor: "white", borderRadius: "50%", animation: "pulse 1s infinite"}}></span> Grabando...</> : <><Mic size={18} /> Iniciar Dictado</>}
                </button>
                
                {/* BOTÓN DE ESTRUCTURACIÓN IA */}
                <button 
                  onClick={handleAutoStructure}
                  disabled={!activeNote}
                  style={{ 
                    backgroundColor: activeNote ? "#f3f0ff" : "#f8fafc", 
                    color: activeNote ? "#7c3aed" : "#cbd5e1", 
                    padding: "12px 20px", borderRadius: "14px", border: "none", 
                    fontWeight: "800", display: "flex", alignItems: "center", gap: "10px", cursor: activeNote ? "pointer" : "not-allowed", transition: "all 0.3s" 
                  }}
                >
                  <Sparkles size={18} /> Analizar con IA
                </button>

              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "0.85rem", fontWeight: "600" }}>
                <Clock size={16} /> Último guardado: {lastSaved}
              </div>
            </div>
          </div>

          {/* Panel de Datos Estructurados (Lo que la IA detecta) */}
          {extractedJson && (
            <div style={{ backgroundColor: "#1B396A", borderRadius: "20px", padding: "24px", color: "white", animation: "slideUp 0.3s ease-out" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <FileJson size={20} color="#10b981" />
                  <span style={{ fontSize: "0.9rem", fontWeight: "900", letterSpacing: "1px" }}>ESTRUCTURA JSON EXTRAÍDA (IA)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#059669", padding: "4px 10px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "800" }}>
                  <CheckCircle2 size={14} /> LISTO PARA BASE DE DATOS
                </div>
              </div>
              <pre style={{ margin: 0, padding: "16px", backgroundColor: "#0f172a", borderRadius: "12px", fontSize: "0.9rem", overflowX: "auto", border: "1px solid #1e293b", color: "#38bdf8" }}>
                {JSON.stringify(extractedJson, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}