"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, Mail, Calendar, CheckSquare, 
  Video, Plus, ChevronRight, Loader2, AlertCircle,
  Zap, X, Save
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase"; // USAR ESTO

const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary" }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const style = variant === "primary" 
    ? { bg: "#1B396A", text: "white" } 
    : { bg: "white", text: "#1B396A", border: "#e2e8f0" };

  return (
    <button
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: isHovered ? "10px" : "0px",
        backgroundColor: style.bg, color: style.text, border: style.border ? `1px solid ${style.border}` : "none",
        padding: "0 16px", height: "42px", borderRadius: "12px", fontWeight: "700",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", cursor: "pointer", overflow: "hidden",
        boxShadow: isHovered ? "0 4px 12px rgba(27, 57, 106, 0.15)" : "none"
      }}
    >
      <Icon size={18} />
      <span style={{ maxWidth: isHovered ? "200px" : "0px", opacity: isHovered ? 1 : 0, transition: "all 0.3s", whiteSpace: "nowrap", fontSize: "0.9rem" }}>
        {label}
      </span>
    </button>
  );
};

export default function CentroDeMando() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [dashboardData, setDashboardData] = useState({ emails: [] as any[], agenda: [] as any[], tasks: [] as any[] });

  // ESTADOS PARA MODALES
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMeetModal, setShowMeetModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newTask, setNewTask] = useState({ titulo: "", fecha: "" });
  const [newMeet, setNewMeet] = useState({ titulo: "", fecha: "", hora: "12:00", correo: "" });

  useEffect(() => {
    setIsMounted(true);
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true); setError(null);
      const { data, error: invokeError } = await supabase.functions.invoke('inicio-bridge', { body: { action: 'getDashboardData' } });
      if (invokeError) throw new Error(invokeError.message);
      if (data && data.success) {
        setDashboardData({ emails: data.data.emails || [], agenda: data.data.agenda || [], tasks: data.data.tasks || [] });
      } else {
        setError(data?.error || "Error en la clasificación de datos.");
      }
    } catch (err: any) {
      setError("No se pudo sincronizar con Google. Revisa la configuración de las Keys.");
    } finally {
      setLoading(false);
    }
  };

  // --- ACCIONES DE CREACIÓN RÁPIDA ---
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('inicio-bridge', {
        body: { action: 'crearTareaRapida', payload: newTask }
      });
      if (error || !data.success) throw new Error("Fallo al crear");
      setShowTaskModal(false); setNewTask({ titulo: "", fecha: "" });
      fetchDashboardData(); // Recargamos para ver la nueva tarea
    } catch (err) { alert("Error al conectar con Google Tasks"); } 
    finally { setIsSubmitting(false); }
  };

  const handleCreateMeet = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('inicio-bridge', {
        body: { action: 'crearReunionRapida', payload: newMeet }
      });
      if (error || !data.success) throw new Error("Fallo al agendar");
      setShowMeetModal(false); setNewMeet({ titulo: "", fecha: "", hora: "12:00", correo: "" });
      fetchDashboardData(); // Recargamos para ver la nueva cita en agenda
    } catch (err) { alert("Error al conectar con Google Calendar"); } 
    finally { setIsSubmitting(false); }
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px", fontFamily: "inherit" }}>
      
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.5rem", fontWeight: "950", margin: 0, letterSpacing: "-0.03em" }}>Centro de Mando</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={18} color="#8b5cf6" /> Tu radar operativo está al día.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={Plus} label="Nueva Tarea" variant="secondary" onClick={() => setShowTaskModal(true)} />
          <ExpandingButton icon={Video} label="Sesión Meet" variant="primary" onClick={() => setShowMeetModal(true)} />
        </div>
      </header>

      {error && (
        <div style={{ backgroundColor: "#fef2f2", color: "#b91c1c", padding: "16px", borderRadius: "16px", border: "1px solid #fecaca", display: "flex", alignItems: "center", gap: "12px", fontWeight: "600" }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {/* --- GRID DE 3 COLUMNAS --- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* CORREOS */}
        <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <h3 style={{ color: "#1B396A", fontSize: "1rem", fontWeight: "800", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}><Mail size={18} color="#ef4444" /> Bandeja Prioritaria</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {loading ? <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" color="#94a3b8" /></div> : 
             dashboardData.emails.length === 0 ? <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>Sin urgencias ✨</div> :
             dashboardData.emails.map((mail, i) => (
                <div key={i} style={{ padding: "14px", borderRadius: "14px", backgroundColor: "#f8fafc", borderLeft: `4px solid ${mail.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: "900", color: mail.color }}>{mail.categoria}</span>
                    <Zap size={12} color={mail.urgencia > 3 ? "#ef4444" : "#cbd5e1"} />
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mail.remitente}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>{mail.titulo}</div>
                </div>
              ))}
          </div>
        </div>

        {/* AGENDA */}
        <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
            <h2 style={{ color: "#1B396A", fontSize: "1.4rem", fontWeight: "900", margin: 0 }}>Agenda Operativa</h2>
            <div style={{ padding: "6px 12px", backgroundColor: "#f1f5f9", borderRadius: "8px", fontSize: "0.8rem", fontWeight: "700", color: "#475569" }}>
              {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", position: "relative" }}>
            <div style={{ position: "absolute", left: "7px", top: "10px", bottom: "10px", width: "2px", backgroundColor: "#f1f5f9" }} />
            {loading ? <div style={{ textAlign: "center", padding: "40px" }}><Loader2 className="animate-spin" color="#94a3b8" /></div> : 
             dashboardData.agenda.length === 0 ? <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>Libre.</div> :
             dashboardData.agenda.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "white", border: `4px solid ${item.color}`, zIndex: 1, marginTop: "4px" }} />
                  <div style={{ flex: 1, backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: "900", color: item.color }}>{item.time} — {item.categoria}</div>
                    <div style={{ fontSize: "1rem", fontWeight: "700", color: "#1e293b" }}>{item.titulo}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* TAREAS */}
        <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
          <h3 style={{ color: "#1B396A", fontSize: "1rem", fontWeight: "800", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}><CheckSquare size={18} color="#f59e0b" /> Tareas Activas</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {loading ? <Loader2 className="animate-spin" size={18} color="#94a3b8" style={{ alignSelf: "center", margin: "20px" }} /> : 
             dashboardData.tasks.length === 0 ? <p style={{ fontSize: "0.85rem", color: "#94a3b8", textAlign: "center" }}>Todo completado.</p> :
             dashboardData.tasks.map((task, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "8px 0" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "4px", backgroundColor: task.color || "#1B396A", marginTop: "4px", flexShrink: 0 }} />
                <span style={{ fontSize: "0.9rem", color: "#334155", fontWeight: "600", lineHeight: "1.4" }}>{task.titulo}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================= MODALES DE ACCIÓN RÁPIDA ================= */}
      
      {/* MODAL NUEVA TAREA */}
      {showTaskModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", width: "400px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Añadir Pendiente</h2>
              <button onClick={() => setShowTaskModal(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#64748b" }}>Descripción de la Tarea</label>
                <input required autoFocus type="text" value={newTask.titulo} onChange={e => setNewTask({...newTask, titulo: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginTop: "4px" }} placeholder="Ej. Revisar tesis de maestría..." />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#64748b" }}>Fecha Límite (Opcional)</label>
                <input type="date" value={newTask.fecha} onChange={e => setNewTask({...newTask, fecha: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginTop: "4px" }} />
              </div>
              <button disabled={isSubmitting} type="submit" style={{ marginTop: "10px", backgroundColor: "#1B396A", color: "white", padding: "12px", borderRadius: "10px", fontWeight: "700", border: "none", cursor: "pointer", display: "flex", justifyContent: "center", gap: "8px" }}>
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Guardar en Google Tasks
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO MEET */}
      {showMeetModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", width: "400px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Agendar Videollamada</h2>
              <button onClick={() => setShowMeetModal(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateMeet} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#64748b" }}>Título del Evento</label>
                <input required autoFocus type="text" value={newMeet.titulo} onChange={e => setNewMeet({...newMeet, titulo: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginTop: "4px" }} placeholder="Ej. Asesoría de Proyecto..." />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#64748b" }}>Fecha</label>
                  <input required type="date" value={newMeet.fecha} onChange={e => setNewMeet({...newMeet, fecha: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginTop: "4px" }} />
                </div>
                <div style={{ width: "120px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#64748b" }}>Hora</label>
                  <input required type="time" value={newMeet.hora} onChange={e => setNewMeet({...newMeet, hora: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginTop: "4px" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "#64748b" }}>Invitar Correo (Opcional)</label>
                <input type="email" value={newMeet.correo} onChange={e => setNewMeet({...newMeet, correo: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginTop: "4px" }} placeholder="alumno@tecnm.mx" />
              </div>
              <button disabled={isSubmitting} type="submit" style={{ marginTop: "10px", backgroundColor: "#1B396A", color: "white", padding: "12px", borderRadius: "10px", fontWeight: "700", border: "none", cursor: "pointer", display: "flex", justifyContent: "center", gap: "8px" }}>
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Video size={18} />} Agendar en Calendar
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}