"use client";

import CourseCard from "@/components/courses/CourseCard";
import CourseModal from "@/components/courses/CourseModal";
import FloatingActionButton from "@/components/ui/FloatingActionButton";
import styles from "./panel.module.css";
import { usePanelDocente } from "./_hooks/usePanelDocente";

export default function PanelPage() {
  const p = usePanelDocente();

  return (
    <div className={styles.pageContainer}>
      <main className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <div className={styles.titleGroup}>
            <h2 className={styles.pageTitle}>Mis Asignaturas</h2>
          </div>
        </header>

        {p.loading && <div className={styles.emptyState}>Cargando asignaturas...</div>}

        {!p.loading && p.error && (
          <div className={styles.emptyState} style={{ color: '#ef4444' }}>{p.error}</div>
        )}

        {!p.loading && !p.error && p.courses.length === 0 && (
          <div className={styles.emptyState}>
            <p>No tienes asignaturas creadas en este periodo.</p>
          </div>
        )}

        {!p.loading && !p.error && p.courses.length > 0 && (
          <div className={styles.cardsGrid}>
            {p.courses.map((course) => (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                studentsCount={course.studentsCount}
                onEdit={() => p.setEditingCourse(course)}
                onDelete={p.handleDeleteCourse}
              />
            ))}
          </div>
        )}
      </main>

      <FloatingActionButton onClick={() => p.setIsModalOpen(true)} />

      {/* Modal crear — key fuerza remount al abrir, así el formulario nace
          limpio cada vez sin necesitar un efecto que lo reinicie. */}
      <CourseModal
        key={p.isModalOpen ? 'create-open' : 'create-closed'}
        isOpen={p.isModalOpen}
        onClose={() => p.setIsModalOpen(false)}
        onSubmit={p.handleSubmitModal}
      />

      {/* Modal editar — key por materia: remonta con datos frescos si se abre
          para otra materia distinta. */}
      <CourseModal
        key={p.editingCourse?.id ?? 'edit-closed'}
        isOpen={!!p.editingCourse}
        onClose={() => p.setEditingCourse(null)}
        onSubmit={p.handleEditCourse}
        onDelete={p.handleDeleteCourse}
        courseId={p.editingCourse?.id}
        title="Editar Asignatura"
        initialName={p.editingCourse?.title ?? ""}
      />
    </div>
  );
}
