"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { QrCode, Timer, Save, MapPin, Check, X, AlertTriangle, XCircle, UsersRound, MapPinOff, Loader2 } from "lucide-react";
import QRCode from "react-qr-code";

type Student = {
  id: string;
  matricula: string;
  nombre_completo: string;
};

const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", disabled = false }: any) => {
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
      onClick={onClick} disabled={disabled} 
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: isHovered && !disabled ? "10px" : "0px",
        backgroundColor: isHovered && !disabled ? style.hoverBg : style.bg, color: style.text, 
        border: `1px solid ${style.border}`, borderRadius: "12px", padding: "0 14px", height: "44px", 
        fontWeight: "600", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.3s"
      }}
    >
      {Icon && <Icon size={20} />}
      <span style={{ maxWidth: isHovered && !disabled ? "200px" : "0px", opacity: isHovered && !disabled ? 1 : 0, transition: "all 0.3s", display: "inline-block", overflow: "hidden" }}>
        {label}
      </span>
    </button>
  );
};

export default function PaseDeLista() {
  const { id: courseId } = useParams() as { id: string };
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
      const { data: geo } = await supabase.from("geocercas_materia").select("id").eq("materia_id", courseId).single();
      if (geo) setGeocercaActiva(true);

      const { data: insc } = await supabase.from("inscripciones").select(`perfiles ( id, matricula_rfc, nombre_completo )`).eq("materia_id", courseId);
      if (insc) {
        setStudents(insc.map((i: any) => ({ id: i.perfiles.id, matricula: i.perfiles.matricula_rfc, nombre_completo: i.perfiles.nombre_completo })));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    let channel: any;
    if (isActive && sesionId) {
      channel = supabase.channel('asistencias-en-vivo').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'asistencias_validadas', filter: `sesion_id=eq.${sesionId}` }, 
      (payload) => { setAsistencia(prev => ({ ...prev, [payload.new.alumno_id]: 1 })); }).subscribe();
    }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [isActive, sesionId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    else if (timeLeft === 0) terminarSesion();
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const startTimer = async () => {
    if (!geocercaActiva) return alert("Configura la Geocerca antes.");
    setIsSaving(true);
    try {
      const hash = crypto.randomUUID();
      const expira = new Date(); expira.setMinutes(expira.getMinutes() + 5);
      const { data, error } = await supabase.from("sesiones_insitu").insert({ materia_id: courseId, tipo: 'pase_lista', codigo_qr_hash: hash, fecha_expiracion: expira.toISOString() }).select("id").single();
      if (error) throw error;
      setSesionId(data.id); setQrHash(hash);
      const inicial: Record<string, number> = {}; students.forEach(s => inicial[s.id] = 0);
      setAsistencia(inicial); setTimeLeft(300); setIsActive(true);
    } catch (e) { alert("Error al iniciar sesión."); } finally { setIsSaving(false); }
  };

  const terminarSesion = async () => {
    setIsActive(false);
    if (sesionId) await supabase.from("sesiones_insitu").update({ is_activa: false }).eq("id", sesionId);
  };

  const guardarAsistencia = async () => {
    if (Object.keys(asistencia).length === 0) return;
    setIsSaving(true);
    try {
      await terminarSesion();
      // 1. Guardar cambios manuales en Supabase
      const overrides = Object.entries(asistencia).filter(([_, v]) => v > 0).map(([aid]) => ({ sesion_id: sesionId, alumno_id: aid }));
      if (overrides.length > 0) await supabase.from("asistencias_validadas").upsert(overrides, { onConflict: "sesion_id, alumno_id" });

      // 2. Sincronización Híbrida con Google Sheets
      const { data, error } = await supabase.functions.invoke('sync-attendance', {
        body: { courseId, asistenciaMap: asistencia }
      });
      if (error || !data.success) throw new Error("Falla en sincronización Drive");

      alert("¡Asistencia sellada y sincronizada en el Excel con éxito!");
      setAsistencia({}); setSesionId(null);
    } catch (e: any) { alert(`Error: ${e.message}`); } finally { setIsSaving(false); }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "30px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px" }}>Radar de Clase (In-Situ)</h1>
          <p style={{ color: geocercaActiva ? "#10b981" : "#ef4444", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
            {geocercaActiva ? <MapPin size={18} /> : <MapPinOff size={18} />} {geocercaActiva ? "Geocerca Activa" : "Geocerca no configurada"}
          </p>
        </div>
        <ExpandingButton icon={isSaving ? Loader2 : Save} label={isSaving ? "Procesando..." : "Sellar Asistencia"} onClick={guardarAsistencia} disabled={!isActive || isSaving} variant="primary" />
      </header>

      <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", padding: "30px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "420px", margin: "0 auto", width: "100%", boxShadow: "0 10px 25px rgba(27, 57, 106, 0.1)" }}>
        <div style={{ fontSize: "3.5rem", fontWeight: "800", color: isActive ? "#ef4444" : "#1B396A", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
          <Timer size={48} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
        </div>
        <div style={{ width: "250px", height: "250px", backgroundColor: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: "16px", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "20px" }}>
          {!isActive ? (
            <ExpandingButton icon={QrCode} label="Generar QR Dinámico" onClick={startTimer} disabled={!geocercaActiva || isSaving} />
          ) : (
            <div style={{ background: 'white', padding: '10px', borderRadius: '12px' }}><QRCode value={qrHash || ""} size={150} fgColor="#1B396A" /></div>
          )}
        </div>
        {isActive && <ExpandingButton icon={XCircle} label="Terminar QR" onClick={() => { setIsActive(false); setSesionId(null); }} variant="cancel" />}
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ backgroundColor: "#f8fafc", padding: "20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#1B396A" }}>Registro en Tiempo Real</h2>
          {isActive && <span style={{ color: "#10b981", fontWeight: "700" }}>● Recepción Activa</span>}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ color: "#64748b", fontSize: "0.85rem" }}><th style={{ padding: "16px 20px", textAlign: "left" }}>Alumno</th><th style={{ padding: "16px 20px", textAlign: "right" }}>Control Manual</th></tr></thead>
          <tbody>
            {loading ? (<tr><td colSpan={2} style={{ padding: "40px", textAlign: "center" }}>Cargando...</td></tr>) : students.map(s => (
              <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: asistencia[s.id] === 1 ? '#f0fdf4' : 'transparent' }}>
                <td style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#64748b" }}>{s.matricula}</div>
                  <div style={{ fontWeight: "600", color: "#1B396A" }}>{s.nombre_completo}</div>
                </td>
                <td style={{ padding: "16px 20px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    {[0, 0.5, 1].map(v => (
                      <button key={v} onClick={() => setAsistencia(prev => ({ ...prev, [s.id]: v }))} style={{ width: "36px", height: "36px", borderRadius: "8px", border: "none", cursor: "pointer", backgroundColor: asistencia[s.id] === v ? (v === 1 ? "#dcfce3" : v === 0.5 ? "#fef3c7" : "#fee2e2") : "#f1f5f9", color: asistencia[s.id] === v ? (v === 1 ? "#10b981" : v === 0.5 ? "#f59e0b" : "#ef4444") : "#94a3b8" }}>
                        {v === 1 ? <Check size={18} /> : v === 0.5 ? <AlertTriangle size={16} /> : <X size={18} />}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}