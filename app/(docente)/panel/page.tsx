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
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

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

  const handleOpenCreate = () => {
    setModalMode("create");
    setSelectedCourseId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    setModalMode("edit");
    setSelectedCourseId(id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta asignatura?")) {
      try {
        const { error } = await supabase
          .from("courses")
          .update({ is_active: false })
          .eq("id", id);

        if (error) throw error;
        setCourses(courses.filter((course) => course.id !== id));
      } catch (error) {
        console.error("Error eliminando:", error);
        alert("Hubo un error al eliminar la materia.");
      }
    }
  };

  const handleSubmitModal = async (name: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("Debes iniciar sesión.");

      if (modalMode === "create") {
        const { data, error } = await supabase
          .from("courses")
          .insert([{ title: name, teacher_id: user.id }])
          .select()
          .single();

        if (error) throw error;
        setCourses([data, ...courses]);
      } else if (modalMode === "edit" && selectedCourseId) {
        const { data, error } = await supabase
          .from("courses")
          .update({ title: name })
          .eq("id", selectedCourseId)
          .select()
          .single();

        if (error) throw error;
        setCourses(courses.map(c => c.id === selectedCourseId ? data : c));
      }
    } catch (error) {
      console.error("Error guardando:", error);
      throw error;
    }
  };

  const courseToEdit = courses.find(c => c.id === selectedCourseId);

  return (
    <div className={styles.pageContainer}>
      <main className={styles.mainContent}>
        
        {/* Cabecera limpia, SIN el botón viejo */}
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
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>No tienes asignaturas creadas en este periodo.</p>
          </div>
        )}

      </main>

      {/* AQUÍ ESTÁ EL NUEVO BOTÓN FLOTANTE */}
      <FloatingActionButton onClick={handleOpenCreate} />

      {/* EL MODAL QUE YA FUNCIONA CON SUPABASE */}
      <CourseModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
        title={modalMode === "create" ? "Apertura de Asignatura" : "Editar Asignatura"}
        initialName={modalMode === "edit" ? courseToEdit?.title : ""}
      />
    </div>
  );
}