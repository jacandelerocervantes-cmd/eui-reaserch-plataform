import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type Criterio = { nombre: string; peso: number };
export type UnidadExtraida = { id: number | string; nombre: string; criterios?: Criterio[] };
export type CourseData = { nombre: string; clave?: string; unidades?: UnidadExtraida[]; competencias?: string[] };

export function useExtraccionDatos() {
  const [step, setStep] = useState("upload"); // upload | analizando | revisando | guardado
  const [isSaving, setIsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Aquí se guardará lo que responda Gemini 2.5 Flash
  const [courseData, setCourseData] = useState<CourseData | null>(null);

  // --- LÓGICA DE DRAG & DROP Y CONEXIÓN CON IA ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    setStep("analizando");
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Llamada al motor IEO de extracción
      const { data, error } = await supabase.functions.invoke('intelligent-file-parser', {
        body: formData,
      });

      if (error) throw error;

      if (data && data.success) {
        setCourseData(data.data);
        setStep("revisando");
      } else {
        console.error("Error en la extracción IEO:", data);
        alert(`Anomalía de Extracción: ${data.error || "No se pudo procesar el documento."}`);
        setStep("upload");
      }
    } catch (err) {
      console.error("Fallo de conexión:", err);
      alert("Error crítico: Pérdida de conexión con el Orquestador IEO al leer el archivo.");
      setStep("upload");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  // --- LÓGICA DE DESPLIEGUE FINAL ---
  const handleGuardar = async () => {
    if (!courseData) return;
    try {
      setIsSaving(true);

      // 1. Obtener usuario autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sesión inválida. Vuelve a iniciar sesión.");

      // 2. Crear la materia en la base de datos
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .insert({ title: courseData.nombre, teacher_id: user.id })
        .select("id")
        .single();
      if (courseError) throw new Error(courseError.message);

      // 3. Crear las unidades
      if ((courseData.unidades?.length ?? 0) > 0) {
        const units = (courseData.unidades ?? []).map((u, idx: number) => ({
          course_id: course.id,
          name: u.nombre,
          unit_number: typeof u.id === "number" ? u.id : idx + 1,
        }));
        const { error: unitsError } = await supabase.from("course_units").insert(units);
        if (unitsError) throw new Error(unitsError.message);
      }

      // 4. Aprovisionar Google Drive y Sheets
      const { data: provData, error: provError } = await supabase.functions.invoke(
        "provision-course-environment",
        { body: { courseId: course.id, title: courseData.nombre, clave: courseData.clave ?? "" } }
      );
      if (provError) throw provError;
      if (!provData?.success) throw new Error("Error al configurar Google Workspace.");

      setStep("guardado");
    } catch (err) {
      console.error("Fallo de despliegue:", err);
      alert("Error crítico: " + (err instanceof Error ? err.message : "Error al desplegar la materia."));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    step, setStep,
    isSaving,
    dragActive, setDragActive,
    courseData,
    handleDrag,
    handleDrop,
    handleChange,
    handleGuardar,
  };
}
