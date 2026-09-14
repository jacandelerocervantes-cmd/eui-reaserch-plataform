"use client";

import React, { useState } from "react";
import { X, Trash2, Save } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import styles from "./CourseModal.module.css";

// Interfaz actualizada para soportar Creación (4 datos) y Edición (1 dato + Eliminar)
interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Hacemos que los últimos 3 parámetros sean opcionales para que funcione en Edición
  onSubmit: (name: string, units?: number, semester?: string, year?: number) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  courseId?: string | null;
  title?: string;
  initialName?: string;
  initialYear?: number | null;
  initialSemester?: string | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2, CURRENT_YEAR + 3];

export default function CourseModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  courseId,
  title = "Apertura de Asignatura",
  initialName = "",
  initialYear = null,
  initialSemester = null,
}: CourseModalProps) {
  // El padre remonta este componente (con una key distinta) cada vez que se
  // abre para una materia distinta o se vuelve a abrir el modal de creación,
  // así que estos valores iniciales solo necesitan leerse una vez al montar
  // — no hace falta un efecto que los reescriba cuando cambian las props.
  const [name, setName] = useState(initialName);
  const [units, setUnits] = useState(1);
  const [semester, setSemester] = useState(initialSemester || "Enero - Julio");
  const [year, setYear] = useState(initialYear || CURRENT_YEAR);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name, units, semester, year);
    // Limpiar form
    if (!courseId) {
      setName("");
      setUnits(1);
      setSemester("Enero - Julio");
      setYear(new Date().getFullYear());
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{ position: "relative" }}>
        <button type="button" onClick={onClose} style={{ position: "absolute", top: "24px", right: "24px", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
          <X size={22} />
        </button>
        <h2 className={styles.title}>{title}</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Nombre de la Asignatura</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Taller de Investigación I"
              autoFocus
              required
            />
          </div>

          {/* Número de Unidades: solo al crear — no debe poder cambiarse después */}
          {!courseId && (
            <div className={styles.formGroup}>
              <label>Número de Unidades</label>
              <input
                type="number"
                min="1"
                max="10"
                value={units}
                onChange={(e) => setUnits(Number(e.target.value))}
                required
              />
            </div>
          )}

          {/* Año y Semestre: editables tanto al crear como al editar, siempre
              con <select> (nunca texto libre) para que el docente no pueda
              cometer un error de formato al escribir a mano. */}
          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label>Año</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Semestre</label>
              <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                <option value="Enero - Julio">Enero - Julio</option>
                <option value="Agosto - Diciembre">Agosto - Diciembre</option>
              </select>
            </div>
          </div>

          <div className={styles.footer} style={{ justifyContent: courseId ? "space-between" : "flex-end" }}>
            {/* Botón Eliminar: Solo aparece si hay un courseId (Edición) — ícono fijo sin texto */}
            {courseId && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(courseId)}
                title="Eliminar Materia"
                style={{ backgroundColor: "#fef2f2", color: "#ef4444", border: "1px solid #fee2e2", padding: "10px", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <Trash2 size={18} />
              </button>
            )}

            <ExpandingButton
              icon={Save}
              label={courseId ? "Guardar Cambios" : "Aperturar"}
              type="submit"
              variant="primary"
              disabled={!name.trim()}
              size={42} radius={10} gap={8} padding="0 14px" fontWeight={700} durationMs={300}
            />
          </div>
        </form>
      </div>
    </div>
  );
}