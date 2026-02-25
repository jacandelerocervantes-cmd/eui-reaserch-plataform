"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Search, Edit2, Trash2, UsersRound, X, Save, 
  UserPlus, CalendarDays, Sparkles, FileText, 
  Loader2, Send
} from "lucide-react";

// --- TIPOS ---
type Team = { id: string; name: string };
type Student = { 
  id: string; 
  matricula: string; 
  apellido_paterno: string; 
  apellido_materno: string | null; 
  nombres: string; 
  correo: string; 
  team_id?: string | null;
  teams?: { name: string } | null;
};

// --- COMPONENTE DE BOTÓN PREMIUM ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", type = "button", disabled = false, small = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", border: "transparent" };
      case "secondary": return { bg: "white", hoverBg: "#f8fafc", text: "#1B396A", border: "#cbd5e1" };
      case "ai": return { bg: "#f0f7ff", hoverBg: "#e0efff", text: "#2563eb", border: "#bfdbfe" };
      case "danger": return { bg: "#fee2e2", hoverBg: "#ef4444", text: isHovered ? "white" : "#ef4444", border: "transparent" };
      default: return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", border: "#cbd5e1" };
    }
  };

  const style = getStyles();

  return (
    <button
      type={type} onClick={onClick} disabled={disabled} 
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", 
        gap: isHovered ? "8px" : "0px",
        backgroundColor: isHovered && !disabled ? style.hoverBg : style.bg, 
        color: style.text, 
        border: `1px solid ${style.border}`,
        borderRadius: "10px", padding: "0 12px", height: small ? "36px" : "44px",
        fontWeight: "600", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
        cursor: disabled ? "not-allowed" : "pointer", overflow: "hidden", whiteSpace: "nowrap"
      }}
    >
      {Icon && <Icon size={small ? 16 : 20} />}
      <span style={{ maxWidth: isHovered ? "150px" : "0px", opacity: isHovered ? 1 : 0, transition: "all 0.3s" }}>
        {label}
      </span>
    </button>
  );
};

export default function ListaAlumnos() {
  const { id: courseId } = useParams();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStudent, setNewStudent] = useState({ matricula: "", apellido_paterno: "", apellido_materno: "", nombres: "", correo: "", team_id: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'analyzing' | 'success'>('idle');

  useEffect(() => { if (courseId) fetchData(); }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: teamsData } = await supabase.from("teams").select("*").eq("course_id", courseId);
      const { data: studentsData } = await supabase.from("students").select("*, teams(name)").eq("course_id", courseId).order("apellido_paterno");
      if (teamsData) setTeams(teamsData);
      if (studentsData) setStudents(studentsData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('enroll-manual', {
        body: { courseId, mode: editingStudent ? 'edit' : 'create', studentId: editingStudent, studentData: newStudent }
      });
      if (error || !data.success) throw new Error(data?.error || "Error en el servidor");
      setShowModal(false);
      setEditingStudent(null);
      setNewStudent({ matricula: "", apellido_paterno: "", apellido_materno: "", nombres: "", correo: "", team_id: "" });
      fetchData();
    } catch (e: any) { alert(`Error: ${e.message}`); } finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar alumno? También se borrará de la Sábana en Drive.")) return;
    try {
      const { data } = await supabase.functions.invoke('enroll-manual', { body: { courseId, mode: 'delete', studentId: id } });
      if (data?.success) fetchData();
    } catch (e: any) { alert(e.message); }
  };

  const handleGeminiImport = async () => {
    if (!selectedFile) return;
    setImportStatus('analyzing');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        const base64File = (reader.result as string).split(',')[1];
        const { data, error } = await supabase.functions.invoke('import-ia-students', { body: { courseId, file: base64File } });
        if (error || !data.success) throw new Error(data?.error);
        setImportStatus('success');
        setTimeout(() => { setShowImportModal(false); setImportStatus('idle'); setSelectedFile(null); fetchData(); }, 2000);
      };
    } catch (e: any) { alert(`Error IA: ${e.message}`); setImportStatus('idle'); }
  };

  const filteredStudents = students.filter(s => `${s.nombres} ${s.apellido_paterno}`.toLowerCase().includes(searchTerm.toLowerCase()) || s.matricula.includes(searchTerm));

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0" }}>Gestión de Alumnos</h1>
          <p style={{ color: "#64748b", fontWeight: "500" }}>Total Inscritos: <span style={{ color: "#1B396A", fontWeight: "700" }}>{students.length}</span></p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={Sparkles} label="Importar con Gemini" onClick={() => setShowImportModal(true)} variant="ai" />
          <ExpandingButton icon={UserPlus} label="Agregar Alumno" onClick={() => { setEditingStudent(null); setShowModal(true); }} variant="primary" />
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "13px" }} />
          <input type="text" placeholder="Buscar por matrícula o nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "10px 40px", borderRadius: "10px", border: "1px solid #cbd5e1", height: "44px" }} />
        </div>
        <ExpandingButton icon={CalendarDays} label="Ver Historial" onClick={() => router.push(`/panel/materias/${courseId}/alumnos/historial`)} variant="secondary" />
      </div>

      <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", color: "#64748b", textAlign: "left", fontSize: "0.85rem" }}>
              <th style={{ padding: "16px 20px" }}>Matrícula</th>
              <th style={{ padding: "16px 20px" }}>Nombre Completo</th>
              <th style={{ padding: "16px 20px" }}>Equipo</th>
              <th style={{ padding: "16px 20px", textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: "40px", textAlign: "center" }}><Loader2 className="animate-spin" size={32} color="#1B396A" /></td></tr>
            ) : filteredStudents.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "16px 20px", fontFamily: "monospace", fontWeight: "700" }}>{s.matricula}</td>
                <td style={{ padding: "16px 20px", fontWeight: "600", color: "#1B396A" }}>{`${s.apellido_paterno} ${s.apellido_materno || ''} ${s.nombres}`}</td>
                <td style={{ padding: "16px 20px" }}><span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "0.75rem", backgroundColor: "#eff6ff", color: "#2563eb", fontWeight: "700" }}>{s.teams?.name || "Sin equipo"}</span></td>
                <td style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <ExpandingButton small icon={Edit2} label="Editar" onClick={() => { setEditingStudent(s.id); setNewStudent({ matricula: s.matricula, nombres: s.nombres, apellido_paterno: s.apellido_paterno, apellido_materno: s.apellido_materno || "", correo: s.correo || "", team_id: s.team_id || "" }); setShowModal(true); }} variant="secondary" />
                    <ExpandingButton small icon={Trash2} label="Eliminar" onClick={() => handleDelete(s.id)} variant="danger" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE IMPORTACIÓN CON IA */}
      {showImportModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000, backdropFilter: "blur(8px)" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", width: "450px", padding: "40px", textAlign: "center", position: "relative" }}>
            <button onClick={() => setShowImportModal(false)} style={{ position: "absolute", top: "20px", right: "20px", border: "none", background: "none", cursor: "pointer" }}><X size={24} color="#94a3b8" /></button>
            <div style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "6px 14px", borderRadius: "20px", display: "inline-flex", gap: "6px", fontWeight: "800", marginBottom: "20px", fontSize: "0.8rem" }}>
              <Sparkles size={16} /> MOTOR GEMINI 1.5 FLASH
            </div>
            <h2 style={{ color: "#1B396A", marginBottom: "8px" }}>Importación Inteligente</h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "24px" }}>Sube una lista en PDF o imagen para procesar alumnos masivamente.</p>
            <div style={{ border: "2px dashed #cbd5e1", padding: "30px", borderRadius: "16px", cursor: "pointer", backgroundColor: selectedFile ? "#f0f7ff" : "transparent" }}>
              <input type="file" accept=".pdf,.png,.jpg" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} style={{ display: "none" }} id="file-ia" />
              <label htmlFor="file-ia" style={{ cursor: "pointer" }}>
                {importStatus === 'analyzing' ? <Loader2 className="animate-spin" size={40} color="#2563eb" /> : <FileText size={40} color="#94a3b8" />}
                <p style={{ marginTop: "12px", fontWeight: "600", color: "#475569" }}>{selectedFile ? selectedFile.name : "Seleccionar archivo"}</p>
              </label>
            </div>
            <div style={{ marginTop: "30px", display: "flex", justifyContent: "center" }}>
              <ExpandingButton 
                icon={importStatus === 'analyzing' ? Loader2 : Sparkles} 
                label={importStatus === 'analyzing' ? "Procesando con IA..." : (importStatus === 'success' ? "¡Éxito!" : "Iniciar Análisis Inteligente")} 
                onClick={handleGeminiImport} variant="ai" disabled={!selectedFile || importStatus !== 'idle'} 
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REGISTRO MANUAL (REDUCIDO) */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1500, backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "white", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
              <h2 style={{ color: "#1B396A", margin: 0, fontWeight: "800" }}>{editingStudent ? "Editar Alumno" : "Nuevo Alumno"}</h2>
              <button onClick={() => setShowModal(false)} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={24} color="#94a3b8" /></button>
            </div>
            <form onSubmit={handleSaveStudent} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <input required placeholder="Matrícula institucional" value={newStudent.matricula} onChange={(e) => setNewStudent({...newStudent, matricula: e.target.value})} style={{ padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
              <input required placeholder="Nombre(s)" value={newStudent.nombres} onChange={(e) => setNewStudent({...newStudent, nombres: e.target.value})} style={{ padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
              <div style={{ display: "flex", gap: "10px" }}>
                <input required placeholder="Apellido Paterno" value={newStudent.apellido_paterno} onChange={(e) => setNewStudent({...newStudent, apellido_paterno: e.target.value})} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
                <input placeholder="Apellido Materno" value={newStudent.apellido_materno} onChange={(e) => setNewStudent({...newStudent, apellido_materno: e.target.value})} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
              </div>
              <input type="email" placeholder="Correo electrónico" value={newStudent.correo} onChange={(e) => setNewStudent({...newStudent, correo: e.target.value})} style={{ padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
              <select value={newStudent.team_id} onChange={(e) => setNewStudent({...newStudent, team_id: e.target.value})} style={{ padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", backgroundColor: "white" }}>
                <option value="">-- Sin equipo asignado --</option>
                {teams.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                <ExpandingButton icon={isSubmitting ? Loader2 : Save} label={isSubmitting ? "Sincronizando..." : "Guardar y Sincronizar"} type="submit" variant="primary" disabled={isSubmitting} />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}