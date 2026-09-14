import { supabase } from "@/lib/supabase";

export interface StudentRiskRow {
  student_id: string;
  nombre: string;
  asistencia_suavizada: number | null;
  puntualidad_suavizada: number | null;
  promedio_actividades_suavizado: number | null;
  promedio_examenes_suavizado: number | null;
  esfuerzo_suavizado: number | null;
  en_riesgo: boolean;
  motivo_riesgo: string[];
  confianza_insuficiente: string[];
  cluster: number | null; // null si quedó excluido del agrupamiento
  cluster_label: string | null;
}

export type FetchResult =
  | { ok: true; rows: StudentRiskRow[]; kUsado: number }
  | { ok: false; error: string };

/**
 * Encadena las 2 etapas del pipeline de riesgo:
 *   1. compute-student-risk-signals — YA valida `verifyCourseOwnership`
 *      server-side (solo el docente dueño de la materia, o un admin, puede
 *      ver esto — un docente no puede ver el riesgo de una materia ajena
 *      aunque cambie el [id] en la URL).
 *   2. cluster-student-risk — pura aritmética sobre el resultado de (1), sin
 *      volver a tocar la base de datos.
 *
 * No usa throw/reject (mismo patrón que fetchHistorial.ts): use() reserva
 * el "throw" para Suspense/ErrorBoundary, esta pantalla tiene su propia UI
 * de error con botón de reintento.
 */
export async function fetchRiesgo(courseId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: signalsData, error: signalsErr } = await supabase.functions.invoke(
      "compute-student-risk-signals",
      { body: { course_id: courseId } },
    );
    if (signalsErr || signalsData?.success === false) {
      return { ok: false, error: signalsData?.error ?? signalsErr?.message ?? "No se pudieron calcular las señales de riesgo." };
    }
    const students = signalsData.data.students as Array<Record<string, unknown>>;

    if (students.length === 0) {
      return { ok: true, rows: [], kUsado: 0 };
    }

    const { data: clusterData, error: clusterErr } = await supabase.functions.invoke(
      "cluster-student-risk",
      { body: { students } },
    );
    if (clusterErr || clusterData?.success === false) {
      return { ok: false, error: clusterData?.error ?? clusterErr?.message ?? "No se pudo agrupar a los alumnos por perfil de riesgo." };
    }

    const clusterByStudent = new Map<string, { cluster: number; label: string }>(
      clusterData.data.clustered.map((c: { student_id: string; cluster: number; label: string }) => [c.student_id, c]),
    );

    const rows: StudentRiskRow[] = students.map((s) => {
      const sid = s.student_id as string;
      const clusterInfo = clusterByStudent.get(sid);
      return {
        student_id: sid,
        nombre: s.nombre as string,
        asistencia_suavizada: s.asistencia_suavizada as number | null,
        puntualidad_suavizada: s.puntualidad_suavizada as number | null,
        promedio_actividades_suavizado: s.promedio_actividades_suavizado as number | null,
        promedio_examenes_suavizado: s.promedio_examenes_suavizado as number | null,
        esfuerzo_suavizado: s.esfuerzo_suavizado as number | null,
        en_riesgo: s.en_riesgo as boolean,
        motivo_riesgo: s.motivo_riesgo as string[],
        confianza_insuficiente: s.confianza_insuficiente as string[],
        cluster: clusterInfo?.cluster ?? null,
        cluster_label: clusterInfo?.label ?? null,
      };
    });

    return { ok: true, rows, kUsado: clusterData.data.k_usado };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "Error al cargar el riesgo académico." };
  }
}
