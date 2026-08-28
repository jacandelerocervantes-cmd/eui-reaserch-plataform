// Vocabulario: la base de datos guarda el enum en inglés (multiple_choice,
// true_false, open, matching). La UI solo traduce para mostrar al docente.
export const TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Opción Múltiple",
  true_false: "Verdadero/Falso",
  open: "Abierta",
  matching: "Relación de Columnas",
  short_answer: "Respuesta Corta",
  fill_blank: "Completar Espacios",
  ordering: "Ordenar/Secuenciar",
  multi_select: "Selección Múltiple (varias)",
};
