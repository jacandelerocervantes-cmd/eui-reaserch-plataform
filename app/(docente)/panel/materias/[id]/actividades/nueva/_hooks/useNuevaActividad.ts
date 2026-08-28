import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type UnitOption = { id: string; unit_number: number; title: string };
export type TeamOption = { id: string; name: string; memberCount: number };
export type SessionOption = { id: string; created_at: string; session_number: number };

export function useNuevaActividad(courseId: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [pastSessions, setPastSessions] = useState<SessionOption[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rubricSourceFile, setRubricSourceFile] = useState<File | null>(null);

  // --- ESTADOS PARA SELECCIÓN DE EQUIPOS YA CREADOS (Alumnos > Equipos) ---
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [teamSearchTerm, setTeamSearchTerm] = useState("");

  // --- ESTADOS PARA EL CANDADO DE ASISTENCIA ---
  const [requireAttendance, setRequireAttendance] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");

  // ESTADO LIMPIO PARA NUEVA ACTIVIDAD
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    unit_id: "",
    criteria_id: "",
    format: "individual", // "individual" | "equipo"
    submission_type: "file", // "file" | "doc" | "sheet" | "slide"
    soft_deadline: "",
    hard_deadline: "",
    late_penalty_percent: 0,
  });

  const [rubrics, setRubrics] = useState(() => [{ id: Date.now(), name: "Contenido", description: "", weight: 100 }]);

  const totalRubricWeight = rubrics.reduce((sum, r) => sum + Number(r.weight), 0);
  const isRubricValid = totalRubricWeight === 100;

  const loadDependencias = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: unitsData, error: uErr } = await supabase
        .from("course_units")
        .select("id, unit_number, title")
        .eq("course_id", courseId)
        .order("unit_number", { ascending: true });
      if (uErr) throw uErr;

      const { data: teamsData, error: tErr } = await supabase
        .from("teams")
        .select("id, name, team_members(student_id)")
        .eq("course_id", courseId)
        .order("name");
      if (tErr) throw tErr;

      const mappedTeams = (teamsData ?? []).map((t: { id: string; name: string; team_members: unknown[] | null }) => ({
        id: t.id,
        name: t.name,
        memberCount: t.team_members?.length ?? 0
      }));

      const { data: sesiones, error: sErr } = await supabase
        .from('insitu_sessions')
        .select('id, created_at, session_number')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      if (sErr) throw sErr;

      const loadedUnits = unitsData ?? [];
      setUnits(loadedUnits);
      setTeams(mappedTeams);
      setPastSessions(sesiones ?? []);

      if (loadedUnits.length > 0) {
        setFormData(prev => ({
          ...prev,
          unit_id: prev.unit_id || loadedUnits[0].id
        }));
      }
    } catch (err) {
      console.error("Error cargando dependencias de la actividad:", err);
      setError("No se pudieron cargar las unidades/equipos de la materia. Intenta recargar la página.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      loadDependencias();
    }
  }, [courseId]);

  const handleAddRubricRow = () => setRubrics([...rubrics, { id: Date.now(), name: "", description: "", weight: 0 }]);
  const handleRemoveRubricRow = (id: number) => { if (rubrics.length > 1) setRubrics(rubrics.filter(r => r.id !== id)); };
  const handleUpdateRubric = (id: number, field: string, value: string | number) => setRubrics(rubrics.map(r => r.id === id ? { ...r, [field]: value } : r));

  // MAGIA CON IA
  const handleGenerateAI = async () => {
    if (!formData.title?.trim()) {
      alert("Por favor, escribe primero el Título de la actividad arriba para que la IA sepa qué criterios y competencias generar.");
      return;
    }

    setIsGenerating(true);
    try {
      let body: FormData | { title: string; description: string };
      if (rubricSourceFile) {
        const fd = new FormData();
        fd.append("title", formData.title);
        fd.append("description", formData.description);
        fd.append("archivo", rubricSourceFile);
        body = fd;
      } else {
        body = { title: formData.title, description: formData.description };
      }

      const { data, error } = await supabase.functions.invoke('generate-rubric-ia', { body });
      if (error || !data?.success) throw new Error(data?.error || "Error al generar la rúbrica con IA.");

      const aiRubrics = data.rubrics.map((r: { id?: number; name: string; description: string; weight: number }) => ({
        id: r.id || Date.now() + Math.random(), name: r.name, description: r.description, weight: r.weight
      }));
      setRubrics(aiRubrics);
    } catch (error) {
      alert(`Error IA: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // GUARDAR Y CONECTAR CON GOOGLE WORKSPACE
  const handleSave = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (!formData.title?.trim()) return alert("Debes escribir el título de la actividad.");
    if (!formData.unit_id) return alert("Debes seleccionar una unidad temática.");
    if (!formData.soft_deadline) return alert("Debes definir la fecha de entrega (Deadline).");
    if (!isRubricValid) return alert(`La rúbrica debe sumar exactamente 100%. Actualmente suma ${totalRubricWeight}%.`);
    if (requireAttendance && !selectedSessionId) return alert("Debes seleccionar a qué clase se vincula el candado de asistencia.");
    if (formData.format === 'equipo' && selectedTeamIds.length === 0) return alert("Selecciona al menos un equipo para esta actividad.");

    setIsSaving(true);
    try {
      const payload = {
        course_id: courseId,
        unit_id: formData.unit_id,
        criteria_id: formData.criteria_id || null,
        title: formData.title,
        description: formData.description,
        format: formData.format,
        submission_type: formData.submission_type,
        soft_deadline: formData.soft_deadline,
        hard_deadline: formData.hard_deadline || null,
        late_penalty_percent: formData.late_penalty_percent,
        rubric_json: rubrics,
        requiere_sesion_id: requireAttendance ? selectedSessionId : null,
        team_ids: formData.format === 'equipo' ? selectedTeamIds : null,
      };

      // Disparamos la Edge Function que orquesta Supabase + Google Drive
      const { data, error } = await supabase.functions.invoke('create-assignment-hub', { body: payload });
      if (error || !data.success) throw new Error(data?.error || "Error al guardar la actividad");

      alert(`Actividad creada con éxito. ${formData.submission_type !== 'file' ? '\nEntorno Workspace generado en Drive.' : ''}`);
      router.push(`/panel/materias/${courseId}/actividades`);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    loading,
    error,
    units,
    teams,
    pastSessions,
    isGenerating,
    isSaving,
    rubricSourceFile, setRubricSourceFile,
    selectedTeamIds, setSelectedTeamIds,
    showTeamPicker, setShowTeamPicker,
    teamSearchTerm, setTeamSearchTerm,
    requireAttendance, setRequireAttendance,
    selectedSessionId, setSelectedSessionId,
    formData, setFormData,
    rubrics,
    totalRubricWeight,
    isRubricValid,
    handleAddRubricRow,
    handleRemoveRubricRow,
    handleUpdateRubric,
    handleGenerateAI,
    handleSave,
    onRetry: loadDependencias,
  };
}
