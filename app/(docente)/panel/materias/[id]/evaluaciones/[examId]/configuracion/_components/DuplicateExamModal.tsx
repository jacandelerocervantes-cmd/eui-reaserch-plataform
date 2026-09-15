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
  const [loading, setLoading] = useState(true);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar materias activas del docente actual excluyendo la materia de origen
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
          .neq("id", currentCourseId)
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

  // Copia 1:1 exacta del examen y sus reactivos hacia la materia y unidad seleccionada
  const handleCopy1to1 = async () => {
    if (!targetCourseId || !targetUnitId) {
      setError("Selecciona materia y unidad destino.");
      return;
    }
    setIsDuplicating(true);
    setError(null);

    try {
      // 1. Insertar el examen nuevo en borrador (status: draft, fechas vacías para definición al revisar)
      const { data: newExam, error: examError } = await supabase
        .from("exams")
        .insert([{
          course_id: targetCourseId,
          unit_id: targetUnitId,
          title: `${exam.title} (copia)`,
          description: exam.description || null,
          status: "draft",
          start_at: null,
          end_at: null,
          duration_minutes: exam.duration_minutes || 60,
          randomize_questions: exam.randomize_questions ?? true,
          randomize_options: exam.randomize_options ?? true,
          show_all_questions: exam.show_all_questions ?? false,
          deployment_method: "interno",
          weight_data: exam.weight_data || null,
        }])
        .select("id")
        .single();

      if (examError || !newExam) {
        throw new Error(examError?.message || "Error al crear la copia del examen.");
      }

      // 2. Insertar reactivos asociados al nuevo examen (preservando tipo, contenido, opciones, respuesta y puntaje)
      if (questions.length > 0) {
        const questionRows = questions.map((q, idx) => buildQuestionRow(q, newExam.id, idx));
        const { error: qError } = await supabase.from("questions").insert(questionRows);
        if (qError) {
          throw new Error(qError.message || "Error al duplicar las preguntas.");
        }
      }

      // 3. Redirigir a la pantalla de configuración del nuevo examen
      router.push(`/panel/materias/${targetCourseId}/evaluaciones/${newExam.id}/configuracion`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsDuplicating(false);
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
                  {c.title}
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
                Copiar 1:1
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

