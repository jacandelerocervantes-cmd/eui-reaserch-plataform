import { useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type FormData = {
  title: string; description: string; unit_id: string; criteria_id: string;
  format: string; submission_type: string; soft_deadline: string; hard_deadline: string;
  late_penalty_percent: number;
};

export type UnitOption = { id: string; unit_number: number; title: string };
export type CriterionOption = { id: string; unit_id: string; name: string };
export type SessionOption = { id: string; created_at: string; session_number: number };
export type Rubric = { id: number; name: string; description: string; weight: number };

export type FetchResult =
  | { ok: true; units: UnitOption[]; criteria: CriterionOption[]; pastSessions: SessionOption[]; formData: FormData; requireAttendance: boolean; selectedSessionId: string; rubrics: Rubric[] }
  | { ok: false };

// No lanzamos error visible aparte: esta pantalla original solo mostraba una
// alerta y dejaba la página en blanco si fallaba, así que el estado "ok:false"
// simplemente evita renderizar el formulario sin datos.
async function fetchActividad(courseId: string, assignmentId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    // 1. Obtener Unidades
    const { data: unitsData } = await supabase.from("course_units").select("id, unit_number, title").eq("course_id", courseId).order("unit_number", { ascending: true });

    // 2. Obtener Criterios
    let criteria: CriterionOption[] = [];
    if (unitsData && unitsData.length > 0) {
      const unitIds = unitsData.map((u: { id: string }) => u.id);
      const { data: actsData } = await supabase.from("activities").select("id, unit_id, name").in("unit_id", unitIds);
      criteria = actsData ?? [];
    }

    // 3. Obtener Sesiones Pasadas
    const { data: sesiones } = await supabase.from('insitu_sessions').select('id, created_at, session_number').eq('course_id', courseId).order('created_at', { ascending: false });

    // 4. Obtener la Actividad a Editar
    const { data: assignmentData, error } = await supabase.from("assignments").select("*").eq("id", assignmentId).single();
    if (error) throw error;

    const formData: FormData = {
      title: assignmentData.title,
      description: assignmentData.description || "",
      unit_id: assignmentData.unit_id,
      criteria_id: assignmentData.criteria_id || "",
      format: assignmentData.format || "individual",
      submission_type: assignmentData.submission_type || "file",
      soft_deadline: assignmentData.soft_deadline ? new Date(assignmentData.soft_deadline).toISOString().slice(0, 16) : "",
      hard_deadline: assignmentData.hard_deadline ? new Date(assignmentData.hard_deadline).toISOString().slice(0, 16) : "",
      late_penalty_percent: assignmentData.late_penalty_percent || 0,
    };

    const requireAttendance = !!assignmentData.requiere_sesion_id;
    const selectedSessionId = assignmentData.requiere_sesion_id || "";

    const rubrics = assignmentData.rubric_data
      ? (typeof assignmentData.rubric_data === 'string' ? JSON.parse(assignmentData.rubric_data) : assignmentData.rubric_data)
      : [];

    return { ok: true, units: unitsData ?? [], criteria, pastSessions: sesiones ?? [], formData, requireAttendance, selectedSessionId, rubrics };
  } catch (error) {
    console.error("Error cargando la actividad:", error);
    return { ok: false };
  }
}

export function useEditarActividad(courseId: string, assignmentId: string) {
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(() => fetchActividad(courseId, assignmentId, reloadKey), [courseId, assignmentId, reloadKey]);
  const result = use(resource);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [requireAttendance, setRequireAttendance] = useState(result.ok ? result.requireAttendance : false);
  const [selectedSessionId, setSelectedSessionId] = useState(result.ok ? result.selectedSessionId : "");
  const [formData, setFormData] = useState<FormData>(result.ok ? result.formData : {
    title: "", description: "", unit_id: "", criteria_id: "", format: "individual",
    submission_type: "file", soft_deadline: "", hard_deadline: "", late_penalty_percent: 0,
  });
  const [rubrics, setRubrics] = useState<Rubric[]>(result.ok ? result.rubrics : []);

  // --- LÓGICA DE BLOQUEO POR FECHA ---
  const isDeadlinePassed = formData.soft_deadline ? new Date() > new Date(formData.soft_deadline) : false;

  const totalRubricWeight = rubrics.reduce((sum, r) => sum + Number(r.weight), 0);
  const isRubricValid = totalRubricWeight === 100;

  const handleAddRubricRow = () => {
    if (isDeadlinePassed) return;
    setRubrics([...rubrics, { id: Date.now(), name: "", description: "", weight: 0 }]);
  };

  const handleRemoveRubricRow = (id: number) => {
    if (isDeadlinePassed) return;
    if (rubrics.length > 1) setRubrics(rubrics.filter(r => r.id !== id));
  };

  const handleUpdateRubric = (id: number, field: string, value: string | number) => {
    if (isDeadlinePassed) return;
    setRubrics(rubrics.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleGenerateAI = async () => {
    if (isDeadlinePassed || !formData.title || !formData.description) return alert("Falta título o descripción.");

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-rubric-ia', { body: { title: formData.title, description: formData.description } });
      if (error || !data.success) throw new Error(data?.error || "Error al generar la rúbrica");

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRubricValid && !isDeadlinePassed) return alert("La rúbrica debe sumar 100%.");
    if (requireAttendance && !selectedSessionId) return alert("Selecciona la clase vinculada.");

    setIsSaving(true);
    try {
      const payload = {
        assignment_id:        assignmentId,
        unit_id:              formData.unit_id,
        criteria_id:          formData.criteria_id || null,
        title:                formData.title,
        description:          formData.description,
        format:               formData.format,
        submission_type:      formData.submission_type,
        soft_deadline:        formData.soft_deadline,
        hard_deadline:        formData.hard_deadline || null,
        late_penalty_percent: formData.late_penalty_percent,
        rubric_json:          rubrics,
        requiere_sesion_id:   requireAttendance ? selectedSessionId : null,
      };

      // Vía edge function (no update directo): así, en segundo plano, se
      // refresca el doc informativo de la carpeta de la actividad con el
      // título/instrucciones/rúbrica nuevos — es lo único que se regenera al
      // editar, las carpetas y archivos de alumnos/equipos no se tocan.
      const { data, error } = await supabase.functions.invoke('update-assignment-hub', { body: payload });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Error al actualizar la actividad");

      alert("Cambios guardados correctamente");
      router.push(`/panel/materias/${courseId}/actividades`);
    } catch (error) {
      alert(`Error al actualizar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    result,
    isGenerating,
    isSaving,
    requireAttendance, setRequireAttendance,
    selectedSessionId, setSelectedSessionId,
    formData, setFormData,
    rubrics,
    isDeadlinePassed,
    totalRubricWeight,
    isRubricValid,
    handleAddRubricRow,
    handleRemoveRubricRow,
    handleUpdateRubric,
    handleGenerateAI,
    handleSave,
    onRetry: () => setReloadKey((k) => k + 1),
  };
}
