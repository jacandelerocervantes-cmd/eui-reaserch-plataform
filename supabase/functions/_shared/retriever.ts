// deno-lint-ignore-file no-import-prefix
/**
 * Recuperador — consulta estructurada a Postgres, sin llamada a IA.
 *
 * Extrae el patrón que antes vivía inline en master-copilot-orchestrator
 * (unidades/actividades/exámenes de un curso) para que el rol "Recuperador"
 * del flujo Orquestador/Recuperador/Validador (docs/04_Multi_Agente_MCP.md
 * §2) exista como función propia y no como lógica repetida por endpoint.
 *
 * Deliberadamente sin LLM: es lookup determinístico filtrado por course_id,
 * no búsqueda semántica (ver docs/04_Multi_Agente_MCP.md §2.3 sobre por qué
 * un embedding/SLM aquí sería gasto sin beneficio hasta que exista el
 * contrato acervo-consulta@1.0).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

export interface CourseUnit { id: string; unit_number: number; title: string }
export interface CourseAssignment { id: string; title: string; unit_id: string }
export interface CourseExam { id: string; title: string; unit_id: string }

export interface CourseContext {
  units: CourseUnit[]
  assignments: CourseAssignment[]
  exams: CourseExam[]
}

/** Contexto real de un curso (unidades, actividades, exámenes) para resolver referencias en lenguaje natural a IDs reales. */
export async function fetchCourseContext(serviceClient: SupabaseClient, courseId: string): Promise<CourseContext> {
  const { data: units } = await serviceClient
    .from("course_units").select("id, unit_number, title").eq("course_id", courseId).order("unit_number")

  const unitIds = (units ?? []).map((u: CourseUnit) => u.id)

  const { data: assignments } = unitIds.length
    ? await serviceClient.from("assignments").select("id, title, unit_id").in("unit_id", unitIds)
    : { data: [] as CourseAssignment[] }

  const { data: exams } = unitIds.length
    ? await serviceClient.from("exams").select("id, title, unit_id").in("unit_id", unitIds)
    : { data: [] as CourseExam[] }

  return {
    units: (units ?? []) as CourseUnit[],
    assignments: (assignments ?? []) as CourseAssignment[],
    exams: (exams ?? []) as CourseExam[],
  }
}

/** Serializa el contexto al bloque de texto que el Orquestador interpola en su prompt. */
export function formatCourseContextBlock(ctx: CourseContext, defaultUnitId?: string): string {
  return `
UNIDADES DE LA MATERIA: ${JSON.stringify(ctx.units)}
ACTIVIDADES EXISTENTES: ${JSON.stringify(ctx.assignments)}
EXÁMENES EXISTENTES: ${JSON.stringify(ctx.exams)}
Usa estos IDs reales cuando el docente mencione una unidad/actividad/examen por nombre o número. NUNCA inventes un id — si no encuentras una coincidencia clara, pregunta para confirmar cuál.
${defaultUnitId ? `UNIDAD SELECCIONADA EN PANTALLA (úsala como unit_id por defecto si el docente no menciona otra): ${defaultUnitId}` : ""}`
}
