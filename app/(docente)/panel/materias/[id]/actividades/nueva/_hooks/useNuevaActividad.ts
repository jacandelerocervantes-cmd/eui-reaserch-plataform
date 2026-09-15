import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { sumWeights, isWeightComplete } from "@/lib/weightValidation";
import type { PuzzleData } from "../_components/PuzzlePreviewModal";

export type UnitOption = { id: string; unit_number: number; title: string };
export type TeamOption = { id: string; name: string; memberCount: number };
export type SessionOption = { id: string; created_at: string; session_number: number };

// Debe coincidir con DUPLICATE_SEED_KEY en
// actividades/[assignmentId]/editar/_components/DuplicateActivityModal.tsx —
// "Generar similar" del flujo de Duplicar deja aquí la actividad original
// para precargar el chat en la materia destino, en vez de duplicar en frío.
const DUPLICATE_SEED_KEY = "eui_duplicate_activity_seed";

type DuplicateSeed = { title: string; description: string; rubrics: { id: number; name: string; description: string; weight: number }[] };

function readAndClearDuplicateSeed(): DuplicateSeed | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DUPLICATE_SEED_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DUPLICATE_SEED_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  // --- ESTADOS PARA PUZZLES Y GAMIFICACIÓN CON IA ---
  const [puzzleData, setPuzzleData] = useState<PuzzleData | null>(null);
  const [isGeneratingPuzzle, setIsGeneratingPuzzle] = useState(false);
  const [showPuzzlePreview, setShowPuzzlePreview] = useState(false);

  // --- ESTADOS PARA SELECCIÓN DE EQUIPOS YA CREADOS (Alumnos > Equipos) ---
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [teamSearchTerm, setTeamSearchTerm] = useState("");

  // --- ESTADOS PARA EL CANDADO DE ASISTENCIA ---
  const [requireAttendance, setRequireAttendance] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");

  // Se lee y limpia una sola vez, aquí — formData/rubrics/hasGeneratedRubric
  // se derivan todos de este mismo valor para no releer sessionStorage.
  const [duplicateSeed] = useState<DuplicateSeed | null>(() => readAndClearDuplicateSeed());

  // ESTADO LIMPIO PARA NUEVA ACTIVIDAD (o precargado desde "Generar similar")
  const [formData, setFormData] = useState({
    title: duplicateSeed?.title ?? "",
    description: duplicateSeed?.description ?? "",
    unit_id: "",
    criteria_id: "",
    format: "individual", // "individual" | "equipo"
    submission_type: "file", // "file" | "doc" | "sheet" | "slide"
    soft_deadline: "",
    hard_deadline: "",
    late_penalty_percent: 0,
  });

  const [rubrics, setRubrics] = useState(() =>
    duplicateSeed?.rubrics?.length ? duplicateSeed.rubrics : [{ id: Date.now(), name: "Contenido", description: "", weight: 100 }]
  );

  const totalRubricWeight = sumWeights(rubrics);
  const isRubricValid = formData.submission_type.startsWith("puzzle_") || isWeightComplete(totalRubricWeight);

  const loadDependencias = useCallback(async () => {
    if (!courseId) return;
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
  }, [courseId]);

  useEffect(() => {
    loadDependencias();
  }, [loadDependencias]);

  const handleAddRubricRow = () => setRubrics([...rubrics, { id: Date.now(), name: "", description: "", weight: 0 }]);
  const handleRemoveRubricRow = (id: number) => { if (rubrics.length > 1) setRubrics(rubrics.filter(r => r.id !== id)); };
  const handleUpdateRubric = (id: number, field: string, value: string | number) => setRubrics(rubrics.map(r => r.id === id ? { ...r, [field]: value } : r));

  // CHAT DE RÚBRICA + INSTRUCCIONES CON IA — cada turno llama a
  // generate-rubric-ia; si ya hubo un turno previo (hasGeneratedRubric), manda
  // la rúbrica actual como contexto para que la IA AJUSTE en vez de
  // regenerar todo desde cero. La IA también redacta/ajusta las instrucciones
  // (formData.description) en el mismo turno — Actividades es "más simple"
  // que Exámenes: el chat es un asistente de redacción para ambas cosas,
  // no solo genera la rúbrica. Devuelve el texto del "asistente" para el chat.
  const [hasGeneratedRubric, setHasGeneratedRubric] = useState(!!duplicateSeed?.rubrics?.length);

  const handleChatRubricTurn = useCallback(async (message: string): Promise<string> => {
    if (!formData.title?.trim()) {
      throw new Error("Escribe primero el Título de la actividad arriba para que pueda generar criterios y competencias.");
    }

    setIsGenerating(true);
    try {
      const currentRubricsPayload = hasGeneratedRubric ? rubrics : [];
      let body: FormData | Record<string, unknown>;
      if (rubricSourceFile) {
        const fd = new FormData();
        fd.append("title", formData.title);
        fd.append("description", formData.description);
        fd.append("archivo", rubricSourceFile);
        fd.append("instruction", message);
        fd.append("current_rubrics", JSON.stringify(currentRubricsPayload));
        body = fd;
      } else {
        body = { title: formData.title, description: formData.description, instruction: message, current_rubrics: currentRubricsPayload };
      }

      const { data, error } = await supabase.functions.invoke('generate-rubric-ia', { body });
      if (error || !data?.success) throw new Error(data?.error || "Error al generar la rúbrica con IA.");

      const aiRubrics = data.rubrics.map((r: { id?: number; name: string; description: string; weight: number }) => ({
        id: r.id || Date.now() + Math.random(), name: r.name, description: r.description, weight: r.weight
      }));
      setRubrics(aiRubrics);
      setHasGeneratedRubric(true);

      const aiInstructions: string | undefined = data.instructions;
      if (aiInstructions?.trim()) {
        setFormData(prev => ({ ...prev, description: aiInstructions }));
      }

      const totalWeight = aiRubrics.reduce((sum: number, r: { weight: number }) => sum + Number(r.weight), 0);
      const instructionsNote = aiInstructions?.trim() ? " También actualicé las instrucciones para el alumno." : "";
      return `Listo. Propuesta con ${aiRubrics.length} criterios (${aiRubrics.map((r: { name: string }) => r.name).join(", ")}), suman ${totalWeight}%.${instructionsNote} Puedes seguir pidiendo ajustes o guardar la actividad.`;
    } finally {
      setIsGenerating(false);
    }
  }, [formData.title, formData.description, rubricSourceFile, rubrics, hasGeneratedRubric]);

  // GENERAR PUZZLE CON IA (Crucigrama o Sopa de Letras)
  const handleGeneratePuzzle = async (specificType?: string) => {
    if (!formData.title?.trim()) {
      setFeedback({ type: "error", message: "Escribe primero el Título de la actividad arriba para que la IA genere conceptos pedagógicos relevantes." });
      return;
    }
    const type = specificType || formData.submission_type;
    const puzzleType = type === "puzzle_wordsearch" ? "wordsearch" : "crossword";
    setIsGeneratingPuzzle(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-rubric-ia", {
        body: {
          title: formData.title,
          description: formData.description,
          puzzleType,
        },
      });
      if (error || !data?.success) throw new Error(data?.error || "Error al generar el puzzle con IA.");
      setPuzzleData(data.puzzleData);
      setFeedback({ type: "success", message: `¡${puzzleType === "crossword" ? "Crucigrama" : "Sopa de Letras"} generado con éxito! Puedes hacer clic en "Vista Previa del Puzzle" para probarlo.` });
    } catch (err: unknown) {
      setFeedback({ type: "error", message: `Error al generar puzzle: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setIsGeneratingPuzzle(false);
    }
  };

  // GUARDAR Y CONECTAR CON GOOGLE WORKSPACE O PUZZLE
  const handleSave = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (!formData.title?.trim()) return setFeedback({ type: "error", message: "Debes escribir el título de la actividad." });
    if (!formData.unit_id) return setFeedback({ type: "error", message: "Debes seleccionar una unidad temática." });
    if (!formData.soft_deadline) return setFeedback({ type: "error", message: "Debes definir la fecha de entrega (Deadline)." });
    if (formData.hard_deadline && new Date(formData.hard_deadline) <= new Date(formData.soft_deadline)) {
      return setFeedback({ type: "error", message: "La fecha límite tardía (hard deadline) debe ser posterior a la fecha de entrega (soft deadline)." });
    }
    if (!formData.submission_type.startsWith("puzzle_") && !isRubricValid) {
      return setFeedback({ type: "error", message: `La rúbrica debe sumar exactamente 100%. Actualmente suma ${totalRubricWeight}%.` });
    }
    if (requireAttendance && !selectedSessionId) return setFeedback({ type: "error", message: "Debes seleccionar a qué clase se vincula el candado de asistencia." });
    if (formData.format === 'equipo' && selectedTeamIds.length === 0) return setFeedback({ type: "error", message: "Selecciona al menos un equipo para esta actividad." });
    if (formData.submission_type.startsWith("puzzle_") && !puzzleData) {
      return setFeedback({ type: "error", message: "Debes hacer clic en 'Generar con IA' antes de guardar la actividad." });
    }

    setIsSaving(true);
    try {
      const rubricJsonPayload = formData.submission_type.startsWith("puzzle_")
        ? { rubrics, puzzle_data: puzzleData }
        : rubrics;

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
        rubric_json: rubricJsonPayload,
        requiere_sesion_id: requireAttendance ? selectedSessionId : null,
        team_ids: formData.format === 'equipo' ? selectedTeamIds : null,
      };

      // Disparamos la Edge Function que orquesta Supabase + Google Drive
      const { data, error } = await supabase.functions.invoke('create-assignment-hub', { body: payload });
      if (error || !data.success) throw new Error(data?.error || "Error al guardar la actividad");

      setFeedback({ type: "success", message: `Actividad creada con éxito.${['doc', 'sheet', 'slide'].includes(formData.submission_type) ? ' Entorno Workspace generado en Drive.' : ''}` });
      // Pequeña espera para que el docente alcance a ver el banner antes de
      // navegar — a diferencia del alert() nativo que bloqueaba hasta cerrarlo.
      setTimeout(() => router.push(`/panel/materias/${courseId}/actividades`), 1200);
    } catch (error) {
      setFeedback({ type: "error", message: `Error: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    loading,
    error,
    feedback, setFeedback,
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
    puzzleData, setPuzzleData,
    isGeneratingPuzzle,
    showPuzzlePreview, setShowPuzzlePreview,
    handleGeneratePuzzle,
    handleAddRubricRow,
    handleRemoveRubricRow,
    handleUpdateRubric,
    handleChatRubricTurn,
    handleSave,
    onRetry: loadDependencias,
    hasDuplicateSeed: !!duplicateSeed,
  };
}
