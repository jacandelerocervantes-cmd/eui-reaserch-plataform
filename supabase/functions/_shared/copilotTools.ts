/**
 * Catálogo de herramientas del Master Copilot — reconstruido a partir del
 * uso real en el frontend, no inventado desde cero:
 *   - components/ia/GeminiCanvas.tsx (TOOL_LABELS) confirma los nombres:
 *     crear_aviso, crear_material_boveda, crear_evaluacion, crear_actividad,
 *     cerrar_unidad, cerrar_entrega.
 *   - app/(docente)/panel/materias/[id]/drive/nuevo/page.tsx confirma los
 *     params exactos de crear_material_boveda, crear_presentacion_slides
 *     (no estaba en TOOL_LABELS pero sí se usa) y crear_rubrica_sheet.
 *
 * Los params de crear_aviso/crear_evaluacion/crear_actividad/cerrar_unidad/
 * cerrar_entrega no tienen un caller confirmado en el frontend todavía
 * (ningún componente arma su payload) — se infieren de las columnas reales
 * de course_announcements/exams/assignments/course_units para que
 * copilot-execute-tool tenga algo correcto a qué apuntar, pero AJUSTA estos
 * params si el frontend que los use termina necesitando otra cosa.
 *
 * Solo scope "DOCENCIA" tiene herramientas registradas: la UI de
 * crear-ia/page.tsx deja elegir INVESTIGACION/LABORATORIO/CAMPO también,
 * pero no encontré ninguna herramienta real para esos scopes en el
 * frontend — con la lista vacía, el orquestador responde "no tengo
 * herramientas para eso" en vez de fallar, así que no rompe nada dejarlo así
 * hasta que se definan esas herramientas.
 */

export interface CopilotToolParam {
  name: string
  type: "string" | "number" | "boolean" | "array" | "object"
  required: boolean
  description: string
}

export interface CopilotTool {
  name: string
  description: string
  category: string
  scopes: string[]
  params: CopilotToolParam[]
}

export const COPILOT_TOOLS: CopilotTool[] = [
  {
    name: "crear_aviso",
    description: "Publica un aviso en el tablón de la materia (course_announcements).",
    category: "comunicacion",
    scopes: ["DOCENCIA"],
    params: [
      { name: "titulo", type: "string", required: true, description: "Título del aviso." },
      { name: "contenido", type: "string", required: true, description: "Cuerpo del aviso, redactado de forma profesional." },
    ],
  },
  {
    name: "crear_material_boveda",
    description: "Crea un documento de texto en la Bóveda de material didáctico de una unidad.",
    category: "material",
    scopes: ["DOCENCIA"],
    params: [
      { name: "unit_id", type: "string", required: true, description: "Unidad a la que pertenece el material." },
      { name: "titulo", type: "string", required: true, description: "Título del documento." },
      { name: "contenido", type: "string", required: true, description: "Contenido completo en Markdown simple (#, ##, -)." },
    ],
  },
  {
    name: "crear_presentacion_slides",
    description: "Crea una presentación de diapositivas en la Bóveda de material didáctico de una unidad.",
    category: "material",
    scopes: ["DOCENCIA"],
    params: [
      { name: "unit_id", type: "string", required: true, description: "Unidad a la que pertenece la presentación." },
      { name: "titulo", type: "string", required: true, description: "Título de la presentación." },
      { name: "contenido_outline", type: "string", required: true, description: 'Outline en formato "Slide N: Título\\n- bullet\\n- bullet" por cada diapositiva.' },
    ],
  },
  {
    name: "crear_rubrica_sheet",
    description: "Crea una rúbrica de evaluación (hoja de criterios) para una unidad.",
    category: "material",
    scopes: ["DOCENCIA"],
    params: [
      { name: "unit_id", type: "string", required: true, description: "Unidad a la que pertenece la rúbrica." },
      { name: "titulo", type: "string", required: true, description: "Título de la rúbrica." },
      { name: "criterios", type: "array", required: true, description: "Array de {name, description, weight} — weight en % debe sumar 100 entre todos." },
    ],
  },
  {
    name: "crear_evaluacion",
    description: "Crea un examen (exams) para una unidad, con reactivos generados por IA sobre el tema indicado.",
    category: "evaluacion",
    scopes: ["DOCENCIA"],
    params: [
      { name: "unit_id", type: "string", required: true, description: "Unidad a la que pertenece el examen." },
      { name: "titulo", type: "string", required: true, description: "Título del examen." },
      { name: "tema", type: "string", required: true, description: "Tema/directiva para generar los reactivos (se pasa a generate-exam-ia)." },
      { name: "start_at", type: "string", required: false, description: "Fecha/hora de apertura, ISO 8601." },
      { name: "end_at", type: "string", required: false, description: "Fecha/hora de cierre, ISO 8601." },
    ],
  },
  {
    name: "crear_actividad",
    description: "Crea una actividad/entregable (assignments) para una unidad.",
    category: "actividad",
    scopes: ["DOCENCIA"],
    params: [
      { name: "unit_id", type: "string", required: true, description: "Unidad a la que pertenece la actividad." },
      { name: "titulo", type: "string", required: true, description: "Título de la actividad." },
      { name: "descripcion", type: "string", required: true, description: "Instrucciones para el alumno." },
      { name: "format", type: "string", required: true, description: "'individual' o 'equipo'." },
      { name: "submission_type", type: "string", required: true, description: "'file' | 'doc' | 'sheet' | 'slide'." },
      { name: "soft_deadline", type: "string", required: true, description: "Fecha límite de entrega, ISO 8601." },
    ],
  },
  {
    name: "cerrar_unidad",
    description: "Marca una unidad como cerrada (course_units.is_closed).",
    category: "gestion",
    scopes: ["DOCENCIA"],
    params: [
      { name: "unit_id", type: "string", required: true, description: "Unidad a cerrar." },
    ],
  },
  {
    name: "cerrar_entrega",
    description: "Cierra una actividad a nuevas entregas (equivalente a fijar su hard_deadline a ahora).",
    category: "gestion",
    scopes: ["DOCENCIA"],
    params: [
      { name: "assignment_id", type: "string", required: true, description: "Actividad a cerrar." },
    ],
  },
]

export function findTool(name: string): CopilotTool | undefined {
  return COPILOT_TOOLS.find((t) => t.name === name)
}

export function missingParams(tool: CopilotTool, params: Record<string, unknown>): string[] {
  return tool.params
    .filter((p) => p.required)
    .filter((p) => params[p.name] === undefined || params[p.name] === null || params[p.name] === "")
    .map((p) => p.name)
}
