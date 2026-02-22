"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Search, CalendarDays, Check, X, AlertTriangle, FileSpreadsheet, Filter, Save, Edit3, Paperclip, FileText, Ban } from "lucide-react";

type Student = { id: string; matricula: string; apellido_paterno: string; apellido_materno: string | null; nombres: string; };
type AttendanceRecord = { student_id: string; session_date: string; session_number: number; status: number; justification_text?: string; file_url?: string; };

const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", type = "button", disabled = false, isActive = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", hoverText: "white", border: "transparent" };
      case "success": return { bg: isActive ? "#10b981" : "white", hoverBg: "#10b981", text: isActive ? "white" : "#10b981", hoverText: "white", border: isActive ? "#10b981" : "#cbd5e1" };
      case "warning": return { bg: isActive ? "#f59e0b" : "white", hoverBg: "#f59e0b", text: isActive ? "white" : "#f59e0b", hoverText: "white", border: isActive ? "#f59e0b" : "#cbd5e1" };
      case "danger":  return { bg: isActive ? "#ef4444" : "white", hoverBg: "#ef4444", text: isActive ? "white" : "#ef4444", hoverText: "white", border: isActive ? "#ef4444" : "#cbd5e1" };
      case "cancel":  return { bg: "white", hoverBg: "#fee2e2", text: "#64748b", hoverText: "#ef4444", border: isHovered ? "#ef4444" : "#cbd5e1" };
      default:        return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", hoverText: "#1B396A", border: "#cbd5e1" };
    }
  };

  const style = getStyles();
  const showExpanded = isHovered || isActive;

  return (
    <button
      type={type} onClick={onClick} disabled={disabled} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} title={label}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: showExpanded && !disabled ? "10px" : "0px",
        backgroundColor: (isHovered || isActive) && !disabled ? style.hoverBg : style.bg, color: (isHovered || isActive) && !disabled ? style.hoverText : style.text, 
        border: `1px solid ${style.border}`, borderRadius: "10px", padding: "0 12px", height: "40px", fontWeight: "600", fontSize: "0.9rem", cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", whiteSpace: "nowrap",
        boxShadow: (isHovered || isActive) && !disabled && variant !== 'cancel' && variant !== 'default' ? "0 4px 6px rgba(0,0,0,0.15)" : "none"
      }}
    >
      {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
      <span style={{ maxWidth: showExpanded && !disabled ? "200px" : "0px", opacity: showExpanded && !disabled ? 1 : 0, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", display: "inline-block" }}>
        {label}
      </span>
    </button>
  );
};

export default function HistorialAsistencia() {
  const params = useParams();
  const courseId = params?.id as string;

  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [uniqueDates, setUniqueDates] = useState<{date: string, session: number}[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState({
    student_id: "", student_name: "", date: "", session: 1, current_status: 0, new_status: 0, justification: "", file_url: ""
  });
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  useEffect(() => { if (courseId) fetchData(); }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: studentsData } = await supabase.from("students").select("id, matricula, apellido_paterno, apellido_materno, nombres").eq("course_id", courseId).order("apellido_paterno", { ascending: true });
      if (studentsData) setStudents(studentsData);

      const { data: attendanceData } = await supabase.from("attendance").select("*").eq("course_id", courseId).order("session_date", { ascending: true }).order("session_number", { ascending: true });
      
      if (attendanceData) {
        setAttendance(attendanceData);
        const datesMap = new Map();
        attendanceData.forEach(record => {
          const key = `${record.session_date}-S${record.session_number}`;
          if (!datesMap.has(key)) datesMap.set(key, { date: record.session_date, session: record.session_number });
        });
        setUniqueDates(Array.from(datesMap.values()));
      }
    } catch (error) { console.error("Error cargando historial:", error); } finally { setLoading(false); }
  };

  const getFullRecord = (studentId: string, date: string, session: number) => {
    return attendance.find(a => a.student_id === studentId && a.session_date === date && a.session_number === session) || null;
  };

  const renderStatusIcon = (status: number | null) => {
    if (status === 1) return <Check size={14} color="#10b981" />;
    if (status === 0.5) return <AlertTriangle size={12} color="#f59e0b" />;
    if (status === 0) return <X size={14} color="#ef4444" />;
    return <span style={{ color: "#cbd5e1", fontSize: "0.8rem" }}>-</span>; 
  };

  const handleOpenEdit = (student: Student, date: string, session: number) => {
    const record = getFullRecord(student.id, date, session);
    if (!record) return; 
    setSelectedRecord({
      student_id: student.id, student_name: `${student.apellido_paterno} ${student.nombres}`,
      date: date, session: session, current_status: record.status, new_status: record.status,
      justification: record.justification_text || "", file_url: record.file_url || ""
    });
    setFileToUpload(null);
    setShowEditModal(true);
  };

  const handleUpdateAttendance = async () => {
    setIsUpdating(true);
    try {
      let finalFileUrl = selectedRecord.file_url;
      if (fileToUpload) {
        const fileExt = fileToUpload.name.split('.').pop();
        const fileName = `${courseId}_${selectedRecord.student_id}_${selectedRecord.date}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("justificantes").upload(fileName, fileToUpload, { upsert: true });
        if (!uploadError) {
          const { data } = supabase.storage.from("justificantes").getPublicUrl(fileName);
          finalFileUrl = data.publicUrl;
        }
      }
      const { error } = await supabase.from("attendance").update({ 
          status: selectedRecord.new_status, justification_text: selectedRecord.justification.trim() || null, file_url: finalFileUrl || null
        }).eq("course_id", courseId).eq("student_id", selectedRecord.student_id).eq("session_date", selectedRecord.date).eq("session_number", selectedRecord.session);
      if (error) throw error;
      setShowEditModal(false);
      fetchData(); 
    } catch (error) { alert("Error al actualizar la asistencia."); } finally { setIsUpdating(false); }
  };

  const handleExportToAppsScript = async () => {
    const payload = {
      materia_id: courseId,
      fecha_exportacion: new Date().toISOString(),
      alumnos: filteredStudents.map(alumno => {
        let registroAlumno = {
          matricula: alumno.matricula,
          nombre_completo: `${alumno.apellido_paterno} ${alumno.apellido_materno || ""} ${alumno.nombres}`,
          asistencias: [] as any[],
          resumen: { total_asistencias: 0, total_sesiones: uniqueDates.length, porcentaje: 0, derecho_examen: false }
        };

        let totalA = 0;
        uniqueDates.forEach(d => {
          const record = getFullRecord(alumno.id, d.date, d.session);
          if (record) totalA += record.status;
          registroAlumno.asistencias.push({
            fecha: d.date,
            sesion: d.session,
            estatus: record ? record.status : 0 
          });
        });

        registroAlumno.resumen.total_asistencias = totalA;
        registroAlumno.resumen.porcentaje = uniqueDates.length > 0 ? (totalA / uniqueDates.length) * 100 : 0;
        registroAlumno.resumen.derecho_examen = registroAlumno.resumen.porcentaje >= 80;

        return registroAlumno;
      })
    };

    console.log("Datos listos para enviar a Google Apps Script:", payload);
    alert("Simulación: Datos estructurados. Próximamente se enviarán al Webhook de Google Apps Script para generar las pestañas en Google Sheets.");
  };

  const filteredStudents = students.filter(student => {
    const nombreCompleto = `${student.apellido_paterno} ${student.apellido_materno || ""} ${student.nombres}`.toLowerCase();
    return nombreCompleto.includes(searchTerm.toLowerCase()) || student.matricula.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: "100%", margin: "0", display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
      
      {/* CABECERA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "800", margin: "0 0 4px 0" }}>Control de Asistencia</h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.9rem", fontWeight: "500", display: "flex", alignItems: "center", gap: "6px" }}>
            <CalendarDays size={16} /> Historial y resumen general
          </p>
        </div>
        
        {/* BOTÓN PURIFICADO PARA GOOGLE SHEETS */}
        <ExpandingButton 
          icon={FileSpreadsheet} 
          label="Sincronizar con Sheets" 
          onClick={handleExportToAppsScript} 
          variant="success" 
        />
      </div>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "250px", maxWidth: "350px" }}>
          <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
          <input type="text" placeholder="Buscar alumno..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "8px 10px 8px 36px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "0.9rem", outline: "none", boxSizing: "border-box", height: "40px" }} />
        </div>
        <ExpandingButton icon={Filter} label="Filtrar Unidad" variant="secondary" />
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "auto", maxHeight: "65vh", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, textAlign: "left", minWidth: "max-content" }}>
          <thead>
            <tr>
              <th style={{ padding: "10px 16px", color: "#1B396A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "700", position: "sticky", left: 0, top: 0, backgroundColor: "#f8fafc", zIndex: 20, borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>
                Alumno
              </th>
              
              {uniqueDates.length === 0 ? (
                <th style={{ padding: "10px", color: "#94a3b8", fontWeight: "500", textAlign: "center", position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 10, borderBottom: "1px solid #cbd5e1" }}>No hay sesiones</th>
              ) : (
                uniqueDates.map((d, index) => {
                  const [year, month, day] = d.date.split('-');
                  const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
                  const dia = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '');
                  return (
                    <th key={index} style={{ padding: "6px 4px", color: "#64748b", textAlign: "center", position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 10, borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #cbd5e1", minWidth: "45px" }}>
                      <div style={{ fontWeight: "700", color: "#1B396A", fontSize: "0.7rem", lineHeight: "1" }}>{dia}</div>
                      <div style={{ fontSize: "0.65rem", textTransform: "uppercase", marginTop: "2px" }}>S{d.session}</div>
                    </th>
                  );
                })
              )}
              
              <th style={{ padding: "10px", color: "#1B396A", fontSize: "0.75rem", textAlign: "center", position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 10, borderLeft: "2px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>% Asist.</th>
              <th style={{ padding: "10px 16px", color: "#1B396A", fontSize: "0.75rem", textAlign: "center", position: "sticky", top: 0, backgroundColor: "#f8fafc", zIndex: 10, borderBottom: "1px solid #cbd5e1" }}>Examen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={uniqueDates.length + 3} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Calculando historial...</td></tr>
            ) : filteredStudents.length === 0 ? (
              <tr><td colSpan={uniqueDates.length + 3} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>No hay alumnos.</td></tr>
            ) : (
              filteredStudents.map((alumno) => {
                let totalAsistencias = 0;
                let totalSesiones = uniqueDates.length;
                
                uniqueDates.forEach(d => {
                  const record = getFullRecord(alumno.id, d.date, d.session);
                  if (record) totalAsistencias += record.status;
                });

                const porcentaje = totalSesiones > 0 ? (totalAsistencias / totalSesiones) * 100 : 0;
                const derechoExamen = porcentaje >= 80; 

                return (
                  <tr key={alumno.id} style={{ transition: "background 0.2s" }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"} onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                    
                    <td style={{ padding: "8px 16px", position: "sticky", left: 0, backgroundColor: "white", zIndex: 5, borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ color: "#1B396A", fontWeight: "600", fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "220px" }} title={`${alumno.apellido_paterno} ${alumno.apellido_materno || ""} ${alumno.nombres}`}>
                        {`${alumno.apellido_paterno} ${alumno.apellido_materno || ""} ${alumno.nombres}`}
                      </div>
                      <div style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: "0.7rem", marginTop: "2px" }}>{alumno.matricula}</div>
                    </td>
                    
                    {uniqueDates.map((d, index) => {
                      const record = getFullRecord(alumno.id, d.date, d.session);
                      return (
                        <td key={index} style={{ padding: "4px", textAlign: "center", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
                          <button 
                            onClick={() => record && handleOpenEdit(alumno, d.date, d.session)}
                            disabled={!record}
                            style={{ background: "none", border: "none", cursor: record ? "pointer" : "default", padding: "4px", borderRadius: "4px", transition: "background 0.2s", borderBottom: record?.justification_text || record?.file_url ? "2px solid #10b981" : "2px solid transparent", display: "flex", margin: "0 auto" }} 
                            onMouseOver={(e) => record && (e.currentTarget.style.backgroundColor = "#e2e8f0")} 
                            onMouseOut={(e) => record && (e.currentTarget.style.backgroundColor = "transparent")} 
                          >
                            {renderStatusIcon(record?.status ?? null)}
                          </button>
                        </td>
                      );
                    })}

                    <td style={{ padding: "8px", textAlign: "center", borderLeft: "2px solid #cbd5e1", backgroundColor: "white", fontWeight: "700", borderBottom: "1px solid #f1f5f9" }}>
                      {totalSesiones > 0 ? (
                        <span style={{ color: derechoExamen ? "#10b981" : "#ef4444", fontSize: "0.8rem" }}>{Math.round(porcentaje)}%</span>
                      ) : <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>-</span>}
                    </td>
                    <td style={{ padding: "8px 16px", textAlign: "center", backgroundColor: "white", borderBottom: "1px solid #f1f5f9" }}>
                      {totalSesiones > 0 ? (
                        <span style={{ padding: "4px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "700", backgroundColor: derechoExamen ? "#ecfdf5" : "#fef2f2", color: derechoExamen ? "#10b981" : "#ef4444" }}>
                          {derechoExamen ? "SÍ" : "NO"}
                        </span>
                      ) : <span style={{ color: "#94a3b8" }}>-</span>}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showEditModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "white", borderRadius: "20px", width: "100%", maxWidth: "460px", padding: "32px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", maxHeight: "90vh", overflowY: "auto" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <h2 style={{ color: "#1B396A", margin: "0 0 6px 0", fontSize: "1.4rem", display: "flex", alignItems: "center", gap: "10px" }}><Edit3 size={22} /> Detalle de Asistencia</h2>
                <p style={{ color: "#1e293b", margin: 0, fontSize: "1rem", fontWeight: "700" }}>{selectedRecord.student_name}</p>
                <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "0.85rem", textTransform: "capitalize", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CalendarDays size={14} /> {new Date(selectedRecord.date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - Sesión {selectedRecord.session}
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: "#f1f5f9", border: "none", color: "#64748b", cursor: "pointer", borderRadius: "50%", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#e2e8f0"; e.currentTarget.style.color = "#1e293b"; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", color: "#64748b", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Seleccionar Estado</label>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <ExpandingButton icon={X} label="Falta" variant="danger" isActive={selectedRecord.new_status === 0} onClick={() => setSelectedRecord({...selectedRecord, new_status: 0})} />
                <ExpandingButton icon={AlertTriangle} label="Retardo" variant="warning" isActive={selectedRecord.new_status === 0.5} onClick={() => setSelectedRecord({...selectedRecord, new_status: 0.5})} />
                <ExpandingButton icon={Check} label="Asistencia" variant="success" isActive={selectedRecord.new_status === 1} onClick={() => setSelectedRecord({...selectedRecord, new_status: 1})} />
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "24px", marginBottom: "24px" }}>
              <label style={{ display: "block", color: "#64748b", fontSize: "0.85rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Notas y Evidencia</label>
              <div style={{ position: "relative", marginBottom: "16px" }}>
                <FileText size={18} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "12px" }} />
                <textarea placeholder="Escribe el motivo..." value={selectedRecord.justification} onChange={(e) => setSelectedRecord({...selectedRecord, justification: e.target.value})} style={{ width: "100%", padding: "12px 12px 12px 40px", borderRadius: "12px", border: "1px solid #cbd5e1", outline: "none", resize: "none", height: "80px", fontSize: "0.95rem", color: "#1e293b", boxSizing: "border-box", transition: "border-color 0.2s", backgroundColor: "#f8fafc" }} onFocus={(e) => { e.target.style.borderColor = "#1B396A"; e.target.style.backgroundColor = "white"; }} onBlur={(e) => { e.target.style.borderColor = "#cbd5e1"; e.target.style.backgroundColor = "#f8fafc"; }} />
              </div>
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", border: "2px dashed #cbd5e1", borderRadius: "12px", backgroundColor: fileToUpload ? "#ecfdf5" : "white", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.borderColor = "#1B396A"} onMouseOut={(e) => e.currentTarget.style.borderColor = fileToUpload ? "#10b981" : "#cbd5e1"}>
                {fileToUpload ? (
                  <><Check size={28} color="#10b981" style={{ marginBottom: "8px" }} /><span style={{ color: "#10b981", fontWeight: "600", fontSize: "0.9rem" }}>Archivo listo</span><span style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "4px" }}>{fileToUpload.name}</span></>
                ) : (
                  <><Paperclip size={28} color="#94a3b8" style={{ marginBottom: "8px" }} /><span style={{ color: "#1B396A", fontWeight: "600", fontSize: "0.95rem" }}>Adjuntar justificante</span><span style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "4px" }}>PDF o Imagen (Opcional)</span></>
                )}
                <input type="file" accept=".pdf, image/*" onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)} style={{ display: "none" }} />
              </label>
              {selectedRecord.file_url && !fileToUpload && (
                <div style={{ marginTop: "12px", textAlign: "center" }}>
                  <a href={selectedRecord.file_url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", fontSize: "0.85rem", fontWeight: "600", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }} onMouseOver={(e) => e.currentTarget.style.textDecoration = "underline"} onMouseOut={(e) => e.currentTarget.style.textDecoration = "none"}><Paperclip size={14} /> Ver archivo guardado</a>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", paddingTop: "8px" }}>
              <ExpandingButton icon={Ban} label="Cancelar" onClick={() => setShowEditModal(false)} variant="cancel" />
              <ExpandingButton icon={Save} label={isUpdating ? "Guardando..." : "Guardar Cambios"} onClick={handleUpdateAttendance} disabled={isUpdating} variant="primary" />
            </div>

          </div>
        </div>
      )}

    </div>
  );
}