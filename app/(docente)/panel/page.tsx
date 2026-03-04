"use client";

import { useState, useEffect } from "react";
import CourseCard from "@/components/courses/CourseCard";
import CourseModal from "@/components/courses/CourseModal";
import FloatingActionButton from "@/components/ui/FloatingActionButton";
import styles from "./panel.module.css";
import { supabase } from "@/lib/supabase";

interface Course {
  id: string;
  title: string;
  drive_folder_id: string | null;
  teacher_id: string;
}

export default function PanelPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("Error cargando materias:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitModal = async (name: string, units: number, semester: string, year: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return alert("Debes iniciar sesión.");

      // 1. Crear Materia
      const { data: newCourse, error: courseError } = await supabase
        .from("courses")
        .insert([{ title: name, teacher_id: session.user.id, is_active: true }])
        .select()
        .single();

      if (courseError) throw courseError;

      // 2. Crear Unidades y Drive
      if (newCourse && units > 0) {
        const unitsData = Array.from({ length: units }).map((_, i) => ({
          course_id: newCourse.id,
          name: `Unidad ${i + 1}`,
          unit_number: i + 1
        }));
        
        await supabase.from("course_units").insert(unitsData);

        const abreviatura = semester === "Enero - Julio" ? "EJ" : "AD";
        const claveDrive = `${abreviatura}-${year}`; 

        await supabase.functions.invoke('provision-course-environment', {
          body: { courseId: newCourse.id, title: name, clave: claveDrive }
        });
      }

      await fetchCourses();
      setIsModalOpen(false);
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <main className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <h2 className={styles.pageTitle}>Panel de Gestión</h2>
            <p className={styles.pageSubtitle}>Administra tus asignaturas y entornos virtuales.</p>
          </div>
        </header>

        {loading ? (
          <div className={styles.emptyState}>Cargando asignaturas...</div>
        ) : courses.length > 0 ? (
          <div className={styles.cardsGrid}>
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                studentsCount={0}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>No tienes asignaturas creadas en este periodo.</p>
          </div>
        )}
      </main>

      <FloatingActionButton onClick={() => setIsModalOpen(true)} />

      <CourseModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
      />
    </div>
  );
}