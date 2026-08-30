"use client";

import { use, useState, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Search, Edit2, Trash2, X, Save, Plus,
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

interface ExtractedStudent {
  no?: number;
  matricula: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombres: string;
  correo: string;
  repite_curso?: boolean;
  ya_registrado?: boolean;
  existing_id?: string | null;
}

interface ExtractedGroup {
  pagina?: number | null;
  institucion?: string | null;
  tipo_documento?: string | null;
  materia?: string | null;
  clave_materia?: string | null;
  periodo?: string | null;
  paquete_grupo?: string | null;
  total_declarado?: number | null;
  docente?: string | null;
  alumnos: ExtractedStudent[];
  resumen?: {
    totalDeclarado?: number | null;
    totalExtraidos: number;
    coincideTotal: boolean;
    repitientes: number;
    nuevos: number;
    existentes: number;
  };
}

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

  // Estados para Importación Inteligente con IA
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [extractedGroups, setExtractedGroups] = useState<ExtractedGroup[]>([]);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [courseTitleFromApi, setCourseTitleFromApi] = useState("");

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

  // ── 1. Análisis con IA (Modo Preview) ─────────────────────────────────────
  const handleStartAnalysis = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("archivo", selectedFile);
      formData.append("courseId", courseId);
      formData.append("mode", "preview");

      const { data, error } = await supabase.functions.invoke('import-ia-students', {
        body: formData,
      });

      if (error) throw new Error(error.message || "Error de conexión con el servidor.");
      if (!data?.success) throw new Error(data?.error || "Fallo desconocido en el servidor de IA.");

      const rawGroups = data.grupos || [];
      const groups: ExtractedGroup[] = rawGroups.map((g: Record<string, unknown>) => ({
        ...g,
        alumnos: ((g.alumnos as Record<string, unknown>[]) || []).map((a: Record<string, unknown>) => ({
          ...a,
          matricula: String(a.matricula || ""),
          apellido_paterno: String(a.apellido_paterno || ""),
          apellido_materno: String(a.apellido_materno || ""),
          nombres: String(a.nombres || ""),
          correo: String(a.correo || ""),
          repite_curso: Boolean(a.repite_curso),
          ya_registrado: Boolean(a.ya_registrado),
          existing_id: a.existing_id as string | null,
        })),
      }));

      if (!groups.length) throw new Error("No se detectaron grupos ni alumnos en el documento.");

      setExtractedGroups(groups);
      setActiveGroupIndex(data.selectedGroupIndex ?? 0);
      setCourseTitleFromApi(data.courseTitle || "");
      setImportStep("preview");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Error de importación:", message);
      let mensajeUI = "No pudimos procesar el archivo. Verifica que sea una lista válida e inténtalo de nuevo.";
      if (message.includes("rechazado por la IA")) {
        mensajeUI = "El documento no parece ser una lista de alumnos válida.";
      } else if (message.includes("Tiempo de espera agotado")) {
        mensajeUI = "El tiempo de análisis se agotó. Intenta subir un archivo más liviano.";
      }
      setImportError(mensajeUI);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Edición interactiva dentro de la tabla de preview ─────────────────────
  const handleStudentFieldChange = (idx: number, field: keyof ExtractedStudent, value: string | boolean) => {
    setExtractedGroups(prev => {
      const next = [...prev];
      const currentGrp = { ...next[activeGroupIndex] };
      const currentAlumnos = [...currentGrp.alumnos];
      currentAlumnos[idx] = { ...currentAlumnos[idx], [field]: value };
      currentGrp.alumnos = currentAlumnos;
      next[activeGroupIndex] = currentGrp;
      return next;
    });
  };

  const handleRemoveStudent = (idx: number) => {
    setExtractedGroups(prev => {
      const next = [...prev];
      const currentGrp = { ...next[activeGroupIndex] };
      currentGrp.alumnos = currentGrp.alumnos.filter((_, i) => i !== idx);
      next[activeGroupIndex] = currentGrp;
      return next;
    });
  };

  const handleAddStudentRow = () => {
    setExtractedGroups(prev => {
      const next = [...prev];
      const currentGrp = { ...next[activeGroupIndex] };
      const newRow: ExtractedStudent = {
        no: currentGrp.alumnos.length + 1,
        matricula: "",
        apellido_paterno: "",
        apellido_materno: "",
        nombres: "",
        correo: "",
        repite_curso: false,
      };
      currentGrp.alumnos = [...currentGrp.alumnos, newRow];
      next[activeGroupIndex] = currentGrp;
      return next;
    });
  };

  // ── 2. Confirmación e Inserción de Alumnos ────────────────────────────────
  const handleCommitImport = async () => {
    const currentGroup = extractedGroups[activeGroupIndex];
    if (!currentGroup || currentGroup.alumnos.length === 0) return;

    setIsCommitting(true);
    setImportError(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-ia-students', {
        body: {
          courseId,
          mode: "commit",
          alumnos: currentGroup.alumnos,
        },
      });

      if (error) throw new Error(error.message || "Error al conectar con el servidor.");
      if (!data?.success) throw new Error(data?.error || "Error al inscribir alumnos.");

      setCommitMessage(data.message || `Se inscribieron ${currentGroup.alumnos.length} alumnos exitosamente.`);
      setImportStep("success");

      setTimeout(() => {
        setShowImportModal(false);
        setImportStep("upload");
        setSelectedFile(null);
        setExtractedGroups([]);
        onReload();
      }, 2000);
    } catch (e) {
      console.error("Error al confirmar alumnos:", e);
      setImportError(e instanceof Error ? e.message : "Error al guardar los alumnos.");
    } finally {
      setIsCommitting(false);
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

  const activeGroup = extractedGroups[activeGroupIndex];
  const activeAlumnos = activeGroup?.alumnos || [];
  const activeResumen = activeGroup?.resumen;

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
          <ExpandingButton icon={Sparkles} label="Importar con Gemini" onClick={() => { setImportStep('upload'); setImportError(null); setSelectedFile(null); setShowImportModal(true); }} variant="ai" size={44} radius={10} gap={8} padding="0 12px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="150px" />
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

      {/* MODAL CREAR / EDITAR MANUAL */}
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

      {/* MODAL IMPORTACIÓN INTELIGENTE CON IA */}
      {showImportModal && (
        <div className={styles.modalOverlay}>
          {importStep === 'upload' ? (
            <div className={styles.modalContent} style={{ textAlign: "center", position: "relative" }}>
              <button onClick={() => setShowImportModal(false)} className={styles.closeButton} style={{ position: "absolute", top: "20px", right: "20px" }}><X size={24} /></button>

              <div style={{ backgroundColor: "#eff6ff", color: "#2563eb", padding: "6px 14px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "800", marginBottom: "16px", fontSize: "0.8rem" }}>
                <Sparkles size={16} /> MOTOR GEMINI 2.5 FLASH
              </div>

              <h2 className={styles.modalTitle} style={{ marginBottom: "6px" }}>Importación Inteligente</h2>
              <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: "20px" }}>
                Sube tu documento oficial en PDF, Imagen o Excel (Prelistas TecNM, listas de asistencia o actas).
              </p>

              {importError && (
                <div style={{ backgroundColor: "#fee2e2", color: "#b91c1c", padding: "12px", borderRadius: "10px", marginBottom: "16px", fontSize: "0.88rem", textAlign: "left", display: "flex", alignItems: "flex-start", gap: "8px", border: "1px solid #f87171" }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
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
                  {isAnalyzing ? (
                    <Loader2 className="animate-spin" size={42} color="#2563eb" style={{ margin: "0 auto" }} />
                  ) : (
                    <FileText size={42} color="#94a3b8" style={{ margin: "0 auto" }} />
                  )}
                  <p style={{ marginTop: "12px", fontWeight: "700", color: "#334155", fontSize: "0.95rem" }}>
                    {selectedFile ? selectedFile.name : "Seleccionar Prelista o Archivo"}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "4px" }}>
                    Admite documentos con múltiples páginas y varios grupos
                  </p>
                </label>
              </div>

              <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
                <ExpandingButton
                  icon={isAnalyzing ? Loader2 : Sparkles}
                  label={isAnalyzing ? "Analizando documento con IA..." : "Analizar con IA"}
                  onClick={handleStartAnalysis}
                  variant="ai"
                  disabled={!selectedFile || isAnalyzing}
                  size={44} radius={10} gap={8} padding="0 14px" fontWeight={600} durationMs={300} iconSize={20} expandedLabelMaxWidth="220px"
                />
              </div>
            </div>
          ) : importStep === 'preview' ? (
            <div className={styles.modalContentLarge}>
              <div className={styles.modalHeader} style={{ marginBottom: "12px" }}>
                <div>
                  <h2 className={styles.modalTitle} style={{ fontSize: "1.35rem" }}>Revisión y Validación de Prelista</h2>
                  <p style={{ color: "#64748b", fontSize: "0.82rem", margin: "2px 0 0 0" }}>
                    Verifica la información extraída y selecciona el grupo a inscribir en esta materia.
                  </p>
                </div>
                <button onClick={() => setShowImportModal(false)} className={styles.closeButton}><X size={24} /></button>
              </div>

              {/* Selector de Grupos / Materias del PDF */}
              {extractedGroups.length > 1 && (
                <div>
                  <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>
                    Grupos detectados en el archivo ({extractedGroups.length}):
                  </div>
                  <div className={styles.groupTabsContainer}>
                    {extractedGroups.map((grp, idx) => {
                      const isActive = idx === activeGroupIndex;
                      const matchesCourse = courseTitleFromApi && (
                        (grp.materia && courseTitleFromApi.toLowerCase().includes(grp.materia.toLowerCase())) ||
                        (grp.paquete_grupo && courseTitleFromApi.toLowerCase().includes(grp.paquete_grupo.toLowerCase()))
                      );

                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`${styles.groupTab} ${isActive ? styles.groupTabActive : ""}`}
                          onClick={() => setActiveGroupIndex(idx)}
                        >
                          <span>{grp.paquete_grupo || `Grupo ${idx + 1}`} - {grp.materia || "Materia"}</span>
                          <span className={styles.groupTabBadge}>{grp.alumnos.length} alumnos</span>
                          {matchesCourse && <span className={styles.badgeMatch}>Coincide</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tarjeta de Metadatos del Grupo Activo */}
              {activeGroup && (
                <div className={styles.metadataCard}>
                  {activeGroup.institucion && (
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Institución</span>
                      <span className={styles.metadataValue}>{activeGroup.institucion}</span>
                    </div>
                  )}
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Asignatura</span>
                    <span className={styles.metadataValue}>{activeGroup.clave_materia ? `${activeGroup.clave_materia} - ` : ""}{activeGroup.materia}</span>
                  </div>
                  <div className={styles.metadataItem}>
                    <span className={styles.metadataLabel}>Grupo / Paquete</span>
                    <span className={styles.metadataValue}>{activeGroup.paquete_grupo || "01A"}</span>
                  </div>
                  {activeGroup.periodo && (
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Periodo</span>
                      <span className={styles.metadataValue}>{activeGroup.periodo}</span>
                    </div>
                  )}
                  {activeGroup.docente && (
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Docente</span>
                      <span className={styles.metadataValue}>{activeGroup.docente}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Banner de Validación de Integridad */}
              {activeGroup && activeResumen && (
                <div>
                  {activeResumen.coincideTotal ? (
                    <div className={styles.integrityBannerSuccess}>
                      <CheckCircle2 size={18} />
                      <span>
                        <strong>Integridad Confirmada:</strong> Se detectaron {activeAlumnos.length} de {activeResumen.totalDeclarado || activeAlumnos.length} alumnos declarados en la prelista (100% de coincidencia).
                      </span>
                    </div>
                  ) : (
                    <div className={styles.integrityBannerWarning}>
                      <AlertCircle size={18} />
                      <span>
                        <strong>Verificación de Lista:</strong> Se extrajeron {activeAlumnos.length} alumnos (la prelista indicaba {activeResumen.totalDeclarado} alumnos). Puedes revisar o añadir filas abajo.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Pills de Resumen */}
              <div className={styles.pillsRow}>
                <span className={`${styles.pillBadge} ${styles.pillNew}`}>
                  ✨ {activeAlumnos.filter(a => !a.ya_registrado).length} Nuevos
                </span>
                {activeAlumnos.filter(a => a.ya_registrado).length > 0 && (
                  <span className={`${styles.pillBadge} ${styles.pillExisting}`}>
                    🔄 {activeAlumnos.filter(a => a.ya_registrado).length} Ya en lista (se actualizarán)
                  </span>
                )}
                {activeAlumnos.filter(a => a.repite_curso).length > 0 && (
                  <span className={`${styles.pillBadge} ${styles.pillRep}`}>
                    🔁 {activeAlumnos.filter(a => a.repite_curso).length} Repiten curso (REP)
                  </span>
                )}
              </div>

              {importError && (
                <div style={{ backgroundColor: "#fee2e2", color: "#b91c1c", padding: "10px 14px", borderRadius: "8px", marginBottom: "12px", fontSize: "0.85rem", border: "1px solid #f87171" }}>
                  {importError}
                </div>
              )}

              {/* Tabla Editable de Alumnos Extraídos */}
              <div className={styles.previewScrollArea}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>#</th>
                      <th style={{ width: "120px" }}>Matrícula</th>
                      <th>Ap. Paterno</th>
                      <th>Ap. Materno</th>
                      <th>Nombre(s)</th>
                      <th>Correo Institucional</th>
                      <th style={{ width: "60px", textAlign: "center" }}>REP</th>
                      <th style={{ width: "40px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAlumnos.map((alum, idx) => (
                      <tr key={idx}>
                        <td style={{ color: "#94a3b8", fontWeight: 700, fontSize: "0.78rem" }}>{alum.no || (idx + 1)}</td>
                        <td>
                          <input
                            className={`${styles.previewInput} ${styles.previewInputMonospace}`}
                            value={alum.matricula}
                            onChange={(e) => handleStudentFieldChange(idx, "matricula", e.target.value)}
                            placeholder="Matrícula"
                          />
                        </td>
                        <td>
                          <input
                            className={styles.previewInput}
                            value={alum.apellido_paterno}
                            onChange={(e) => handleStudentFieldChange(idx, "apellido_paterno", e.target.value.toUpperCase())}
                            placeholder="Ap. Paterno"
                          />
                        </td>
                        <td>
                          <input
                            className={styles.previewInput}
                            value={alum.apellido_materno}
                            onChange={(e) => handleStudentFieldChange(idx, "apellido_materno", e.target.value.toUpperCase())}
                            placeholder="Ap. Materno"
                          />
                        </td>
                        <td>
                          <input
                            className={styles.previewInput}
                            value={alum.nombres}
                            onChange={(e) => handleStudentFieldChange(idx, "nombres", e.target.value.toUpperCase())}
                            placeholder="Nombre(s)"
                          />
                        </td>
                        <td>
                          <input
                            className={styles.previewInput}
                            value={alum.correo}
                            onChange={(e) => handleStudentFieldChange(idx, "correo", e.target.value.toLowerCase())}
                            placeholder="Correo"
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(alum.repite_curso)}
                            onChange={(e) => handleStudentFieldChange(idx, "repite_curso", e.target.checked)}
                            title="Repite curso (R)"
                            style={{ cursor: "pointer", width: "16px", height: "16px" }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudent(idx)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "4px" }}
                            title="Eliminar fila"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Botón para agregar fila manual */}
              <div style={{ marginBottom: "12px" }}>
                <button
                  type="button"
                  onClick={handleAddStudentRow}
                  style={{ background: "none", border: "1px dashed #cbd5e1", color: "#2563eb", padding: "6px 12px", borderRadius: "8px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Plus size={14} /> Agregar Alumno Manualmente
                </button>
              </div>

              {/* Footer de Acciones de Confirmación */}
              <div className={styles.previewActionsFooter}>
                <ExpandingButton
                  icon={RotateCcw}
                  label="Cambiar Archivo"
                  onClick={() => { setImportStep('upload'); setImportError(null); }}
                  variant="secondary"
                  size={42} radius={10} gap={6} padding="0 12px" fontWeight={600} durationMs={300} iconSize={18} expandedLabelMaxWidth="150px"
                />

                <ExpandingButton
                  icon={isCommitting ? Loader2 : CheckCircle2}
                  label={isCommitting ? "Inscribiendo..." : `Confirmar e Inscribir (${activeAlumnos.length} Alumnos)`}
                  onClick={handleCommitImport}
                  variant="primary"
                  disabled={isCommitting || activeAlumnos.length === 0}
                  size={42} radius={10} gap={8} padding="0 16px" fontWeight={700} durationMs={300} iconSize={20} expandedLabelMaxWidth="280px"
                />
              </div>
            </div>
          ) : (
            <div className={styles.modalContent} style={{ textAlign: "center", padding: "40px 20px" }}>
              <CheckCircle2 size={56} color="#16a34a" style={{ margin: "0 auto 16px auto" }} />
              <h2 className={styles.modalTitle} style={{ color: "#16a34a", marginBottom: "8px" }}>¡Importación Exitosa!</h2>
              <p style={{ color: "#475569", fontSize: "0.95rem" }}>
                {commitMessage || "Los alumnos se han inscrito correctamente en la materia."}
              </p>
            </div>
          )}
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

