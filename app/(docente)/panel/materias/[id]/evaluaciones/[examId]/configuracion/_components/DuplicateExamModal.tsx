"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { buildQuestionRow, type EditQuestion } from "../../../_components/questionMapping";
import { formatUnitTitle } from "@/lib/formatUnitName";

type CourseOption = { id: string; title: string };
type UnitOption = { id: string; unit_number: number; title: string };

export type ExamToDuplicate = {
  title: string;
  description?: string | null;
  duration_minutes?: number | null;
  randomize_questions?: boolean;
  randomize_options?: boolean;
  show_all_questions?: boolean;
  weight_data?: { weight_percentage?: number; [key: string]: unknown } | null;
  deployment_method?: string | null;
  google_form_url?: string | null;
};

export default function DuplicateExamModal({
  currentCourseId,
  exam,
  questions,
  onClose,
}: {
  currentCourseId: string;
  exam: ExamToDuplicate;
  questions: EditQuestion[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [targetCourseId, setTargetCourseId] = useState("");
  const [targetUnitId, setTargetUnitId] = useState("");
  const [duplicateTitle, setDuplicateTitle] = useState(`${exam.title} (copia)`);
  const [createGoogleForm, setCreateGoogleForm] = useState(
    exam.deployment_method === "google_forms" || !!exam.google_form_url
  );
  const [loading, setLoading] = useState(true);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicatingStep, setDuplicatingStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Cargar materias activas del docente actual
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("courses")
          .select("id, title")
          .eq("teacher_id", user.id)
          .eq("is_active", true)
          .order("title");
        setCourses(data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentCourseId]);

  // Cargar unidades de la materia destino
  useEffect(() => {
    if (!targetCourseId) {
      setUnits([]);
      setTargetUnitId("");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("course_units")
        .select("id, unit_number, title")
        .eq("course_id", targetCourseId)
        .order("unit_number");
      setUnits(data ?? []);
      setTargetUnitId(data?.[0]?.id ?? "");
    })();
  }, [targetCourseId]);

  // Copia 1:1 del examen y reactivos, generando un Google Form independiente si se solicita
  const handleCopy1to1 = async () => {
    if (!targetCourseId || !targetUnitId) {
      setError("Selecciona materia y unidad destino.");
      return;
    }
    setIsDuplicating(true);
    setError(null);
    setDuplicatingStep("Creando examen y duplicando reactivos...");

    try {
      // 1. Insertar el examen nuevo en borrador
      const finalTitle = duplicateTitle.trim() || `${exam.title} (copia)`;
      const { data: newExam, error: examError } = await supabase
        .from("exams")
        .insert([{
          course_id: targetCourseId,
          unit_id: targetUnitId,
          title: finalTitle,
          description: exam.description || null,
          status: "draft",
          start_at: null,
          end_at: null,
          duration_minutes: exam.duration_minutes || 60,
          randomize_questions: exam.randomize_questions ?? true,
          randomize_options: exam.randomize_options ?? true,
          show_all_questions: exam.show_all_questions ?? false,
          deployment_method: createGoogleForm ? "google_forms" : "interno",
          weight_data: exam.weight_data || null,
        }])
        .select("id")
        .single();

      if (examError || !newExam) {
        throw new Error(examError?.message || "Error al crear la copia del examen.");
      }

      // 2. Insertar reactivos asociados al nuevo examen
      if (questions.length > 0) {
        const questionRows = questions.map((q, idx) => buildQuestionRow(q, newExam.id, idx));
        const { error: qError } = await supabase.from("questions").insert(questionRows);
        if (qError) {
          throw new Error(qError.message || "Error al duplicar las preguntas.");
        }
      }

      // 3. Si se solicitó Google Forms, generar un Form exclusivo e independiente en Drive
      if (createGoogleForm) {
        setDuplicatingStep("Generando Google Form independiente en Google Drive...");
        try {
          const { data: formPayload, error: formErr } = await supabase.functions.invoke("publish-exam-form", {
            body: { examId: newExam.id, force: true },
          });
          let resultData = formPayload;
          if (formErr) {
            try {
              const errJson = await (formErr as any).context?.json?.();
              if (errJson) resultData = errJson;
            } catch {}
          }
          if (formErr || !resultData?.success) {
            console.warn("[DUPLICATE_EXAM] No se pudo generar Google Form en copia:", resultData?.error || formErr?.message);
          }
        } catch (callErr) {
          console.warn("[DUPLICATE_EXAM] Falló llamada a publish-exam-form:", callErr);
        }
      }

      // 4. Redirigir a la pantalla de configuración del nuevo examen
      router.push(`/panel/materias/${targetCourseId}/evaluaciones/${newExam.id}/configuracion`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsDuplicating(false);
      setDuplicatingStep("");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDuplicating) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "20px",
          padding: "30px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "800", fontSize: "1.15rem" }}>
            Duplicar a otra materia
          </h3>
          <button
            onClick={onClose}
            disabled={isDuplicating}
            style={{
              background: "none",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "6px",
              cursor: isDuplicating ? "not-allowed" : "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "30px" }}>
            <Loader2 className="animate-spin" size={28} color="#1B396A" />
          </div>
        ) : courses.length === 0 ? (
          <p style={{ color: "#64748b", margin: "16px 0" }}>
            No tienes otras materias activas para duplicar esta evaluación.
          </p>
        ) : (
          <>
            <label
              style={{
                fontSize: "0.75rem",
                fontWeight: "900",
                color: "#64748b",
                display: "block",
                marginBottom: "6px",
                textTransform: "uppercase",
              }}
            >
              Título de la evaluación duplicada
            </label>
            <input
              type="text"
              value={duplicateTitle}
              onChange={(e) => setDuplicateTitle(e.target.value)}
              disabled={isDuplicating}
              placeholder="Nombre del examen..."
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                marginBottom: "16px",
                fontWeight: "600",
                color: "#1B396A",
                outline: "none",
                backgroundColor: "white",
              }}
            />

            <label
              style={{
                fontSize: "0.75rem",
                fontWeight: "900",
                color: "#64748b",
                display: "block",
                marginBottom: "8px",
                textTransform: "uppercase",
              }}
            >
              Materia destino
            </label>
            <select
              value={targetCourseId}
              onChange={(e) => setTargetCourseId(e.target.value)}
              disabled={isDuplicating}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                marginBottom: "16px",
                fontWeight: "600",
                color: "#1B396A",
                outline: "none",
                backgroundColor: "white",
              }}
            >
              <option value="">Selecciona una materia...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}{c.id === currentCourseId ? " (Materia actual)" : ""}
                </option>
              ))}
            </select>

            {targetCourseId && units.length > 0 && (
              <>
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: "900",
                    color: "#64748b",
                    display: "block",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                  }}
                >
                  Unidad destino
                </label>
                <select
                  value={targetUnitId}
                  onChange={(e) => setTargetUnitId(e.target.value)}
                  disabled={isDuplicating}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    marginBottom: "16px",
                    fontWeight: "600",
                    color: "#1B396A",
                    outline: "none",
                    backgroundColor: "white",
                  }}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatUnitTitle(u.unit_number, u.title)}
                    </option>
                  ))}
                </select>
              </>
            )}

            {targetCourseId && units.length === 0 && (
              <p style={{ color: "#d97706", fontSize: "0.85rem", fontWeight: "600", marginBottom: "16px" }}>
                La materia seleccionada no tiene unidades configuradas todavía.
              </p>
            )}

            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "16px",
                cursor: isDuplicating ? "not-allowed" : "pointer",
              }}
              onClick={() => !isDuplicating && setCreateGoogleForm(!createGoogleForm)}
            >
              <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: isDuplicating ? "not-allowed" : "pointer" }}>
                <input
                  type="checkbox"
                  checked={createGoogleForm}
                  onChange={(e) => setCreateGoogleForm(e.target.checked)}
                  disabled={isDuplicating}
                  style={{ marginTop: "3px", cursor: isDuplicating ? "not-allowed" : "pointer", accentColor: "#1B396A" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#1B396A" }}>
                    Generar nuevo Google Form independiente
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px", lineHeight: "1.3" }}>
                    Crea un formulario nuevo exclusivo para este grupo en Google Drive, con su propia liga y hoja de respuestas separada.
                  </div>
                </div>
              </label>
            </div>

            {isDuplicating && duplicatingStep && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  fontSize: "0.82rem",
                  fontWeight: "600",
                  marginBottom: "16px",
                }}
              >
                <Loader2 className="animate-spin" size={16} />
                <span>{duplicatingStep}</span>
              </div>
            )}

            {error && (
              <div
                style={{
                  backgroundColor: "#fee2e2",
                  color: "#991b1b",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  marginBottom: "16px",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={handleCopy1to1}
                disabled={isDuplicating || !targetCourseId || !targetUnitId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "none",
                  backgroundColor: "#1B396A",
                  color: "white",
                  fontWeight: "700",
                  cursor: isDuplicating ? "wait" : (!targetCourseId || !targetUnitId) ? "not-allowed" : "pointer",
                  opacity: !targetCourseId || !targetUnitId ? 0.5 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {isDuplicating ? <Loader2 className="animate-spin" size={18} /> : <Copy size={18} />}
                {isDuplicating ? "Duplicando..." : "Copiar 1:1"}
              </button>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "4px 0 0", textAlign: "center" }}>
                Las fechas se definen en la revisión. La audiencia personalizada no se copia.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

