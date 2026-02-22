"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { QrCode, Timer, Save, MapPin, Check, X, AlertTriangle, XCircle, UsersRound } from "lucide-react";

type Student = {
  id: string;
  matricula: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  nombres: string;
};

// COMPONENTE EXPANDIBLE UNIFICADO: Solo icono por defecto, se estira para mostrar texto en hover.
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", type = "button", disabled = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", border: "transparent" };
      case "cancel": return { bg: "white", hoverBg: "#fee2e2", text: isHovered ? "#ef4444" : "#64748b", border: isHovered ? "#ef4444" : "#cbd5e1" };
      default: return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", border: "#cbd5e1" };
    }
  };

  const style = getStyles();

  return (
    <button
      type={type} onClick={onClick} disabled={disabled} 
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      title={label}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", 
        gap: isHovered && !disabled ? "10px" : "0px",
        backgroundColor: isHovered && !disabled ? style.hoverBg : style.bg, 
        color: style.text, 
        border: `1px solid ${style.border}`,
        borderRadius: "12px", 
        padding: "0 14px", 
        height: "44px", 
        fontWeight: "600", 
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
        overflow: "hidden", 
        whiteSpace: "nowrap",
        boxShadow: variant === 'primary' && !disabled ? "0 4px 6px rgba(0,0,0,0.1)" : "none"
      }}
    >
      {Icon && <Icon size={20} style={{ flexShrink: 0 }} />}
      <span style={{ 
        maxWidth: isHovered && !disabled ? "200px" : "0px", 
        opacity: isHovered && !disabled ? 1 : 0, 
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
        display: "inline-block" 
      }}>
        {label}
      </span>
    </button>
  );
};

export default function PaseDeLista() {
  const params = useParams();
  const courseId = params?.id as string;

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeLeft, setTimeLeft] = useState(300); 
  const [isActive, setIsActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [sesion, setSesion] = useState("1");
  const [sesionesGuardadasHoy, setSesionesGuardadasHoy] = useState<string[]>([]);
  
  const [asistencia, setAsistencia] = useState<Record<string, number>>({});

  useEffect(() => { if (courseId) fetchData(); }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date().toLocaleDateString('en-CA'); 

      const { data: studentsData } = await supabase.from("students").select("id, matricula, apellido_paterno, apellido_materno, nombres").eq("course_id", courseId).order("apellido_paterno", { ascending: true });
      if (studentsData) setStudents(studentsData);

      const { data: attendanceData } = await supabase.from("attendance").select("session_number").eq("course_id", courseId).eq("session_date", today);

      if (attendanceData) {
        const completedSessions = Array.from(new Set(attendanceData.map(a => a.session_number.toString())));
        setSesionesGuardadasHoy(completedSessions);
        
        if (completedSessions.includes("1") && !completedSessions.includes("2")) setSesion("2");
      }
    } catch (error) { console.error("Error cargando datos:", error); } finally { setLoading(false); }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    else if (timeLeft === 0) setIsActive(false);
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const startTimer = () => {
    const estadoInicial: Record<string, number> = {};
    students.forEach(student => { estadoInicial[student.id] = 0; });
    setAsistencia(estadoInicial);
    setIsActive(true);
  };
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const toggleAsistencia = (id: string, valor: number) => {
    setAsistencia(prev => ({ ...prev, [id]: valor }));
  };

  const cancelarPase = () => {
    setIsActive(false);
    setTimeLeft(300);
    setAsistencia({});
  };

  const guardarAsistencia = async () => {
    if (Object.keys(asistencia).length === 0) return alert("Inicia el pase de lista primero.");
    
    setIsSaving(true);
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const recordsToInsert = students.map(student => ({
        course_id: courseId, student_id: student.id, session_date: today, session_number: parseInt(sesion),
        status: asistencia[student.id] ?? 0 
      }));

      const { error } = await supabase.from("attendance").upsert(recordsToInsert, { onConflict: "student_id, session_date, session_number" });
      if (error) throw error;

      alert(`¡Asistencia de la Sesión ${sesion} guardada con éxito!`);
      cancelarPase();
      fetchData(); 
    } catch (error) { alert("Hubo un error al guardar la asistencia."); } finally { setIsSaving(false); }
  };

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "30px" }}>
      
      {/* CABECERA */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0" }}>Pase de Lista Dinámico</h1>
          <p style={{ color: "#64748b", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <MapPin size={18} /> Validación por Geolocalización activada
          </p>
        </div>

        {/* BOTÓN EXPANDIBLE DE GUARDAR */}
        <ExpandingButton 
          icon={Save} label={isSaving ? "Guardando..." : "Guardar Asistencia"} 
          onClick={guardarAsistencia} disabled={!isActive || isSaving} variant="primary"
        />
      </header>

      {/* PANEL SUPERIOR */}
      <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "30px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "420px", margin: "0 auto", width: "100%", boxShadow: "0 10px 25px -5px rgba(27, 57, 106, 0.1)" }}>
        
        {/* Reloj */}
        <div style={{ fontSize: "3.5rem", fontWeight: "800", color: isActive ? "#ef4444" : "#1B396A", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
          <Timer size={48} />
          {formatTime(timeLeft)}
        </div>

        {!isActive && (
          <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ color: "#64748b", fontWeight: "600", fontSize: "0.95rem" }}>Sesión del día:</label>
            <select 
              value={sesion} onChange={(e) => setSesion(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", color: "#1B396A", fontWeight: "600", cursor: "pointer" }}
            >
              <option value="1" disabled={sesionesGuardadasHoy.includes("1")}>Sesión 1 {sesionesGuardadasHoy.includes("1") ? "(Completada)" : ""}</option>
              <option value="2" disabled={sesionesGuardadasHoy.includes("2")}>Sesión 2 {sesionesGuardadasHoy.includes("2") ? "(Completada)" : ""}</option>
            </select>
          </div>
        )}

        {/* ÁREA DEL QR */}
        <div style={{ width: "250px", height: "250px", backgroundColor: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: "16px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", marginBottom: "20px" }}>
          {!isActive ? (
            // ESTADO INACTIVO: Botón Expandible para "Generar QR"
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
              <UsersRound size={50} color="#cbd5e1" />
              <ExpandingButton 
                icon={QrCode} 
                label={(sesionesGuardadasHoy.includes("1") && sesionesGuardadasHoy.includes("2")) ? "Día Completado" : "Generar QR"} 
                onClick={startTimer} 
                disabled={sesionesGuardadasHoy.includes("1") && sesionesGuardadasHoy.includes("2")} 
                variant="primary" 
              />
            </div>
          ) : (
            // ESTADO ACTIVO: Se muestra el QR real y el texto escaneando
            <>
              <QrCode size={150} color="#1B396A" />
              <p style={{ margin: "10px 0 0 0", color: "#10b981", fontSize: "0.85rem", fontWeight: "700" }}>Escaneando dispositivos...</p>
            </>
          )}
        </div>

        {/* BOTÓN EXPANDIBLE DE CANCELAR */}
        <div style={{ height: "48px", display: "flex", justifyContent: "center", width: "100%", opacity: isActive ? 1 : 0, pointerEvents: isActive ? "auto" : "none", transition: "opacity 0.2s" }}>
          <ExpandingButton icon={XCircle} label="Cancelar Sesión" onClick={cancelarPase} variant="cancel" />
        </div>
      </div>

      {/* PANEL INFERIOR: LA LISTA DE ALUMNOS REALES */}
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", width: "100%" }}>
        <div style={{ backgroundColor: "#f8fafc", padding: "20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#1B396A" }}>Registro en Tiempo Real</h2>
          {isActive ? (
            <span style={{ backgroundColor: "#10b981", color: "white", padding: "4px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}><span style={{width: "8px", height: "8px", backgroundColor: "white", borderRadius: "50%", display: "inline-block", animation: "pulse 1.5s infinite"}}></span>Sesión {sesion} Activa</span>
          ) : (
            <span style={{ backgroundColor: "#e2e8f0", color: "#64748b", padding: "4px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "600" }}>Esperando inicio...</span>
          )}
        </div>
        
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ color: "#64748b", fontSize: "0.85rem", textTransform: "uppercase" }}>
              <th style={{ padding: "16px 20px" }}>Matrícula & Nombre</th>
              <th style={{ padding: "16px 20px", textAlign: "right" }}>Estado Manual</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan={2} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Cargando alumnos de la materia...</td></tr>
            ) : students.length === 0 ? (
               <tr><td colSpan={2} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Agrega alumnos a la materia para poder pasar lista.</td></tr>
            ) : (
              students.map((alumno) => (
                <tr key={alumno.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.85rem", marginBottom: "4px" }}>{alumno.matricula}</div>
                    <div style={{ color: "#1B396A", fontWeight: "600", opacity: isActive ? 1 : 0.5 }}>
                      {`${alumno.apellido_paterno} ${alumno.apellido_materno || ""} ${alumno.nombres}`}
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", opacity: isActive ? 1 : 0.3, pointerEvents: isActive ? "auto" : "none" }}>
                      <button onClick={() => toggleAsistencia(alumno.id, 0)} style={{ width: "40px", height: "40px", borderRadius: "8px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", border: "none", backgroundColor: asistencia[alumno.id] === 0 ? "#fee2e2" : "#f1f5f9", color: asistencia[alumno.id] === 0 ? "#ef4444" : "#94a3b8", transition: "all 0.2s" }} title="Falta (0)"><X size={20} /></button>
                      <button onClick={() => toggleAsistencia(alumno.id, 0.5)} style={{ width: "40px", height: "40px", borderRadius: "8px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", border: "none", backgroundColor: asistencia[alumno.id] === 0.5 ? "#fef3c7" : "#f1f5f9", color: asistencia[alumno.id] === 0.5 ? "#f59e0b" : "#94a3b8", transition: "all 0.2s" }} title="Retardo (0.5)"><AlertTriangle size={18} /></button>
                      <button onClick={() => toggleAsistencia(alumno.id, 1)} style={{ width: "40px", height: "40px", borderRadius: "8px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", border: "none", backgroundColor: asistencia[alumno.id] === 1 ? "#dcfce3" : "#f1f5f9", color: asistencia[alumno.id] === 1 ? "#10b981" : "#94a3b8", transition: "all 0.2s" }} title="Asistencia (1)"><Check size={20} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}