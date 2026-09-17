// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts";
import { fetchGeminiWithRetry } from "../_shared/gemini.ts";
import { checkRateLimit } from "../_shared/cache.ts";
import { applyInputGuardrail, applyOutputGuardrail } from "../_shared/guardrail.ts";
import { extractDocumentText } from "../_shared/documentTextExtractor.ts";

const RATE_LIMIT_MAX_CALLS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

serve(async (req: Request) => {
  const cors = buildCorsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── 1. Autenticación ─────────────────────────────────────────────────────
  const auth = await verifyDocente(req);
  if (!auth.ok) return errorResponse(auth.err, cors);
  const { userId } = auth.ctx;

  // ── 1.b Rate limit por docente ──────────────────────────────────────────
  const rateLimit = await checkRateLimit(`ratelimit:extract-exam-questions-ia:${userId}`, RATE_LIMIT_MAX_CALLS, RATE_LIMIT_WINDOW_SECONDS);
  if (!rateLimit.allowed) return new Response(
    JSON.stringify({ success: false, error: `Límite de ${RATE_LIMIT_MAX_CALLS} llamadas/min alcanzado. Intenta de nuevo en unos segundos.` }),
    { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(RATE_LIMIT_WINDOW_SECONDS) } }
  );

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const formData = await req.formData();
    const file = formData.get("archivo") as File;
    if (!file) throw new Error("No se recibió ningún archivo.");

    const arrayBuffer = await file.arrayBuffer();
    const fileName     = file.name?.toLowerCase() ?? "";
    const mimeType     = file.type?.toLowerCase() ?? "";

    // Mismo vocabulario que generate-exam-ia: el enum real de la base es en inglés.
    const PROMPT = `Eres Diseñador Curricular del TecNM. Extrae TODOS los reactivos de examen que encuentres en este documento — no inventes preguntas que no estén en el archivo.

REGLAS DE EXTRACCIÓN:
1. Extrae únicamente lo que veas en el documento. Si una pregunta no tiene respuesta marcada, infiere la más razonable según el contenido.
2. El campo "type" debe ser EXACTAMENTE uno de estos 8 valores en inglés (enum real de la base de datos):
   - "multiple_choice": una sola correcta. "options" (array de 4) y "answer" (debe coincidir textualmente con una de "options").
   - "true_false": "answer" debe ser exactamente "Verdadero" o "Falso".
   - "open": preguntas de desarrollo/ensayo. "answer" es una guía breve de evaluación (conceptos clave esperados).
   - "matching": relacionar columnas. Usa "left" (conceptos) y "right" (definiciones, EN EL MISMO ORDEN que su pareja correcta), y "correct" (array de índices: correct[i] = índice en "right" que corresponde a left[i]).
   - "short_answer": respuesta corta exacta (ej. una fecha, una fórmula, un nombre). "options" = array con la(s) respuesta(s) aceptada(s) (si hay variantes válidas, incluye todas).
   - "fill_blank": el enunciado en "content" debe traer cada hueco marcado como "___". "options" = array con la respuesta correcta de cada hueco, EN EL MISMO ORDEN en que aparecen en "content".
   - "ordering": el alumno debe ordenar pasos/elementos. "options" = array con los elementos EN SU ORDEN CORRECTO (no en el orden desordenado que traiga el documento).
   - "multi_select": opción múltiple con VARIAS correctas. "options" = todas las opciones, "correct" = array con las opciones que son correctas (subconjunto de "options").
3. "points": si el documento indica valor por reactivo, úsalo; si no, usa 10 por defecto.
4. Si el documento no es un examen ni contiene reactivos identificables, devuelve un array vacío en "questions".

JSON puro sin markdown. Ejemplos de cada tipo:
{"questions":[
  {"type":"multiple_choice","content":"...","options":["A","B","C","D"],"answer":"A","points":10,"bloom":null},
  {"type":"short_answer","content":"¿En qué año...?","options":["1929","mil novecientos veintinueve"],"points":10},
  {"type":"fill_blank","content":"El protocolo ___ es orientado a conexión, mientras que ___ no lo es.","options":["TCP","UDP"],"points":10},
  {"type":"ordering","content":"Ordena las fases del proceso.","options":["Análisis","Diseño","Implementación","Pruebas"],"points":10},
  {"type":"multi_select","content":"¿Cuáles son protocolos de capa de transporte?","options":["TCP","UDP","IP","HTTP"],"correct":["TCP","UDP"],"points":10}
]}`;

    const extraction = await extractDocumentText(file);
    if (!extraction.success) {
      return new Response(
        JSON.stringify({ success: false, error: extraction.error || "No se pudo leer el archivo adjunto." }),
        { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    let parts: unknown[];
    if (extraction.text) {
      const guard = applyInputGuardrail(extraction.text, false);
      if (guard.block) {
        return new Response(
          JSON.stringify({ success: false, error: "Contenido del archivo bloqueado por sospecha de inyección de prompt." }),
          { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      parts = [{ text: PROMPT + "\n\nCONTENIDO DEL DOCUMENTO:\n" + guard.safeText }];
    } else if (extraction.isVisionFallback && extraction.inlineData) {
      parts = [
        { text: PROMPT },
        { inlineData: extraction.inlineData },
      ];
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "No se pudo extraer contenido del archivo." }),
        { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.1 },
      },
      controller.signal,
    );

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`);
    const aiJson  = await aiRes.json();
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content)  throw new Error("Gemini devolvió respuesta vacía.");

    const outputGuard = applyOutputGuardrail(content);
    if (!outputGuard.allow) {
      return new Response(
        JSON.stringify({ success: false, error: "Respuesta bloqueada por políticas de seguridad (guardrail de salida)." }),
        { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { questions } = JSON.parse(content) as { questions: unknown[] };

    return new Response(
      JSON.stringify({ success: true, questions: questions ?? [] }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const msg = isTimeout
      ? "Timeout (30s) al procesar el archivo."
      : err instanceof Error ? err.message : "Error interno.";
    console.error("[EXTRACT_EXAM_QUESTIONS_IA]", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: isTimeout ? 504 : 502, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } finally {
    clearTimeout(timeout);
  }
});
