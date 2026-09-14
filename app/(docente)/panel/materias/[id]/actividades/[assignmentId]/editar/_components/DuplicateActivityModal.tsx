"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Copy, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Rubric = { id: number; name: string; description: string; weight: number };

type ActivityToDuplicate = {
  title: string;
  description: string;
  format: string;
  submission_type: string;
  late_penalty_percent: number;
  rubrics: Rubric[];
};

type CourseOption = { id: string; title: string };
type UnitOption = { id: string; unit_number: number; title: string };

// Clave de sessionStorage que "nueva/page.tsx" (a través de useNuevaActividad)
// lee al montar para precargar el chat con la actividad original como
// contexto — implementa "Generar similar" del diseño (reabre el chat con el
// original precargado, en vez de copiar 1:1 sin pasar por conversación).
export const DUPLICATE_SEED_KEY = "eui_duplicate_activity_seed";

export default function DuplicateActivityModal({
  currentCourseId, activity, onClose,
}: {
  currentCourseId: string;
  activity: ActivityToDuplicate;
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

  useEffect(() => {
    if (!targetCourseId) { setUnits([]); setTargetUnitId(""); return; }
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

  // Copia exacta: crea la actividad ya en la materia destino vía la misma
  // Edge Function que usa "Nueva Actividad" — reutiliza toda su lógica
  // (carpeta Drive, submissions, watermark). La fecha de entrega es un
  // placeholder (+7 días): el docente la ajusta de inmediato en "editar" de
  // la copia recién creada, como indica el diseño ("las fechas se ajustan
  // después"). Los equipos no se copian — pertenecen a la materia de origen.
  const handleCopy1to1 = async () => {
    if (!targetCourseId || !targetUnitId) return setError("Selecciona materia y unidad destino.");
    setIsDuplicating(true);
    setError(null);
    try {
      const placeholderDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      const payload = {
        course_id: targetCourseId,
        unit_id: targetUnitId,
        title: activity.title,
        description: activity.description,
        format: "individual",
        submission_type: activity.submission_type,
        soft_deadline: placeholderDeadline,
        late_penalty_percent: activity.late_penalty_percent,
        rubric_json: activity.rubrics,
      };
      const { data, error: fnError } = await supabase.functions.invoke("create-assignment-hub", { body: payload });
      if (fnError || !data?.success) throw new Error(data?.error || "Error al duplicar la actividad.");

      router.push(`/panel/materias/${targetCourseId}/actividades/${data.data.id}/editar`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsDuplicating(false);
    }
  };

  // Generar similar: no crea nada todavía — guarda el original como "semilla"
  // y abre el chat de creación en la materia destino, precargado, para que
  // el docente pida ajustes conversacionalmente antes de guardar.
  const handleGenerateSimilar = () => {
    if (!targetCourseId) return setError("Selecciona la materia destino.");
    sessionStorage.setItem(DUPLICATE_SEED_KEY, JSON.stringify({
      title: activity.title,
      description: activity.description,
      rubrics: activity.rubrics,
    }));
    router.push(`/panel/materias/${targetCourseId}/actividades/nueva`);
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: "white", borderRadius: "20px", padding: "30px", maxWidth: "480px", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "800" }}>Duplicar a otra materia</h3>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "30px" }}><Loader2 className="animate-spin" size={28} color="#1B396A" /></div>
        ) : courses.length === 0 ? (
          <p style={{ color: "#64748b" }}>No tienes otras materias activas para duplicar esta actividad.</p>
        ) : (
          <>
            <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>Materia destino</label>
            <select
              value={targetCourseId}
              onChange={(e) => setTargetCourseId(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "16px", fontWeight: "600", color: "#1B396A" }}
            >
              <option value="">Selecciona una materia...</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>

            {targetCourseId && units.length > 0 && (
              <>
                <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>Unidad destino</label>
                <select
                  value={targetUnitId}
                  onChange={(e) => setTargetUnitId(e.target.value)}
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "16px", fontWeight: "600", color: "#1B396A" }}
                >
                  {units.map((u) => <option key={u.id} value={u.id}>Unidad {u.unit_number}: {u.title}</option>)}
                </select>
              </>
            )}

            {error && (
              <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontSize: "0.85rem", fontWeight: "600", marginBottom: "16px" }}>{error}</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button" onClick={handleCopy1to1} disabled={isDuplicating || !targetCourseId}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", borderRadius: "12px", border: "none", backgroundColor: "#1B396A", color: "white", fontWeight: "700", cursor: isDuplicating ? "wait" : "pointer", opacity: !targetCourseId ? 0.5 : 1 }}
              >
                {isDuplicating ? <Loader2 className="animate-spin" size={18} /> : <Copy size={18} />}
                Copiar 1:1
              </button>
              <button
                type="button" onClick={handleGenerateSimilar} disabled={isDuplicating || !targetCourseId}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", borderRadius: "12px", border: "1px solid #1B396A", backgroundColor: "white", color: "#1B396A", fontWeight: "700", cursor: "pointer", opacity: !targetCourseId ? 0.5 : 1 }}
              >
                <Sparkles size={18} /> Generar similar
              </button>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "4px 0 0" }}>
                La fecha se ajusta después. Los equipos no se copian.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
