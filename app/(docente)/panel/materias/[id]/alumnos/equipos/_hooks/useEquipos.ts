import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatStudentName } from "@/lib/formatStudentName";

// --- TIPOS ---
export type Student = { id: string; matricula: string; apellido_paterno: string; apellido_materno: string | null; nombres: string; };
export type Team = { id: string; name: string; members: Student[] };

export type FetchResult = { ok: true; students: Student[]; teams: Team[] } | { ok: false; error: string };

export async function fetchEquipos(courseId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: studentsData } = await supabase
      .from("students").select("*").eq("course_id", courseId).order("apellido_paterno");

    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, team_members(student_id)")
      .eq("course_id", courseId)
      .order("name");

    const students: Student[] = studentsData ?? [];
    const teams: Team[] = teamsData && studentsData
      ? teamsData.map((t: { id: string; name: string; team_members: { student_id: string }[] | null }) => ({
          id: t.id,
          name: t.name,
          members: (t.team_members || [])
            .map((tm) => studentsData.find((s: Student) => s.id === tm.student_id))
            .filter(Boolean) as Student[],
        }))
      : [];

    return { ok: true, students, teams };
  } catch (e) {
    console.error("Error cargando equipos:", e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudieron cargar los equipos." };
  }
}

export function useEquiposContent(courseId: string, reloadKey: number, onReload: () => void) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FetchResult>({ ok: false, error: "" });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchEquipos(courseId, reloadKey).then((r) => {
      if (!isMounted) return;
      setResult(r);
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [courseId, reloadKey]);

  const [searchTerm, setSearchTerm] = useState("");

  // --- SELECCIÓN DE ALUMNOS PARA CREAR EQUIPO (Vía 1) ---
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- EDICIÓN DE EQUIPO EXISTENTE ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editMemberIds, setEditMemberIds] = useState<string[]>([]);

  // --- IMPORTACIÓN CON IA (Vía 2) ---
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'analyzing' | 'success'>('idle');
  const [importError, setImportError] = useState<string | null>(null);

  if (loading) {
    return { loading: true as const };
  }

  if (!result.ok) {
    return { loading: false as const, ok: false as const, error: result.error };
  }

  const { students, teams } = result;

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const syncTeamsToSheet = async () => {
    try {
      await supabase.functions.invoke('sync-teams', { body: { courseId } });
    } catch (err) {
      console.warn("[SYNC_TEAMS_SILENT_ERROR]", err);
    }
  };

  // --- VÍA 1: crear equipo a partir de alumnos seleccionados ---
  const handleCreateTeamFromSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("teams").insert({ course_id: courseId, name: newTeamName }).select("id").single();
      if (error) throw error;

      const rows = selectedStudentIds.map(sid => ({ team_id: data.id, student_id: sid }));
      const { error: memErr } = await supabase.from("team_members").insert(rows);
      if (memErr) throw memErr;

      setShowNameModal(false);
      setNewTeamName("");
      setSelectedStudentIds([]);
      syncTeamsToSheet();
      onReload();
    } catch (e) {
      alert("Error al crear el equipo: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Edición de equipo existente (renombrar / ajustar integrantes) ---
  const openEditModal = (team: Team) => {
    setEditingTeam(team);
    setEditTeamName(team.name);
    setEditMemberIds(team.members.map(m => m.id));
    setShowEditModal(true);
  };

  const toggleEditMember = (studentId: string) => {
    setEditMemberIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("teams").update({ name: editTeamName }).eq("id", editingTeam.id);
      if (error) throw error;

      const { error: delErr } = await supabase.from("team_members").delete().eq("team_id", editingTeam.id);
      if (delErr) throw delErr;

      if (editMemberIds.length > 0) {
        const rows = editMemberIds.map(sid => ({ team_id: editingTeam.id, student_id: sid }));
        const { error: memErr } = await supabase.from("team_members").insert(rows);
        if (memErr) throw memErr;
      }

      setShowEditModal(false);
      syncTeamsToSheet();
      onReload();
    } catch (e) {
      alert("Error al guardar cambios: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("¿Eliminar este equipo? Los alumnos no se eliminan, solo la agrupación.")) return;
    try {
      const { error } = await supabase.from("teams").delete().eq("id", teamId);
      if (error) throw error;
      syncTeamsToSheet();
      onReload();
    } catch (e) {
      alert("Error al eliminar: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleRemoveMember = async (teamId: string, studentId: string) => {
    try {
      const { error } = await supabase.from("team_members").delete().match({ team_id: teamId, student_id: studentId });
      if (error) throw error;
      syncTeamsToSheet();
      onReload();
    } catch (e) {
      alert("Error al quitar integrante: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // --- VÍA 2: importar con Gemini ---
  const handleGeminiImport = async () => {
    if (!selectedFile) return;
    setImportStatus('analyzing');
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("archivo", selectedFile);
      formData.append("courseId", courseId);

      const { data, error } = await supabase.functions.invoke('import-ia-teams', { body: formData });

      if (error) throw new Error(error.message || "Error de conexión con el servidor.");
      if (!data?.success) throw new Error(data?.error || "Fallo desconocido en el servidor de IA.");

      setImportStatus('success');
      setTimeout(() => {
        setShowImportModal(false);
        setImportStatus('idle');
        setSelectedFile(null);
        syncTeamsToSheet();
        onReload();
      }, 2000);

    } catch (e) {
      console.error("Error de importación:", e instanceof Error ? e.message : e);
      setImportError("No pudimos procesar el archivo. Verifica que tenga la agrupación de equipos y alumnos.");
      setImportStatus('idle');
    }
  };

  const filteredStudents = students.filter(s =>
    formatStudentName(s).toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatStudentName(s, { order: "nombre-apellido" }).toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.matricula.includes(searchTerm)
  );

  return {
    loading: false as const,
    ok: true as const,
    students, teams,
    searchTerm, setSearchTerm,
    selectedStudentIds, setSelectedStudentIds,
    showNameModal, setShowNameModal,
    newTeamName, setNewTeamName,
    isSubmitting,
    showEditModal, setShowEditModal,
    editingTeam,
    editTeamName, setEditTeamName,
    editMemberIds,
    showImportModal, setShowImportModal,
    selectedFile, setSelectedFile,
    importStatus,
    importError, setImportError,
    filteredStudents,
    toggleStudentSelection,
    handleCreateTeamFromSelection,
    openEditModal,
    toggleEditMember,
    handleSaveEdit,
    handleDeleteTeam,
    handleRemoveMember,
    handleGeminiImport,
  };
}
