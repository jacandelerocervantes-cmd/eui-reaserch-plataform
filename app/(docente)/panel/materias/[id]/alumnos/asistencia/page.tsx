"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { QrCode, Timer, Save, MapPin, Check, X, AlertTriangle, XCircle, UsersRound, MapPinOff } from "lucide-react";
import QRCode from "react-qr-code"; // <-- La librería real del QR

type Student = {
  id: string;
  matricula: string;
  nombre_completo: string;
};

// COMPONENTE EXPANDIBLE UNIFICADO
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
  const [geocercaActiva, setGeocercaActiva] = useState(false);

  const [timeLeft, setTimeLeft] = useState(300); 
  const [isActive, setIsActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [sesionId, setSesionId] = useState<string | null>(null);
  const [qrHash, setQrHash] = useState<string | null>(null);
  
  const [asistencia, setAsistencia] = useState<Record<string, number>>({});

  useEffect(() => { if (courseId) fetchData(); }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Verificar si la materia tiene Geocerca configurada
      const { data: geocerca } = await supabase
        .from("geocercas_materia")
        .select("id")
        .eq("materia_id", courseId)
        .single();
      
      if (geocerca) setGeocercaActiva(true);

      // 2. Traer alumnos inscritos desde la nueva estructura SQL
      const { data: inscripciones } = await supabase
        .from("inscripciones")
        .select(`
          perfiles ( id, matricula_rfc, nombre_completo )
        `)
        .eq("materia_id", courseId);

      if (inscripciones) {
        const mappedStudents = inscripciones.map((i: any) => ({
          id: i.perfiles.id,
          matricula: i.perfiles.matricula_rfc,
          nombre_completo: i.perfiles.nombre_completo
        }));
        setStudents(mappedStudents);
      }
    } catch (error) { 
      console.error("Error cargando datos:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  // ========================================================================
  // MOTOR DE SUPABASE REALTIME (Escucha validaciones del alumno en vivo)
  // ========================================================================
  useEffect(() => {
    let channel: any;
    
    if (isActive && sesionId) {
      channel = supabase
        .channel('asistencias-en-vivo')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'asistencias_validadas',
            filter: `sesion_id=eq.${sesionId}` 
        }, (payload) => {
            // ¡MAGIA! Un alumno acaba de validar su GPS y QR. Lo ponemos en verde.
            setAsistencia(prev => ({ ...prev, [payload.new.alumno_id]: 1 }));
        })
        .subscribe();
    }

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [isActive, sesionId]);

  // ========================================================================
  // TEMPORIZADOR Y CONTROL DE SESIÓN
  // ========================================================================
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    else if (timeLeft === 0) terminarSesionAutomatica();
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const startTimer = async () => {
    if (!geocercaActiva) {
        alert("Debes configurar la ubicación del salón (Geocerca) antes de pasar lista.");
        return;
    }

    setIsSaving(true);
    try {
      // Generamos un Hash único para el QR
      const nuevoHash = crypto.randomUUID();
      
      // Calculamos expiración (5 minutos)
      const expiraEn = new Date();
      expiraEn.setMinutes(expiraEn.getMinutes() + 5);

      // Creamos la sesión In-Situ en la BD
      const { data: nuevaSesion, error } = await supabase
        .from("sesiones_insitu")
        .insert({
          materia_id: courseId,
          tipo: 'pase_lista',
          codigo_qr_hash: nuevoHash,
          fecha_expiracion: expiraEn.toISOString()
        })
        .select("id")
        .single();

      if (error) throw error;

      setSesionId(nuevaSesion.id);
      setQrHash(nuevoHash);

      // Reiniciamos UI
      const estadoInicial: Record<string, number> = {};
      students.forEach(student => { estadoInicial[student.id] = 0; }); // Todos con falta por defecto
      setAsistencia(estadoInicial);
      
      setTimeLeft(300);
      setIsActive(true);
    } catch (error) {
      alert("Error al iniciar sesión in-situ.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const toggleAsistencia = (id: string, valor: number) => {
    setAsistencia(prev => ({ ...prev, [id]: valor }));
  };

  const terminarSesionAutomatica = async () => {
    setIsActive(false);
    if (sesionId) {
       // Congelamos el QR en la BD para que nadie más se registre
       await supabase.from("sesiones_insitu").update({ is_activa: false }).eq("id", sesionId);
    }
  };

  const cancelarPase = async () => {
    await terminarSesionAutomatica();
    setTimeLeft(300);
    setAsistencia({});
    setSesionId(null);
    setQrHash(null);
  };

  const guardarAsistencia = async () => {
    if (Object.keys(asistencia).length === 0) return alert("Inicia el pase de lista primero.");
    
    setIsSaving(true);
    try {
      await terminarSesionAutomatica(); // Cerrar la sesión QR
      
      // Aquí el maestro guarda manualmente a los que puso retardo (0.5) 
      // o a los que no traían celular pero justificaron.
      // Filtramos a los que el maestro les puso "Falta(0)" porque no se insertan en 'asistencias_validadas'.
      const manualOverrides = Object.entries(asistencia)
        .filter(([_, valor]) => valor > 0)
        .map(([alumno_id, valor]) => ({
            sesion_id: sesionId,
            alumno_id: alumno_id,
        }));

      if(manualOverrides.length > 0){
          // Usamos upsert por si el alumno ya se había registrado vía Realtime
          await supabase.from("asistencias_validadas").upsert(manualOverrides, { onConflict: "sesion_id, alumno_id" });
      }

      alert(`¡Asistencia In-Situ guardada y sellada con éxito!`);
      setAsistencia({});
      setSesionId(null);
      setTimeLeft(300);
    } catch (error) { 
        alert("Hubo un error al guardar la asistencia."); 
    } finally { 
        setIsSaving(false); 
    }
  };

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "30px" }}>
      
      {/* CABECERA */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0" }}>Radar de Clase (In-Situ)</h1>
          {geocercaActiva ? (
            <p style={{ color: "#10b981", margin: 0, display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" }}>
                <MapPin size={18} /> Geocerca del Salón Activa
            </p>
          ) : (
            <p style={{ color: "#ef4444", margin: 0, display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" }}>
                <MapPinOff size={18} /> Geocerca no configurada (Requiere acción)
            </p>
          )}
        </div>

        {/* BOTÓN EXPANDIBLE DE GUARDAR */}
        <ExpandingButton 
          icon={Save} label={isSaving ? "Sellando Sesión..." : "Sellar Asistencia"} 
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

        {/* ÁREA DEL QR */}
        <div style={{ width: "250px", height: "250px", backgroundColor: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: "16px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", marginBottom: "20px" }}>
          {!isActive ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
              <UsersRound size={50} color="#cbd5e1" />
              <ExpandingButton 
                icon={QrCode} 
                label={isSaving ? "Generando..." : "Generar QR Dinámico"} 
                onClick={startTimer} 
                disabled={!geocercaActiva || isSaving} 
                variant="primary" 
              />
            </div>
          ) : (
            <>
              {/* QR REAL RENDERIZADO AQUÍ */}
              <div style={{ background: 'white', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                 <QRCode 
                   value={qrHash || "Generando..."} 
                   size={130} 
                   fgColor="#1B396A" 
                 />
              </div>
              <p style={{ margin: "15px 0 0 0", color: "#10b981", fontSize: "0.85rem", fontWeight: "800" }}>Escaneando dispositivos...</p>
              <p style={{ margin: "5px 0 0 0", color: "#94a3b8", fontSize: "0.65rem", fontFamily: "monospace" }}>HASH: {qrHash?.split('-')[0]}...</p>
            </>
          )}
        </div>

        {/* BOTÓN EXPANDIBLE DE CANCELAR */}
        <div style={{ height: "48px", display: "flex", justifyContent: "center", width: "100%", opacity: isActive ? 1 : 0, pointerEvents: isActive ? "auto" : "none", transition: "opacity 0.2s" }}>
          <ExpandingButton icon={XCircle} label="Terminar QR" onClick={cancelarPase} variant="cancel" />
        </div>
      </div>

      {/* PANEL INFERIOR: LA LISTA DE ALUMNOS REALES */}
      <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", width: "100%" }}>
        <div style={{ backgroundColor: "#f8fafc", padding: "20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#1B396A" }}>Registro en Tiempo Real (Supabase)</h2>
          {isActive ? (
            <span style={{ backgroundColor: "#10b981", color: "white", padding: "4px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}><span style={{width: "8px", height: "8px", backgroundColor: "white", borderRadius: "50%", display: "inline-block", animation: "pulse 1.5s infinite"}}></span>Recepción Satelital Activa</span>
          ) : (
            <span style={{ backgroundColor: "#e2e8f0", color: "#64748b", padding: "4px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "600" }}>Transmisión apagada</span>
          )}
        </div>
        
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ color: "#64748b", fontSize: "0.85rem", textTransform: "uppercase" }}>
              <th style={{ padding: "16px 20px" }}>Matrícula & Nombre</th>
              <th style={{ padding: "16px 20px", textAlign: "right" }}>Anulación Manual (Docente)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan={2} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Consultando base de datos...</td></tr>
            ) : students.length === 0 ? (
               <tr><td colSpan={2} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Agrega alumnos a la materia ('inscripciones') para poder pasar lista.</td></tr>
            ) : (
              students.map((alumno) => (
                <tr key={alumno.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: asistencia[alumno.id] === 1 ? '#f0fdf4' : 'transparent' }}>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.85rem", marginBottom: "4px" }}>{alumno.matricula}</div>
                    <div style={{ color: "#1B396A", fontWeight: "600", opacity: isActive ? 1 : 0.5 }}>
                      {alumno.nombre_completo}
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