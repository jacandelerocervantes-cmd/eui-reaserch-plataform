// deno-lint-ignore-file no-import-prefix
import { buildCorsHeaders, errorResponse, verifyDocente } from "../_shared/auth.ts"
import { fetchGeminiWithRetry } from "../_shared/gemini.ts"
import { guardOutputOrBlock } from "../_shared/guardrail.ts"

function generateWordSearchGrid(words: { word: string; clue: string }[], size = 12) {
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(""));
  const placedWords: { word: string; clue: string; startRow: number; startCol: number; endRow: number; endCol: number; direction: string }[] = [];

  const directions = [
    { dr: 0, dc: 1, name: "horizontal" },
    { dr: 1, dc: 0, name: "vertical" },
    { dr: 1, dc: 1, name: "diagonal" },
  ];

  for (const item of words) {
    const word = item.word.toUpperCase().replace(/[^A-ZÑ]/g, "");
    if (!word || word.length > size) continue;

    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 100) {
      attempts++;
      const dir = directions[Math.floor(Math.random() * directions.length)];
      const maxRow = size - 1 - (dir.dr * (word.length - 1));
      const maxCol = size - 1 - (dir.dc * (word.length - 1));

      if (maxRow < 0 || maxCol < 0) continue;

      const r = Math.floor(Math.random() * (maxRow + 1));
      const c = Math.floor(Math.random() * (maxCol + 1));

      let canPlace = true;
      for (let i = 0; i < word.length; i++) {
        const nr = r + dir.dr * i;
        const nc = c + dir.dc * i;
        if (grid[nr][nc] !== "" && grid[nr][nc] !== word[i]) {
          canPlace = false;
          break;
        }
      }

      if (canPlace) {
        for (let i = 0; i < word.length; i++) {
          const nr = r + dir.dr * i;
          const nc = c + dir.dc * i;
          grid[nr][nc] = word[i];
        }
        placedWords.push({
          word,
          clue: item.clue,
          startRow: r,
          startCol: c,
          endRow: r + dir.dr * (word.length - 1),
          endCol: c + dir.dc * (word.length - 1),
          direction: dir.name,
        });
        placed = true;
      }
    }
  }

  const letters = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === "") {
        grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
      }
    }
  }

  return { grid, placedWords, size };
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders()
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const auth = await verifyDocente(req)
  if (!auth.ok) return errorResponse(auth.err, cors)
  const { userId, serviceClient } = auth.ctx

  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")
  if (!GEMINI_KEY) return new Response(
    JSON.stringify({ success: false, error: "GEMINI_API_KEY no configurado." }),
    { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
  )

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55_000)

  try {
    const contentType = req.headers.get("content-type") ?? ""
    let title = ""
    let description = ""
    let puzzleType = ""
    let filePart: { inlineData: { data: string; mimeType: string } } | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      title = String(formData.get("title") ?? "")
      description = String(formData.get("description") ?? "")
      puzzleType = String(formData.get("puzzleType") ?? "")
      const file = formData.get("archivo") as File | null

      if (file) {
        const arrayBuffer = await file.arrayBuffer()
        const base64Data  = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        const mimeType    = file.type || "application/pdf"
        filePart = { inlineData: { data: base64Data, mimeType } }
      }
    } else {
      const body = await req.json()
      title = body.title ?? ""
      description = body.description ?? ""
      puzzleType = body.puzzleType ?? body.type ?? ""
    }

    if (!title) return new Response(
      JSON.stringify({ success: false, error: "Se requiere 'title'." }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    )

    // ── 2. MODO PUZZLE: CRUCIGRAMA O SOPA DE LETRAS ─────────────────────────
    if (puzzleType === "crossword" || puzzleType === "puzzle_crossword") {
      const crosswordPrompt = `Eres un diseñador pedagógico universitario para educación superior en ingeniería.
Para el tema: "${title}" (Contexto: "${description}"), genera un Crucigrama Técnico conciso con 4 a 6 conceptos clave cruzados en una cuadrícula de máximo 12x12 casillas (índices 0 a 11).

Reglas estrictas:
- Las palabras deben estar en mayúsculas, sin espacios, sin acentos ni caracteres especiales.
- Las posiciones (row, col) deben ser enteros de 0 a 11.
- "direction" debe ser "across" o "down".
- Las intersecciones que se crucen deben compartir la misma letra en la celda común.
- Incluye el número del reactivo (number: 1, 2, 3...) y una pista técnica rigurosa (clue).

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "title": "Crucigrama: ${title}",
  "size": 12,
  "words": [
    {
      "number": 1,
      "word": "BACTERIA",
      "clue": "Organismo procarionte unicelular...",
      "row": 2,
      "col": 1,
      "direction": "across"
    }
  ]
}`

      const aiRes = await fetchGeminiWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          contents: [{ parts: [{ text: crosswordPrompt }] }],
          generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
        },
        controller.signal,
      )

      if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
      const aiJson = await aiRes.json()
      const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
      const parsed = JSON.parse(content ?? "{}")

      return new Response(
        JSON.stringify({
          success: true,
          puzzleType: "crossword",
          puzzleData: {
            title: parsed.title || `Crucigrama: ${title}`,
            size: Number(parsed.size) || 12,
            words: Array.isArray(parsed.words) ? parsed.words : [],
          }
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    if (puzzleType === "wordsearch" || puzzleType === "puzzle_wordsearch") {
      const wordSearchPrompt = `Eres un diseñador pedagógico universitario para educación superior en ingeniería.
Para el tema: "${title}" (Contexto: "${description}"), genera entre 5 y 7 palabras técnicas clave relevantes con sus pistas conceptuales para una Sopa de Letras académica.

Reglas:
- Cada palabra debe tener entre 4 y 10 letras, en español, sin acentos ni espacios.
- Cada pista debe ser una definición rigurosa y clara para que el alumno deduzca la palabra.
- Devuelve ÚNICAMENTE un JSON:
{
  "words": [
    { "word": "BACTERIA", "clue": "Microorganismo unicelular procarionte con pared de peptidoglicano." }
  ]
}`

      const aiRes = await fetchGeminiWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          contents: [{ parts: [{ text: wordSearchPrompt }] }],
          generationConfig: { response_mime_type: "application/json", temperature: 0.3 },
        },
        controller.signal,
      )

      if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
      const aiJson = await aiRes.json()
      const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
      const parsed = JSON.parse(content ?? "{}")
      const words = Array.isArray(parsed.words) ? parsed.words : []
      const wordSearchData = generateWordSearchGrid(words, 12)

      return new Response(
        JSON.stringify({
          success: true,
          puzzleType: "wordsearch",
          puzzleData: {
            title: `Sopa de Letras: ${title}`,
            ...wordSearchData
          }
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      )
    }

    // ── 3. MODO NORMAL: GENERACIÓN DE RÚBRICA POR COMPETENCIAS ────────────────
    const promptText =
      `Eres especialista en diseño instruccional por competencias del Tecnológico Nacional de México (TecNM).
      Diseña una rúbrica analítica para evaluar la siguiente actividad de nivel ingeniería.

      ACTIVIDAD: ${title}
      DESCRIPCIÓN: ${description || "Sin instrucciones adicionales. Infiere criterios apropiados del título."}
      ${filePart ? "\nADJUNTO: el docente adjuntó el documento original de la actividad (instrucciones, puntajes y/o rúbrica previa, si tenía). Léelo completo y usa su contenido real como base — si ya trae una distribución de puntos, respétala lo más posible en vez de inventar una nueva." : ""}

      REQUISITOS ESTRICTOS:
      - Entre 3 y 5 criterios únicos. Cada criterio mide una competencia distinta; no repitas conceptos.
      - Ejemplos de dimensiones válidas: fundamentación teórica, aplicación metodológica, análisis crítico, claridad expositiva, uso de fuentes.
      - Los pesos deben sumar EXACTAMENTE 100. Si son 4 criterios no pongas todos en 25; distribuye según importancia pedagógica.
      - "description" de cada criterio: describe los indicadores de desempeño observables (qué hace el alumno para obtener el puntaje máximo). Mínimo 15 palabras.
      - Nombres de criterio: sustantivos profesionales concretos (ej: "Fundamentación Teórica", no "Teoría").
      - No incluyas criterios de formato o presentación a menos que la actividad lo requiera explícitamente.

      JSON puro sin markdown, array de criterios:
      [{"id":1,"name":"Nombre del Criterio","description":"Indicadores de desempeño observables y medibles para este criterio.","weight":35}]`

    const parts: unknown[] = filePart ? [filePart, { text: promptText }] : [{ text: promptText }]

    const aiRes = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
      },
      controller.signal,
    )

    if (!aiRes.ok) throw new Error(`Gemini respondió ${aiRes.status}`)
    const aiJson = await aiRes.json()
    const content = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) throw new Error("Gemini devolvió respuesta vacía.")

    const rubrics = JSON.parse(content)

    const guard = await guardOutputOrBlock(JSON.stringify(rubrics), {
      serviceClient, teacherId: userId, toolName: "generate_rubric_ia", cors,
      errorBody: { success: false, error: "La rúbrica no pudo mostrarse por una regla de seguridad interna." },
    })
    if (guard.blocked) return guard.response

    return new Response(
      JSON.stringify({ success: true, rubrics }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError"
    const msg = isTimeout ? "Timeout generando contenido con IA." : err instanceof Error ? err.message : "Error interno."
    console.error("[GENERATE_RUBRIC_IA]", msg)
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
    )
  } finally {
    clearTimeout(timeout)
  }
})
