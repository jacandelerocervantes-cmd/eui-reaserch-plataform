"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Search, Edit2, Trash2, X, Save, 
  UserPlus, CalendarDays, Sparkles, FileText, 
  Loader2
} from "lucide-react";
import styles from "./alumnos.module.css";

// --- TIPOS ---
type Student = { 
  id: string; 
  matricula: string; 
  apellido_paterno: string; 
  apellido_materno: string | null; 
  nombres: string; 
  correo: string; 
  course_id?: string;
};

// --- COMPONENTE DE BOTÓN ---
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStudent, setNewStudent] = useState({ matricula: "", apellido_paterno: "", apellido_materno: "", nombres: "", correo: "" });
  
  // Estados para IA
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'analyzing' | 'success'>('idle');
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => { 
    if (courseId) fetchData(); 
  }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: studentsData, error } = await supabase
        .from("students")
        .select("*")
        .eq("course_id", courseId)
        .order("apellido_paterno");
      
      if (error) throw error;
      if (studentsData) setStudents(studentsData);

    } catch (e) { 
      console.error("Error cargando alumnos:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('enroll-manual', {
        method: 'POST',
        body: { 
          courseId, 
          mode: editingStudent ? 'edit' : 'create', 
          studentId: editingStudent, 
          studentData: newStudent 
        }
      });
      
      if (error) throw new Error("Error de conexión con el servidor.");
      if (!data?.success) throw new Error(data?.error || "Error al procesar el alumno.");
      
      setShowModal(false);
      setEditingStudent(null);
      setNewStudent({ matricula: "", apellido_paterno: "", apellido_materno: "", nombres: "", correo: "" });
      fetchData(); 
    } catch (e: any) { 
      // Aquí también aplicamos UX genérico
      alert("Hubo un problema al guardar el alumno. Inténtalo de nuevo.");
      console.error(e.message);
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar alumno de forma permanente?")) return;
    try {
      const { data, error } = await supabase.functions.invoke('enroll-manual', { 
        method: 'POST',
        body: { courseId, mode: 'delete', studentId: id } 
      });
      
      if (error || !data?.success) throw new Error(data?.error || "Error al eliminar.");
      fetchData();
    } catch (e: any) { 
      alert("Hubo un error al eliminar. Inténtalo de nuevo.");
      console.error(e.message);
    }
  };

  const handleGeminiImport = async () => {
    if (!selectedFile) return;
    setImportStatus('analyzing');
    setImportError(null);
    
    try {
      const formData = new FormData();
      formData.append("archivo", selectedFile);
      if (courseId) formData.append("courseId", courseId as string);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay una sesión activa. Por favor, inicia sesión de nuevo.");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_URL.");
      
      const functionUrl = `${supabaseUrl}/functions/v1/import-ia-students`;
      
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData
      });

      const responseData = await res.json();

      if (!res.ok || !responseData.success) {
        throw new Error(responseData.error || "Fallo desconocido en el servidor de IA.");
      }
      
      setImportStatus('success');
      setTimeout(() => { 
        setShowImportModal(false); 
        setImportStatus('idle'); 
        setSelectedFile(null); 
        fetchData(); 
      }, 2000);
      
    } catch (e: any) { 
      // PARA TI: Verás exactamente qué falló (base64, Google API, DB)
      console.error("🚨 Error técnico de importación:", e.message);
      
      // PARA EL DOCENTE: UX Amigable
      let mensajeUI = "No pudimos procesar el archivo. Verifica que sea una lista válida e inténtalo de nuevo.";
      if (e.message.includes("rechazado por la IA")) {
        mensajeUI = "El documento no parece ser una lista de alumnos válida.";
      }
      
      setImportError(mensajeUI);
      setImportStatus('idle'); 
    }
  };

  const filteredStudents = students.filter(s => 
    `${s.nombres} ${s.apellido_paterno}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.matricula.includes(searchTerm)
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Gestión de Alumnos</h1>
          <p className={styles.pageSubtitle}>
            Total Inscritos: <span className={styles.highlightCount}>{students.length}</span>
          </p>
        </div>
        <div className={styles.headerActions}>
          <ExpandingButton icon={Sparkles} label="Importar con Gemini" onClick={() => setShowImportModal(true)} variant="ai" />
          <ExpandingButton icon={UserPlus} label="Agregar Alumno" onClick={() => { setEditingStudent(null); setShowModal(true); }} variant="primary" />
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} size={18} />
          <input 
            type="text" 
            placeholder="Buscar por matrícula o nombre..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className={styles.searchInput} 
          />
        </div>
        <ExpandingButton icon={CalendarDays} label="Ver Historial" onClick={() => router.push(`/panel/materias/${courseId}/alumnos/historial`)} variant="secondary" />
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHeader}>
              <th>Matrícula</th>
              <th>Nombre Completo</th>
              <th>Correo Institucional</th>
              <th style={{ textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: "60px", textAlign: "center" }}><Loader2 className="animate-spin" size={32} color="#1B396A" style={{ margin: "0 auto" }}/></td></tr>
            ) : filteredStudents.length === 0 ? (
              <tr><td colSpan={4} className={styles.emptyState}>No hay alumnos registrados que coincidan con la búsqueda.</td></tr>
            ) : filteredStudents.map((s) => (
              <tr key={s.id} className={styles.tableRow}>
                <td className={styles.tableCell}>
                  <span className={styles.matriculaText}>{s.matricula}</span>
                </td>
                <td className={styles.tableCell}>
                  <span className={styles.nameText}>{`${s.apellido_paterno} ${s.apellido_materno || ''} ${s.nombres}`}</span>
                </td>
                <td className={styles.tableCell}>
                  <span style={{ color: "#64748b", fontSize: "0.9rem" }}>{s.correo || "No registrado"}</span>
                </td>
                <td className={styles.tableCell}>
                  <div className={styles.actionsContainer}>
                    <ExpandingButton small icon={Edit2} label="Editar" variant="secondary" onClick={() => { 
                      setEditingStudent(s.id); 
                      setNewStudent({ matricula: s.matricula, nombres: s.nombres, apellido_paterno: s.apellido_paterno, apellido_materno: s.apellido_materno || "", correo: s.correo || "" }); 
                      setShowModal(true); 
                    }} />
                    <ExpandingButton small icon={Trash2} label="Eliminar" variant="danger" onClick={() => handleDelete(s.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingStudent ? "Editar Alumno" : "Nuevo Alumno"}</h2>
              <button onClick={() => setShowModal(false)} className={styles.closeButton}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSaveStudent} className={styles.formGrid}>
              <input required placeholder="Matrícula institucional" className={styles.inputField} value={newStudent.matricula} onChange={(e) => setNewStudent({...newStudent, matricula: e.target.value})} />
              <input required placeholder="Nombre(s)" className={styles.inputField} value={newStudent.nombres} onChange={(e) => setNewStudent({...newStudent, nombres: e.target.value})} />
              
              <div className={styles.formRow}>
                <input required placeholder="Apellido Paterno" className={styles.inputField} value={newStudent.apellido_paterno} onChange={(e) => setNewStudent({...newStudent, apellido_paterno: e.target.value})} />
                <input placeholder="Apellido Materno" className={styles.inputField} value={newStudent.apellido_materno} onChange={(e) => setNewStudent({...newStudent, apellido_materno: e.target.value})} />
              </div>
              
              <input type="email" placeholder="Correo electrónico (Opcional)" className={styles.inputField} value={newStudent.correo} onChange={(e) => setNewStudent({...newStudent, correo: e.target.value})} />
              
              <div className={styles.formFooter}>
                <ExpandingButton icon={isSubmitting ? Loader2 : Save} label={isSubmitting ? "Guardando..." : "Guardar Alumno"} type="submit" variant="primary" disabled={isSubmitting} />
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ textAlign: "center", position: "relative" }}>
            <button onClick={() => setShowImportModal(false)} className={styles.closeButton} style={{ position: "absolute", top: "20px", right: "20px" }}><X size={24} /></button>
            
            <div style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "6px 14px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "800", marginBottom: "20px", fontSize: "0.8rem" }}>
              <Sparkles size={16} /> MOTOR GEMINI 3.0 FLASH
            </div>
            
            <h2 className={styles.modalTitle} style={{ marginBottom: "8px" }}>Importación Inteligente</h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "24px" }}>Sube una lista en PDF o Excel para procesar alumnos masivamente.</p>
            
            {importError && (
              <div style={{ backgroundColor: "#fee2e2", color: "#b91c1c", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "0.9rem", textAlign: "left", display: "flex", alignItems: "flex-start", gap: "8px", border: "1px solid #f87171" }}>
                <X size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>{importError}</span>
              </div>
            )}
            
            <div style={{ border: "2px dashed #cbd5e1", padding: "30px", borderRadius: "16px", cursor: "pointer", backgroundColor: selectedFile ? "#f0f7ff" : "transparent", transition: "all 0.2s" }}>
              <input 
                type="file" 
                accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx" 
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] || null);
                  setImportError(null); 
                }} 
                style={{ display: "none" }} 
                id="file-ia" 
              />
              <label htmlFor="file-ia" style={{ cursor: "pointer", display: "block" }}>
                {importStatus === 'analyzing' ? (
                  <Loader2 className="animate-spin" size={40} color="#2563eb" style={{ margin: "0 auto" }} />
                ) : (
                  <FileText size={40} color="#94a3b8" style={{ margin: "0 auto" }} />
                )}
                <p style={{ marginTop: "12px", fontWeight: "600", color: "#475569" }}>
                  {selectedFile ? selectedFile.name : "Seleccionar archivo PDF o Imagen"}
                </p>
              </label>
            </div>
            
            <div style={{ marginTop: "30px", display: "flex", justifyContent: "center" }}>
              <ExpandingButton 
                icon={importStatus === 'analyzing' ? Loader2 : Sparkles} 
                label={importStatus === 'analyzing' ? "Analizando con IA..." : (importStatus === 'success' ? "¡Alumnos Importados!" : "Iniciar Análisis")} 
                onClick={handleGeminiImport} 
                variant="ai" 
                disabled={!selectedFile || importStatus !== 'idle'} 
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}