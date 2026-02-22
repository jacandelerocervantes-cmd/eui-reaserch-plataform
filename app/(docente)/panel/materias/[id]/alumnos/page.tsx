"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Search, Filter, Edit2, Trash2, UsersRound, X, Save, 
  UserPlus, PlusCircle, CalendarDays, Sparkles, FileText, 
  Loader2, CheckCircle2, Ban
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

// --- COMPONENTE ÚNICO DE BOTÓN: ExpandingButton ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", type = "button", disabled = false, small = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", border: "transparent" };
      case "secondary": return { bg: "white", hoverBg: "#f8fafc", text: "#1B396A", border: "#cbd5e1" };
      case "success": return { bg: "#10b981", hoverBg: "#059669", text: "white", border: "transparent" };
      case "ai": return { bg: "#f0f7ff", hoverBg: "#e0efff", text: "#2563eb", border: "#bfdbfe" };
      case "danger": return { bg: "#fee2e2", hoverBg: "#ef4444", text: isHovered ? "white" : "#ef4444", border: "transparent" };
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
        gap: isHovered ? "8px" : "0px",
        backgroundColor: isHovered && !disabled ? style.hoverBg : style.bg, 
        color: style.text, 
        border: `1px solid ${style.border}`,
        borderRadius: "10px", 
        padding: "0 12px", 
        height: small ? "36px" : "44px", // Ajuste para la tabla
        fontWeight: "600", 
        fontSize: small ? "0.85rem" : "1rem",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
        overflow: "hidden", 
        whiteSpace: "nowrap",
        boxShadow: (variant === 'primary' || variant === 'ai') && !disabled && !small ? "0 4px 6px rgba(0,0,0,0.1)" : "none"
      }}
    >
      {Icon && <Icon size={small ? 16 : 20} style={{ flexShrink: 0 }} />}
      <span style={{ 
        maxWidth: isHovered ? "150px" : "0px", 
        opacity: isHovered ? 1 : 0, 
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
        display: "inline-block" 
      }}>
        {label}
      </span>
    </button>
  );
};

export default function ListaAlumnos() {
  const params = useParams();
  const courseId = params?.id as string;
  const router = useRouter();

  // Estados
  const [students, setStudents] = useState<Student[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modales y Edición
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStudent, setNewStudent] = useState({ matricula: "", apellido_paterno: "", apellido_materno: "", nombres: "", correo: "", team_id: "" });
  const [newTeamName, setNewTeamName] = useState("");

  // Gemini IA
  const [importStatus, setImportStatus] = useState<'idle' | 'analyzing' | 'success'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => { if (courseId) fetchData(); }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: teamsData } = await supabase.from("teams").select("*").eq("course_id", courseId);
      if (teamsData) setTeams(teamsData);
      const { data: studentsData } = await supabase.from("students").select("*, teams(name)").eq("course_id", courseId).order("apellido_paterno");
      if (studentsData) setStudents(studentsData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const studentData = {
        course_id: courseId, ...newStudent,
        apellido_paterno: newStudent.apellido_paterno.trim(),
        nombres: newStudent.nombres.trim(),
        team_id: newStudent.team_id || null
      };

      if (editingStudent) {
        await supabase.from("students").update(studentData).eq("id", editingStudent);
      } else {
        await supabase.from("students").insert([studentData]);
      }
      
      setShowModal(false);
      setEditingStudent(null);
      setNewStudent({ matricula: "", apellido_paterno: "", apellido_materno: "", nombres: "", correo: "", team_id: "" });
      fetchData();
    } catch (e) { alert("Error al guardar"); } finally { setIsSubmitting(false); }
  };

  const handleEdit = (alumno: Student) => {
    setEditingStudent(alumno.id);
    setNewStudent({
      matricula: alumno.matricula,
      apellido_paterno: alumno.apellido_paterno,
      apellido_materno: alumno.apellido_materno || "",
      nombres: alumno.nombres,
      correo: alumno.correo || "",
      team_id: alumno.team_id || ""
    });
    setShowModal(true);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("¿Seguro que quieres eliminar a este alumno?")) return;
    try {
      await supabase.from("students").delete().eq("id", id);
      fetchData();
    } catch (e) { alert("Error al eliminar"); }
  };

  const handleGeminiImport = () => {
    if (!selectedFile) return;
    setImportStatus('analyzing');
    setTimeout(() => { setImportStatus('success'); setTimeout(() => { setShowImportModal(false); setImportStatus('idle'); fetchData(); }, 2000); }, 3000);
  };

  const filteredStudents = students.filter(s => 
    `${s.nombres} ${s.apellido_paterno}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.matricula.includes(searchTerm)
  );

  return (
    <div style={{ padding: "40px", width: "100%", maxWidth: "1200px", margin: "0 auto" }}>
      
      {/* CABECERA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0" }}>Lista de Alumnos</h1>
          <p style={{ color: "#64748b", fontWeight: "500" }}>Inscritos: <span style={{ color: "#1B396A" }}>{students.length}</span></p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={Sparkles} label="Importar con Gemini" onClick={() => setShowImportModal(true)} variant="ai" />
          <ExpandingButton icon={UserPlus} label="Agregar Alumno" onClick={() => { setEditingStudent(null); setShowModal(true); }} variant="primary" />
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "1.5rem" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "13px" }} />
          <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "10px 40px", borderRadius: "10px", border: "1px solid #cbd5e1", height: "44px", outline: "none" }} />
        </div>
        <ExpandingButton icon={UsersRound} label="Equipos" onClick={() => setShowTeamsModal(true)} variant="secondary" />
        <ExpandingButton icon={CalendarDays} label="Historial" onClick={() => router.push(`/panel/materias/${courseId}/alumnos/historial`)} variant="primary" />
      </div>

      {/* TABLA */}
      <div style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", color: "#64748b", textAlign: "left", fontSize: "0.85rem" }}>
              <th style={{ padding: "16px 20px" }}>Matrícula</th>
              <th style={{ padding: "16px 20px" }}>Nombre</th>
              <th style={{ padding: "16px 20px" }}>Equipo</th>
              <th style={{ padding: "16px 20px", textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: "40px", textAlign: "center" }}>Cargando...</td></tr>
            ) : filteredStudents.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "16px 20px", fontFamily: "monospace" }}>{s.matricula}</td>
                <td style={{ padding: "16px 20px", fontWeight: "600", color: "#1B396A" }}>{`${s.apellido_paterno} ${s.nombres}`}</td>
                <td style={{ padding: "16px 20px" }}><span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", backgroundColor: "#eff6ff", color: "#2563eb", fontWeight: "600" }}>{s.teams?.name || "Sin equipo"}</span></td>
                <td style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <ExpandingButton small icon={Edit2} label="Editar" onClick={() => handleEdit(s)} variant="secondary" />
                    <ExpandingButton small icon={Trash2} label="Eliminar" onClick={() => handleDeleteStudent(s.id)} variant="danger" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL REGISTRAR/EDITAR */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1500, backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "white", borderRadius: "16px", width: "100%", maxWidth: "500px", padding: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ color: "#1B396A", margin: 0 }}>{editingStudent ? "Editar Alumno" : "Nuevo Alumno"}</h2>
              <button onClick={() => setShowModal(false)} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={24} color="#94a3b8" /></button>
            </div>
            <form onSubmit={handleSaveStudent} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input required placeholder="Matrícula" value={newStudent.matricula} onChange={(e) => setNewStudent({...newStudent, matricula: e.target.value})} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              <input required placeholder="Nombre(s)" value={newStudent.nombres} onChange={(e) => setNewStudent({...newStudent, nombres: e.target.value})} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              <div style={{ display: "flex", gap: "10px" }}>
                <input required placeholder="Ap. Paterno" value={newStudent.apellido_paterno} onChange={(e) => setNewStudent({...newStudent, apellido_paterno: e.target.value})} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
                <input placeholder="Ap. Materno" value={newStudent.apellido_materno} onChange={(e) => setNewStudent({...newStudent, apellido_materno: e.target.value})} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              </div>
              <input type="email" placeholder="Correo" value={newStudent.correo} onChange={(e) => setNewStudent({...newStudent, correo: e.target.value})} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
              <select value={newStudent.team_id} onChange={(e) => setNewStudent({...newStudent, team_id: e.target.value})} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "white" }}>
                <option value="">-- Sin equipo --</option>
                {teams.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                <ExpandingButton icon={Save} label="Guardar" type="submit" variant="primary" />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORTAR */}
      {showImportModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000, backdropFilter: "blur(8px)" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", width: "450px", padding: "40px", textAlign: "center", position: "relative" }}>
            <button onClick={() => setShowImportModal(false)} style={{ position: "absolute", top: "20px", right: "20px", border: "none", background: "none", cursor: "pointer" }}><X size={24} color="#94a3b8" /></button>
            <div style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "6px 14px", borderRadius: "20px", display: "inline-flex", gap: "6px", fontWeight: "700", marginBottom: "20px" }}>
              <Sparkles size={16} /> Gemini AI
            </div>
            <h2>Importación Inteligente</h2>
            <div style={{ border: "2px dashed #cbd5e1", padding: "30px", borderRadius: "16px", cursor: "pointer", backgroundColor: selectedFile ? "#f0f7ff" : "transparent" }}>
              <input type="file" accept=".pdf,.docx,.jpg,.png" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} style={{ display: "none" }} id="f" />
              <label htmlFor="f" style={{ cursor: "pointer" }}>
                {importStatus === 'analyzing' ? <Loader2 className="animate-spin" size={30} /> : <FileText size={30} color="#94a3b8" />}
                <p>{selectedFile ? selectedFile.name : "Selecciona archivo"}</p>
              </label>
            </div>
            <div style={{ marginTop: "30px", display: "flex", justifyContent: "center" }}>
              <ExpandingButton 
                icon={importStatus === 'analyzing' ? Loader2 : Sparkles} 
                label={importStatus === 'analyzing' ? "Procesando..." : "Analizar con IA"} 
                onClick={handleGeminiImport} 
                variant="ai" 
                disabled={!selectedFile || importStatus === 'analyzing'} 
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}