import { supabase } from "@/lib/supabase";
import type { Student, AttendanceRecord, CourseUnit } from "../_components/types";

export type FetchResult =
  | { ok: true; students: Student[]; attendance: AttendanceRecord[]; units: CourseUnit[]; activeUnit: CourseUnit | null; initialUnitNumber: number | null }
  | { ok: false; error: string };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
export async function fetchHistorial(courseId: string, _reloadKey: number): Promise<FetchResult> {
  try {
    const { data: unitsData } = await supabase
      .from("course_units")
      .select("id, unit_number, title, is_closed")
      .eq("course_id", courseId)
      .order("unit_number");

    const units: CourseUnit[] = unitsData ?? [];
    const activeUnit = units.find((u: CourseUnit) => !u.is_closed) ?? null;
    // Default al tab de la unidad activa; si todas cerradas, la primera
    const initialUnitNumber = activeUnit?.unit_number ?? units[0]?.unit_number ?? null;

    const { data: stData } = await supabase.from("students").select("*").eq("course_id", courseId).order("apellido_paterno");
    const { data: attData } = await supabase
      .from("validated_attendances")
      .select("*")
      .eq("course_id", courseId)
      .order("session_date")
      .order("session_number");

    return { ok: true, students: stData ?? [], attendance: attData ?? [], units, activeUnit, initialUnitNumber };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cargar el historial de asistencia." };
  }
}
