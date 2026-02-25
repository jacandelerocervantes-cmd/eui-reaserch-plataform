"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Search, CalendarDays, Check, X, AlertTriangle, 
  FileSpreadsheet, Filter, Save, Edit3, Paperclip, 
  FileText, Ban, Loader2 
} from "lucide-react";

// --- TIPOS ---
type Student = { id: string; matricula: string; apellido_paterno: string; apellido_materno: string | null; nombres: string; };
type AttendanceRecord = { student_id: string; session_date: string; session_number: number; status: number; justification_text?: string; file_url?: string; };

const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", disabled = false, isActive = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", border: "transparent" };
      case "success": return { bg: isActive ? "#10b981" : "white", hoverBg: "#10b981", text: isActive ? "white" : "#10b981", border: isActive ? "#10b981" : "#cbd5e1" };
      case "warning": return { bg: isActive ? "#f59e0b" : "white", hoverBg: "#f59e0b", text: isActive ? "white" : "#f59e0b", border: isActive ? "#f59e0b" : "#cbd5e1" };
      case "danger":  return { bg: isActive ? "#ef4444" : "white", hoverBg: "#ef4444", text: isActive ? "white" : "#ef4444", border: isActive ? "#ef4444" : "#cbd5e1" };
      default: return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", border: "#cbd5e1" };
    }
  };
  const style = getStyles();
  const showExpanded = isHovered || isActive;

  return (
    <button
      onClick={onClick} disabled={disabled} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: showExpanded ? "10px" : "0px",
        backgroundColor: (isHovered || isActive) && !disabled ? style.hoverBg : style.bg, 
        color: (isHovered || isActive) && !disabled ? "white" : style.text, 
        border: `1px solid ${style.border}`, borderRadius: "10px", padding: "0 12px", height: "40px", 
        fontWeight: "600", transition: "all 0.3s", cursor: disabled ? "not-allowed" : "pointer", overflow: "hidden"
      }}
    >
      {Icon && <Icon size={18} />}
      <span style={{ maxWidth: showExpanded ? "200px" : "0px", opacity: showExpanded ? 1 : 0, transition: "all 0.3s" }}>
        {label}
      </span>
    </button>
  );
};

export default function HistorialAsistencia() {
  const { id: courseId } = useParams() as { id: string };
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [uniqueDates, setUniqueDates] = useState<{date: string, session: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  useEffect(() => { if (courseId) fetchData(); }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: stData } = await supabase.from("students").select("*").eq("course_id", courseId).order("apellido_paterno");
      const { data: attData } = await supabase.from("attendance").select("*").eq("course_id", courseId).order("session_date").order("session_number");
      
      if (stData) setStudents(stData);
      if (attData) {
        setAttendance(attData);
        const datesMap = new Map();
        attData.forEach(r => {
          const key = `${r.session_date}-S${r.session_number}`;
          if (!datesMap.has(key)) datesMap.set(key, { date: r.session_date, session: r.session_number });
        });
        setUniqueDates(Array.from(datesMap.values()));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getRecord = (sid: string, date: string, session: number) => attendance.find(a => a.student_id === sid && a.session_date === date && a.session_number === session);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      let url = selectedRecord.file_url;
      if (fileToUpload) {
        const path = `${courseId}/${selectedRecord.student_id}_${selectedRecord.date}.${fileToUpload.name.split('.').pop()}`;
        await supabase.storage.from("justificantes").upload(path, fileToUpload, { upsert: true });
        const { data } = supabase.storage.from("justificantes").getPublicUrl(path);
        url = data.publicUrl;
      }

      await supabase.from("attendance").update({ 
        status: selectedRecord.new_status, 
        justification_text: selectedRecord.justification, 
        file_url: url 
      }).match({ student_id: selectedRecord.student_id, session_date: selectedRecord.date, session_number: selectedRecord.session });

      setShowEditModal(false);
      fetchData();
    } catch (e) { alert("Error al guardar"); } finally { setIsUpdating(false); }
  };

  const syncWithSheets = async () => {
    setIsUpdating(true);
    try {
      const payloadAlumnos = filteredStudents.map(al => {
        let total = 0;
        const asistencias = uniqueDates.map(d => {
          const r = getRecord(al.id, d.date, d.session);
          if (r) total += r.status;
          return { fecha: d.date, sesion: d.session, estatus: r ? r.status : 0 };
        });
        const pct = uniqueDates.length > 0 ? (total / uniqueDates.length) * 100 : 0;
        return { matricula: al.matricula, nombre_completo: `${al.apellido_paterno} ${al.nombres}`, asistencias, resumen: { porcentaje: pct, derecho_examen: pct >= 80 } };
      });

      const { data } = await supabase.functions.invoke('sync-attendance-history', { body: { courseId, payload: { alumnos: payloadAlumnos } } });
      if (data?.success) alert("¡Excel sincronizado!");
    } catch (e) { alert("Error de sincronización"); } finally { setIsUpdating(false); }
  };

  const filteredStudents = students.filter(s => `${s.apellido_paterno} ${s.nombres}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.matricula.includes(searchTerm));

  return (
    <div style={{ padding: "40px", maxWidth: "100%", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "800", margin: "0" }}>Historial de Asistencia</h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Control detallado y justificantes</p>
        </div>
        <ExpandingButton icon={isUpdating ? Loader2 : FileSpreadsheet} label="Sincronizar todo el Historial" onClick={syncWithSheets} variant="success" disabled={isUpdating} />
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <input type="text" placeholder="Buscar alumno..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: "10px 15px", borderRadius: "10px", border: "1px solid #cbd5e1", width: "300px" }} />
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "auto", maxHeight: "70vh" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
            <tr style={{ backgroundColor: "#f8fafc" }}>
              <th style={{ padding: "12px 20px", textAlign: "left", borderBottom: "2px solid #e2e8f0", position: "sticky", left: 0, backgroundColor: "#f8fafc" }}>Alumno</th>
              {uniqueDates.map((d, i) => (
                <th key={i} style={{ padding: "12px 10px", textAlign: "center", borderBottom: "2px solid #e2e8f0", fontSize: "0.7rem" }}>
                  {d.date.split('-').reverse().slice(0,2).join('/')}<br/>S{d.session}
                </th>
              ))}
              <th style={{ padding: "12px 20px", borderBottom: "2px solid #e2e8f0" }}>%</th>
              <th style={{ padding: "12px 20px", borderBottom: "2px solid #e2e8f0" }}>Examen</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map(al => {
              let total = 0;
              uniqueDates.forEach(d => { const r = getRecord(al.id, d.date, d.session); if(r) total += r.status; });
              const pct = uniqueDates.length > 0 ? (total / uniqueDates.length) * 100 : 0;
              return (
                <tr key={al.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 20px", fontWeight: "600", fontSize: "0.85rem", position: "sticky", left: 0, backgroundColor: "white" }}>
                    {al.apellido_paterno} {al.nombres}<br/><span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{al.matricula}</span>
                  </td>
                  {uniqueDates.map((d, i) => {
                    const r = getRecord(al.id, d.date, d.session);
                    return (
                      <td key={i} style={{ textAlign: "center", padding: "5px" }}>
                        <button onClick={() => { if(r) { setSelectedRecord({...r, student_name: `${al.apellido_paterno} ${al.nombres}`, new_status: r.status, justification: r.justification_text || ""}); setShowEditModal(true); }}} style={{ background: "none", border: "none", cursor: r ? "pointer" : "default", opacity: r ? 1 : 0.2 }}>
                          {r?.status === 1 ? <Check size={16} color="#10b981"/> : r?.status === 0.5 ? <AlertTriangle size={16} color="#f59e0b"/> : <X size={16} color="#ef4444"/>}
                        </button>
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "center", fontWeight: "bold", color: pct < 80 ? "#ef4444" : "#10b981" }}>{Math.round(pct)}%</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ padding: "3px 8px", borderRadius: "10px", fontSize: "0.7rem", backgroundColor: pct >= 80 ? "#dcfce7" : "#fee2e2", color: pct >= 80 ? "#166534" : "#991b1b" }}>
                      {pct >= 80 ? "SÍ" : "NO"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showEditModal && selectedRecord && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100, backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "20px", width: "400px" }}>
            <h2 style={{ margin: "0 0 15px" }}>Ajustar Asistencia</h2>
            <p style={{ fontWeight: "bold" }}>{selectedRecord.student_name}</p>
            <div style={{ display: "flex", gap: "10px", margin: "20px 0", justifyContent: "center" }}>
              <ExpandingButton icon={Check} label="Asistió" isActive={selectedRecord.new_status === 1} onClick={() => setSelectedRecord({...selectedRecord, new_status: 1})} variant="success" />
              <ExpandingButton icon={AlertTriangle} label="Retardo" isActive={selectedRecord.new_status === 0.5} onClick={() => setSelectedRecord({...selectedRecord, new_status: 0.5})} variant="warning" />
              <ExpandingButton icon={X} label="Falta" isActive={selectedRecord.new_status === 0} onClick={() => setSelectedRecord({...selectedRecord, new_status: 0})} variant="danger" />
            </div>
            <textarea placeholder="Motivo/Justificación..." value={selectedRecord.justification} onChange={(e) => setSelectedRecord({...selectedRecord, justification: e.target.value})} style={{ width: "100%", height: "80px", padding: "10px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
            <input type="file" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} style={{ marginTop: "15px" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "25px" }}>
              <ExpandingButton label="Cancelar" onClick={() => setShowEditModal(false)} variant="default" />
              <ExpandingButton icon={Save} label="Guardar" onClick={handleUpdate} variant="primary" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}