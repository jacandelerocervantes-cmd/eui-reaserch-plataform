import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Course {
  id: string;
  title: string;
  drive_folder_id: string | null;
  teacher_id: string;
  studentsCount: number;
  is_active: boolean;
  created_at: string;
}

// Tipo interno de Supabase al usar select("*, students(count)")
interface CourseRaw extends Omit<Course, 'studentsCount'> {
  students: { count: number }[];
}

/**
 * Toda la lógica de datos (fetch de materias del docente, alta/edición/baja)
 * y el estado que la acompaña para el Panel de Gestión.
 */
export function usePanelDocente() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);

      // getUser() valida contra el servidor — no confiar en getSession() en client
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Una sola query con conteo embebido — elimina el N+1 que había antes.
      // El filtro teacher_id garantiza que cada docente solo ve SUS materias.
      const { data, error: fetchError } = await supabase
        .from("courses")
        .select("*, students(count)")
        .eq("teacher_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const normalized: Course[] = ((data as CourseRaw[]) || []).map((m) => ({
        ...m,
        studentsCount: m.students?.[0]?.count ?? 0,
      }));

      setCourses(normalized);
    } catch (err) {
      console.error("Error cargando materias:", err);
      setError("No se pudieron cargar las asignaturas. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { fetchCourses(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleSubmitModal = async (name: string, units?: number, semester?: string, year?: number) => {
    try {
      // Usamos getUser() en lugar de getSession() para validar en servidor
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("Sesión expirada. Por favor recarga la página."); return; }

      const { data: newCourse, error: courseError } = await supabase
        .from("courses")
        .insert([{ title: name, teacher_id: user.id, is_active: true }])
        .select()
        .single();

      if (courseError) throw courseError;

      const numUnits = units ?? 0;
      if (newCourse && numUnits > 0) {
        const unitsData = Array.from({ length: numUnits }, (_, i) => ({
          course_id: newCourse.id,
          title: `Unidad ${i + 1}`,
          unit_number: i + 1,
        }));

        const { error: unitsError } = await supabase.from("course_units").insert(unitsData);
        if (unitsError) throw unitsError;

        const prefix = semester === "Enero - Julio" ? "EJ" : "AD";
        const clave = `${prefix}-${year ?? new Date().getFullYear()}`;

        // invoke() agrega automáticamente el JWT de la sesión en el header Authorization
        const { error: envError } = await supabase.functions.invoke('provision-course-environment', {
          body: { courseId: newCourse.id, title: name, clave },
        });
        if (envError) console.warn("Entorno Drive no creado:", envError.message);
      }

      await fetchCourses();
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      alert("Error al crear la asignatura: " + msg);
    }
  };

  const handleEditCourse = async (name: string) => {
    if (!editingCourse) return;
    try {
      const { error } = await supabase
        .from("courses")
        .update({ title: name })
        .eq("id", editingCourse.id);
      if (error) throw error;
      await fetchCourses();
      setEditingCourse(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      alert("Error al editar: " + msg);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm("¿Eliminar esta materia? Esta acción no se puede deshacer.")) return;
    try {
      const { error } = await supabase.from("courses").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      await fetchCourses();
      setEditingCourse(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      alert("Error al eliminar: " + msg);
    }
  };

  return {
    courses,
    loading,
    error,
    isModalOpen, setIsModalOpen,
    editingCourse, setEditingCourse,
    fetchCourses,
    handleSubmitModal,
    handleEditCourse,
    handleDeleteCourse,
  };
}
