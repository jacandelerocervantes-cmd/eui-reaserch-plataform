export type StudentNameInput = {
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  nombres?: string | null;
} | null | undefined;

export interface FormatStudentNameOptions {
  order?: "apellido-nombre" | "nombre-apellido";
  separator?: string;
}

/**
 * Unifica la reconstrucción del nombre del alumno garantizando la inclusión
 * del apellido materno si está disponible en la base de datos.
 *
 * @param s Objeto alumno con nombres, apellido_paterno y apellido_materno opcional
 * @param opts Opciones de orden ("apellido-nombre" por defecto con coma, o "nombre-apellido") y separador personalizado
 * @returns Nombre formateado de forma segura y limpia
 */
export function formatStudentName(
  s: StudentNameInput,
  opts?: FormatStudentNameOptions
): string {
  if (!s) return "";
  const apellidos = [s.apellido_paterno, s.apellido_materno].filter(Boolean).join(" ").trim();
  const nombres = (s.nombres || "").trim();

  if (opts?.order === "nombre-apellido") {
    return [nombres, apellidos].filter(Boolean).join(" ").trim();
  }

  const defaultSep = opts?.separator !== undefined ? opts.separator : ", ";
  if (apellidos && nombres) {
    return `${apellidos}${defaultSep}${nombres}`.trim();
  }
  return apellidos || nombres || "";
}

