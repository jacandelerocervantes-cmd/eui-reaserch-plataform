"use client";

import { use, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Search, Edit2, Trash2, X, Save,
  UserPlus, CalendarDays, Sparkles, FileText,
  Loader2, KeyRound, CheckCircle2, AlertCircle, RotateCcw
} from "lucide-react";
import styles from "./alumnos.module.css";
import ExpandingButton from "@/components/ui/ExpandingButton";

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

type FetchResult = { ok: true; students: Student[] } | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
async function fetchStudents(courseId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: studentsData, error } = await supabase
      .from("students")
      .select("*")
      .eq("course_id", courseId)
      .order("apellido_paterno");

    if (error) throw error;
    return { ok: true, students: studentsData ?? [] };
  } catch (e) {
    console.error("Error cargando alumnos:", e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudieron cargar los alumnos." };
  }
}

function ListaAlumnosContent({ resource, courseId, onReload }: { resource: Promise<FetchResult>; courseId: string; onReload: () => void }) {
  const result = use(resource);
  const router = useRouter();

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

  // Estados para creación de accesos (auth.users + profiles)
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{ created: string[]; skippedExisting: string[]; skippedNoEmail: string[]; failed: { email: string; error: string }[] } | null>(null);

  const students = result.ok ? result.students : [];

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
      onReload();
    } catch (e) {
      alert("Hubo un problema al guardar el alumno. Inténtalo de nuevo.");
      console.error(e instanceof Error ? e.message : e);
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
      onReload();
    } catch (e) {
      alert("Hubo un error al eliminar. Inténtalo de nuevo.");
      console.error(e instanceof Error ? e.message : e);
    }
  };

  const handleGeminiImport = async () => {
    if (!selectedFile) return;
    setImportStatus('analyzing');
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("archivo", selectedFile);
      formData.append("courseId", courseId);

      const { data, error } = await supabase.functions.invoke('import-ia-students', {
        body: formData,
      });

      if (error) throw new Error(error.message || "Error de conexión con el servidor.");
      if (!data?.success) throw new Error(data?.error || "Fallo desconocido en el servidor de IA.");

      setImportStatus('success');
      setTimeout(() => {
        setShowImportModal(false);
        setImportStatus('idle');
        setSelectedFile(null);
        onReload();
      }, 2000);

    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Error de importación:", message);
      let mensajeUI = "No pudimos procesar el archivo. Verifica que sea una lista válida e inténtalo de nuevo.";
      if (message.includes("rechazado por la IA")) {
        mensajeUI = "El documento no parece ser una lista de alumnos válida.";
      }
      setImportError(mensajeUI);
      setImportStatus('idle');
    }
  };

  const handleProvisionAccounts = async () => {
    setIsProvisioning(true);
    setProvisionResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('provision-student-accounts', {
        body: { course_id: courseId },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "No se pudieron crear los accesos.");
      setProvisionResult(data);
    } catch (e) {
      alert(`Error al crear accesos: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsProvisioning(false);
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
          <ExpandingButton icon={isProvisioning ? Loader2 : KeyRound} label={isProvisioning ? "Creando accesos..." : "Crear Accesos"} onClick={handleProvisionAccounts} variant="secondary" disabled={isProvisioning} size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px" />
          <ExpandingButton icon={Sparkles} label="Importar con Gemini" onClick={() => setShowImportModal(true)} variant="ai" size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px" />
          <ExpandingButton icon={UserPlus} label="Agregar Alumno" onClick={() => { setEditingStudent(null); setShowModal(true); }} variant="primary" size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px" />
        </div>
      </div>

      {!result.ok && (
        <div style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: "12px", fontWeight: "600", fontSize: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          {result.error}
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onReload} small smallSize={32} radius={8} gap={6} padding="0 12px" fontWeight={700} fontSize="0.8rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      {provisionResult && (
        <div style={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1rem", fontWeight: 800 }}>Resultado de creación de accesos</h3>
            <button onClick={() => setProvisionResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={18} /></button>
          </div>
          {provisionResult.created.length > 0 && (
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span style={{ fontSize: "0.85rem", color: "#16a34a" }}><strong>{provisionResult.created.length} cuenta(s) creada(s)</strong> y correo de invitación enviado a: {provisionResult.created.join(", ")}</span>
            </div>
          )}
          {provisionResult.skippedExisting.length > 0 && (
            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>{provisionResult.skippedExisting.length} ya tenían cuenta: {provisionResult.skippedExisting.join(", ")}</div>
          )}
          {provisionResult.skippedNoEmail.length > 0 && (
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span style={{ fontSize: "0.85rem", color: "#d97706" }}>Sin correo registrado (no se les pudo crear acceso): {provisionResult.skippedNoEmail.join(", ")}</span>
            </div>
          )}
          {provisionResult.failed.length > 0 && (
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span style={{ fontSize: "0.85rem", color: "#dc2626" }}>Fallaron: {provisionResult.failed.map(f => `${f.email} (${f.error})`).join("; ")}</span>
            </div>
          )}
          {provisionResult.created.length === 0 && provisionResult.skippedExisting.length === 0 && provisionResult.skippedNoEmail.length === 0 && provisionResult.failed.length === 0 && (
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>No hay alumnos en el roster todavía.</p>
          )}
        </div>
      )}

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
        <ExpandingButton icon={CalendarDays} label="Ver Historial" onClick={() => router.push(`/panel/materias/${courseId}/alumnos/historial`)} variant="secondary" size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px" />
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
            {filteredStudents.length === 0 ? (
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
                    <ExpandingButton small smallSize={36} icon={Edit2} label="Editar" variant="secondary" radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} expandedLabelMaxWidth="150px" onClick={() => {
                      setEditingStudent(s.id);
                      setNewStudent({ matricula: s.matricula, nombres: s.nombres, apellido_paterno: s.apellido_paterno, apellido_materno: s.apellido_materno || "", correo: s.correo || "" });
                      setShowModal(true);
                    }} />
                    <ExpandingButton small smallSize={36} icon={Trash2} label="Eliminar" variant="danger" radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} expandedLabelMaxWidth="150px" colors={{ bg: "#fee2e2", hoverBg: "#ef4444", text: "#ef4444", hoverText: "white" }} onClick={() => handleDelete(s.id)} />
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
                <ExpandingButton icon={isSubmitting ? Loader2 : Save} label={isSubmitting ? "Guardando..." : "Guardar Alumno"} type="submit" variant="primary" disabled={isSubmitting} size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px" />
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
              <Sparkles size={16} /> MOTOR GEMINI 2.5 FLASH
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
                size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ListaAlumnos() {
  const { id: courseId } = useParams() as { id: string };
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchStudents(courseId, reloadKey), [courseId, reloadKey]);

  return (
    <Suspense fallback={
      <div style={{ padding: "60px", textAlign: "center" }}>
        <Loader2 className="animate-spin" size={32} color="#1B396A" style={{ margin: "0 auto" }} />
      </div>
    }>
      <ListaAlumnosContent resource={resource} courseId={courseId} onReload={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
