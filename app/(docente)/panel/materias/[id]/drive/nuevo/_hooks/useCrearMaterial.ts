import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useMasterCopilotChat } from "@/components/ia/useMasterCopilotChat";
import {
  FileText, Presentation, FileSpreadsheet,
} from "lucide-react";

export const TYPES = [
  { tool: "crear_material_boveda", label: "Documento", icon: FileText, placeholder: "Gemini: 'Genera un documento sobre normalización de bases de datos'..." },
  { tool: "crear_presentacion_slides", label: "Presentación", icon: Presentation, placeholder: "Gemini: 'Genera una presentación sobre microservicios' o 'Agrega una diapositiva de...'" },
  { tool: "crear_rubrica_sheet", label: "Rúbrica", icon: FileSpreadsheet, placeholder: "Gemini: 'Genera una rúbrica para el reporte de laboratorio 3'..." },
];

export interface Slide { titulo: string; bullets: string[] }
export interface Criterio { name: string; description: string; weight: number }

export function parseSlidesOutline(outline: string): Slide[] {
  const blocks = (outline || "").split(/\n(?=\s*Slide\s+\d+\s*:)/i).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const titulo = (lines[0] ?? "").replace(/^Slide\s+\d+\s*:\s*/i, "").trim();
    const bullets = lines.slice(1).map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean);
    return { titulo, bullets };
  }).filter((s) => s.titulo);
}

export function buildSlidesOutline(slides: Slide[]): string {
  return slides.map((s, i) => `Slide ${i + 1}: ${s.titulo}\n${s.bullets.map((b) => `- ${b}`).join("\n")}`).join("\n\n");
}

export function useCrearMaterial() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [units, setUnits] = useState<{ id: string; unit_number: number; title: string }[]>([]);
  const [unitId, setUnitId] = useState("");
  const [tipo, setTipo] = useState(TYPES[0]);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { loading, errorMsg, send } =
    useMasterCopilotChat({ scope: "DOCENCIA", courseId, categories: ["material"], defaultUnitId: unitId });

  useEffect(() => {
    if (!courseId) return;
    supabase.from('course_units').select('id, unit_number, title').eq('course_id', courseId).order('unit_number', { ascending: true })
      .then(({ data }: { data: { id: string; unit_number: number; title: string }[] | null }) => { if (data) setUnits(data); });
  }, [courseId]);

  const handleGenerate = async () => {
    if (!prompt.trim() || !unitId) return;
    const currentPrompt = prompt;
    setPrompt("");
    const p = await send(currentPrompt, tipo.tool);
    // Cuando llega contenido de la IA, se aplica directo al estado editable —
    // aquí no hay un paso de "confirmar la propuesta": el Guardar final ES la
    // confirmación, igual que en Evaluaciones.
    if (!p) return;
    if (p.params.titulo) setTitulo(p.params.titulo as string);
    if (p.tool_name === "crear_material_boveda" && p.params.contenido) setContenido(p.params.contenido as string);
    if (p.tool_name === "crear_presentacion_slides" && p.params.contenido_outline) setSlides(parseSlidesOutline(p.params.contenido_outline as string));
    if (p.tool_name === "crear_rubrica_sheet" && Array.isArray(p.params.criterios)) setCriterios(p.params.criterios);
  };

  const totalWeight = criterios.reduce((acc, c) => acc + (parseFloat(String(c.weight)) || 0), 0);

  const canSave =
    !!titulo.trim() && !!unitId && !isSaving &&
    (tipo.tool === "crear_material_boveda" ? !!contenido.trim()
      : tipo.tool === "crear_presentacion_slides" ? slides.length > 0
      : criterios.length > 0 && totalWeight === 100);

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const toolParams: Record<string, unknown> =
        tipo.tool === "crear_material_boveda" ? { unit_id: unitId, titulo, contenido }
        : tipo.tool === "crear_presentacion_slides" ? { unit_id: unitId, titulo, contenido_outline: buildSlidesOutline(slides) }
        : { unit_id: unitId, titulo, criterios };

      const { data, error } = await supabase.functions.invoke('copilot-execute-tool', {
        body: { tool_name: tipo.tool, params: toolParams, course_id: courseId },
      });
      if (error || data?.success === false) throw new Error(data?.error || error?.message || "No se pudo crear el material.");

      alert("Material creado. Volviendo a Material Didáctico...");
      router.push(`/panel/materias/${courseId}/drive`);
    } catch (e) {
      console.error("[CrearMaterialPage] error al guardar:", e);
      alert(`Error al guardar: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    router,
    units, unitId, setUnitId,
    tipo, setTipo,
    titulo, setTitulo,
    contenido, setContenido,
    slides, setSlides,
    criterios, setCriterios,
    prompt, setPrompt,
    isSimulating, setIsSimulating,
    isSaving,
    loading, errorMsg,
    handleGenerate,
    totalWeight,
    canSave,
    handleSave,
  };
}
