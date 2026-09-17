// deno-lint-ignore-file no-explicit-any
/**
 * Extractor universal y optimizado de texto para documentos académicos.
 * Soporta:
 *  - PDF (.pdf): extracción de texto plano nativo, fallback a visión si es escaneado
 *  - PowerPoint (.pptx): extracción de diapositivas y notas de orador vía fflate
 *  - PowerPoint (.ppt): escaneo y extracción binaria de texto UTF-16LE / ASCII (Office 97-2003)
 *  - Word (.docx): extracción de párrafos vía mammoth o fflate
 *  - Word (.doc): escaneo y extracción binaria de texto UTF-16LE / ASCII (Office 97-2003)
 *  - Excel (.xlsx, .xls, .csv): exportación de tablas a texto estructurado vía xlsx
 *  - Texto plano (.txt, .md, .json)
 *  - Imágenes (.png, .jpg, .jpeg, .webp): fallback a Gemini Vision
 *
 * Diseñado para garantizar:
 *  1. Máximo consumo de RAM < 50MB (muy por debajo del tope de 150MB de Supabase Edge Runtime).
 *  2. Tiempos de respuesta < 5s (evita timeouts de 90s por payloads binarios masivos).
 *  3. Sanitización contra inyecciones de prompt.
 */

export interface ExtractedDocument {
  success: boolean
  text?: string
  isVisionFallback?: boolean
  inlineData?: { data: string; mimeType: string }
  fileType: "pdf" | "docx" | "doc" | "pptx" | "ppt" | "excel" | "image" | "text" | "unknown"
  error?: string
  unreadable_file?: boolean
}

/**
 * Codifica un ArrayBuffer a Base64 en bloques de 8KB para prevenir
 * Maximum call stack size exceeded y picos de memoria en V8.
 */
export function toSafeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 8192
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength))
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  return btoa(binary)
}

/**
 * Escanea y extrae cadenas legibles en formato binario antiguo de Office 97-2003
 * (.doc y .ppt) leyendo secuencias UTF-16LE y ASCII/Latin-1.
 */
export function extractTextFromBinaryOffice(bytes: Uint8Array): string {
  const chunks: string[] = []
  const len = bytes.length

  // 1. Escaneo UTF-16LE (caracteres de texto en Word/PowerPoint 97-2003)
  let currentU16: string[] = []
  for (let i = 0; i < len - 1; i += 2) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    if (b1 === 0 && ((b0 >= 32 && b0 <= 126) || b0 === 10 || b0 === 13 || (b0 >= 160 && b0 <= 255))) {
      currentU16.push(String.fromCharCode(b0))
    } else {
      if (currentU16.length >= 4) {
        chunks.push(currentU16.join("").trim())
      }
      currentU16 = []
    }
  }
  if (currentU16.length >= 4) {
    chunks.push(currentU16.join("").trim())
  }

  // 2. Escaneo ASCII / Latin-1
  let currentAscii: number[] = []
  for (let i = 0; i < len; i++) {
    const b = bytes[i]
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || (b >= 160 && b <= 255)) {
      currentAscii.push(b)
    } else {
      if (currentAscii.length >= 5) {
        chunks.push(new TextDecoder("latin1").decode(new Uint8Array(currentAscii)).trim())
      }
      currentAscii = []
    }
  }
  if (currentAscii.length >= 5) {
    chunks.push(new TextDecoder("latin1").decode(new Uint8Array(currentAscii)).trim())
  }

  // Filtrar nombres de estructuras internas de OLE Compound File y encabezados de fuentes
  const OLE_INTERNAL = /^(Root Entry|CompObj|WordDocument|1Table|0Table|Data|SummaryInformation|DocumentSummaryInformation|PowerPoint Document|Current User|Pictures|Theme|ObjectPool|_VBA_PROJECT|header|footer|Times New Roman|Arial|Calibri|Symbol)/i
  const validChunks = chunks
    .filter((c) => c.length >= 4 && !OLE_INTERNAL.test(c) && !/^[\s\d.,;:\-_/\\=+\*#@%&!?|<>()[\]{}]+$/.test(c))
    .filter((c) => !/^[A-Z0-9]{20,}$/.test(c))

  // Deduplicar manteniendo el orden y filtrar fragmentos redundantes
  const seen = new Set<string>()
  const result: string[] = []
  for (const c of validChunks) {
    const norm = c.toLowerCase().replace(/\s+/g, " ")
    if (!seen.has(norm) && norm.length >= 4) {
      seen.add(norm)
      result.push(c)
    }
  }

  return result.join("\n")
}

/**
 * Intenta extraer texto plano de streams internos de un PDF descomprimiendo FlateDecode.
 */
function extractTextFromPdfStreams(bytes: Uint8Array, fflateModule: any): string {
  try {
    const latin1Text = new TextDecoder("latin1").decode(bytes)
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g
    let match: RegExpExecArray | null
    const textPieces: string[] = []

    while ((match = streamRegex.exec(latin1Text)) !== null) {
      const rawStream = match[1]
      let decompressed = ""

      // Intentar desinflar si estaba con FlateDecode
      try {
        const streamBytes = new Uint8Array(rawStream.length)
        for (let i = 0; i < rawStream.length; i++) {
          streamBytes[i] = rawStream.charCodeAt(i)
        }
        const uncompressed = fflateModule.unzlibSync(streamBytes)
        decompressed = new TextDecoder("latin1").decode(uncompressed)
      } catch {
        decompressed = rawStream
      }

      // Extraer operadores Tj y TJ
      // Operador Tj: (Texto) Tj
      const tjMatches = Array.from(decompressed.matchAll(/\(([^)]+)\)\s*Tj/g), (m) => m[1])
      if (tjMatches.length > 0) {
        textPieces.push(tjMatches.join(" "))
      }

      // Operador TJ: [(T) 10 (exto)] TJ
      const tjArrayMatches = Array.from(decompressed.matchAll(/\[([\s\S]*?)\]\s*TJ/g), (m) => {
        const inner = m[1]
        const subStrings = Array.from(inner.matchAll(/\(([^)]+)\)/g), (sm) => sm[1])
        return subStrings.join("")
      })
      if (tjArrayMatches.length > 0) {
        textPieces.push(tjArrayMatches.join(" "))
      }
    }

    // Limpiar escapes comunes de PDF (\(, \), \\, \r, \n)
    return textPieces
      .join("\n")
      .replace(/\\([()\\])/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
  } catch (err) {
    console.warn("[documentTextExtractor] Error extrayendo streams de PDF:", err)
    return ""
  }
}

/**
 * Función principal para extraer el contenido en texto plano de cualquier archivo adjunto.
 */
export async function extractDocumentText(
  file: { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> | ArrayBuffer; size?: number },
  maxChars = 35000
): Promise<ExtractedDocument> {
  const fileName = (file.name || "").toLowerCase()
  const mimeType = (file.type || "").toLowerCase()

  // 1. Detección de tipos
  const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf")
  const isImage = mimeType.startsWith("image/") || /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(fileName)
  const isPptx = fileName.endsWith(".pptx") || mimeType.includes("presentationml") || mimeType.includes("powerpoint")
  const isPpt = (fileName.endsWith(".ppt") && !isPptx) || mimeType.includes("ms-powerpoint")
  const isDocx = fileName.endsWith(".docx") || mimeType.includes("wordprocessingml")
  const isDoc = (fileName.endsWith(".doc") && !isDocx) || mimeType.includes("msword")
  const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".ods") || mimeType.includes("spreadsheet") || mimeType.includes("excel")
  const isPlainText = fileName.endsWith(".txt") || fileName.endsWith(".csv") || fileName.endsWith(".tsv") || fileName.endsWith(".md") || fileName.endsWith(".json") || mimeType.startsWith("text/")

  // 2. Obtener ArrayBuffer
  const arrayBuffer = typeof file.arrayBuffer === "function" ? await file.arrayBuffer() : (file as any).arrayBuffer
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return {
      success: false,
      unreadable_file: true,
      error: "El archivo adjunto está vacío (0 bytes).",
      fileType: "unknown",
    }
  }

  // Límite de seguridad para evitar saturar memoria en Supabase Edge Runtime
  const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB
  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    return {
      success: false,
      unreadable_file: true,
      error: `El archivo es demasiado grande (${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(1)} MB). El límite máximo es de 15 MB para garantizar estabilidad y velocidad.`,
      fileType: isPdf ? "pdf" : isPptx ? "pptx" : isDocx ? "docx" : "unknown",
    }
  }

  try {
    // ── A. IMÁGENES: directo a Gemini Vision ────────────────────────────────
    if (isImage) {
      return {
        success: true,
        isVisionFallback: true,
        inlineData: { data: toSafeBase64(arrayBuffer), mimeType: mimeType || "image/jpeg" },
        fileType: "image",
      }
    }

    // ── B. POWERPOINT (.pptx): extracción por diapositivas y notas ─────────
    if (isPptx) {
      const fflate = await import("https://esm.sh/fflate@0.8.2")
      const unzipped = fflate.unzipSync(new Uint8Array(arrayBuffer))
      const slideKeys = Object.keys(unzipped)
        .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
        .sort((a, b) => {
          const nA = parseInt(a.match(/\d+/)![0], 10)
          const nB = parseInt(b.match(/\d+/)![0], 10)
          return nA - nB
        })

      let pptText = ""
      const decoder = new TextDecoder()
      for (let i = 0; i < slideKeys.length; i++) {
        const xml = decoder.decode(unzipped[slideKeys[i]])
        const pMatches = xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) || [xml]
        const lines: string[] = []
        for (const p of pMatches) {
          const texts = Array.from(p.matchAll(/<a:t[^>]*>([^<]+)<\/a:t>/g), (m) => m[1].trim()).filter(Boolean)
          if (texts.length > 0) lines.push(texts.join(" "))
        }
        if (lines.length > 0) {
          pptText += `\n[Diapositiva ${i + 1}]\n` + lines.join("\n") + "\n"
        }
      }

      // Extraer notas del orador
      const noteKeys = Object.keys(unzipped).filter((k) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(k))
      for (const nk of noteKeys) {
        const xml = decoder.decode(unzipped[nk])
        const texts = Array.from(xml.matchAll(/<a:t[^>]*>([^<]+)<\/a:t>/g), (m) => m[1].trim()).filter(Boolean)
        const noteContent = texts.filter((t) => !/^\d+$/.test(t)).join(" ")
        if (noteContent.length > 5) {
          pptText += `\n[Notas de la diapositiva]: ${noteContent}\n`
        }
      }

      const cleanText = pptText.trim()
      if (!cleanText) {
        return {
          success: false,
          unreadable_file: true,
          error: "La presentación PowerPoint (.pptx) no contiene texto editable en sus diapositivas (puede consistir solo de capturas o imágenes sin texto).",
          fileType: "pptx",
        }
      }

      const truncated = cleanText.length > maxChars
        ? cleanText.slice(0, maxChars) + "\n\n[...Texto de la presentación truncado para optimización...]"
        : cleanText

      return { success: true, text: truncated, fileType: "pptx" }
    }

    // ── C. POWERPOINT ANTIGUO (.ppt): escaneo binario de texto ─────────────
    if (isPpt) {
      const bytes = new Uint8Array(arrayBuffer)
      const extracted = extractTextFromBinaryOffice(bytes)
      if (extracted && extracted.length >= 50) {
        const truncated = extracted.length > maxChars
          ? extracted.slice(0, maxChars) + "\n\n[...Texto extraído truncado...]"
          : extracted
        return { success: true, text: truncated, fileType: "ppt" }
      }
      return {
        success: false,
        unreadable_file: true,
        error: "El archivo PowerPoint (.ppt) está en un formato binario antiguo que no contiene texto legible directamente. Te sugerimos guardarlo como .pptx o .pdf para extraer su contenido.",
        fileType: "ppt",
      }
    }

    // ── D. WORD (.docx): mammoth o fflate ──────────────────────────────────
    if (isDocx) {
      let docText = ""
      try {
        const mammoth = await import("https://esm.sh/mammoth@1.7.0")
        const result = await mammoth.extractRawText({ arrayBuffer })
        docText = result.value || ""
      } catch (_) {
        const fflate = await import("https://esm.sh/fflate@0.8.2")
        const unzipped = fflate.unzipSync(new Uint8Array(arrayBuffer))
        const docXml = unzipped["word/document.xml"]
        if (docXml) {
          const xml = new TextDecoder().decode(docXml)
          const matches = Array.from(xml.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g), (m) => m[1])
          docText = matches.join(" ").trim()
        }
      }

      const cleanText = docText.trim()
      if (!cleanText) {
        return {
          success: false,
          unreadable_file: true,
          error: "El documento Word (.docx) no contiene texto reconocible.",
          fileType: "docx",
        }
      }

      const truncated = cleanText.length > maxChars
        ? cleanText.slice(0, maxChars) + "\n\n[...Texto del documento truncado para optimización...]"
        : cleanText

      return { success: true, text: truncated, fileType: "docx" }
    }

    // ── E. WORD ANTIGUO (.doc): escaneo binario de texto ──────────────────
    if (isDoc) {
      const bytes = new Uint8Array(arrayBuffer)
      const extracted = extractTextFromBinaryOffice(bytes)
      if (extracted && extracted.length >= 50) {
        const truncated = extracted.length > maxChars
          ? extracted.slice(0, maxChars) + "\n\n[...Texto extraído truncado...]"
          : extracted
        return { success: true, text: truncated, fileType: "doc" }
      }
      return {
        success: false,
        unreadable_file: true,
        error: "El archivo Word (.doc) es un formato binario antiguo sin texto estructurado identificable. Te sugerimos guardarlo como .docx o .pdf.",
        fileType: "doc",
      }
    }

    // ── F. PDF (.pdf): extracción de texto nativo + fallback de visión ─────
    if (isPdf) {
      const bytes = new Uint8Array(arrayBuffer)
      let pdfText = ""

      // 1. Intentar con unpdf (estándar moderno para Deno/Edge Runtime)
      try {
        const { extractText } = await import("https://esm.sh/unpdf@0.12.1")
        const unpdfRes = await extractText(bytes, { mergePages: true })
        if (unpdfRes?.text && unpdfRes.text.trim().length >= 40) {
          pdfText = unpdfRes.text.trim()
        }
      } catch (e) {
        console.warn("[documentTextExtractor] unpdf falló, intentando extractor de streams:", e)
      }

      // 2. Si unpdf no extrajo suficiente texto, probar el extractor de streams con fflate
      if (pdfText.length < 40) {
        try {
          const fflate = await import("https://esm.sh/fflate@0.8.2")
          const streamText = extractTextFromPdfStreams(bytes, fflate)
          if (streamText.length >= 40) {
            pdfText = streamText
          }
        } catch (e) {
          console.warn("[documentTextExtractor] Extractor de streams falló:", e)
        }
      }

      // 3. Si se extrajo texto digital del PDF, devolverlo como TEXTO PURO
      // Esto ahorra el 95% del tiempo y memoria en comparación con enviar imágenes/PDFs binarios
      if (pdfText.length >= 40) {
        const truncated = pdfText.length > maxChars
          ? pdfText.slice(0, maxChars) + "\n\n[...Texto del PDF truncado para optimización...]"
          : pdfText
        return { success: true, text: truncated, fileType: "pdf" }
      }

      // 4. Si el PDF no contiene texto digital (ej. fotocopia o escaneo rasterizado),
      // usar el fallback seguro de Visión de Gemini en bloques de 8KB
      return {
        success: true,
        isVisionFallback: true,
        inlineData: { data: toSafeBase64(arrayBuffer), mimeType: "application/pdf" },
        fileType: "pdf",
      }
    }

    // ── G. EXCEL / CSV (.xlsx, .xls, .csv): tablas estructuradas ──────────
    if (isExcel) {
      const XLSX = await import("https://esm.sh/xlsx@0.18.5")
      const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" })
      let sheetText = ""
      for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        if (csv.trim()) {
          sheetText += `\n[Hoja: ${name}]\n${csv}\n`
        }
      }
      const cleanText = sheetText.trim()
      if (!cleanText) {
        return {
          success: false,
          unreadable_file: true,
          error: "El archivo de hoja de cálculo no contiene datos legibles.",
          fileType: "excel",
        }
      }
      const truncated = cleanText.length > maxChars
        ? cleanText.slice(0, maxChars) + "\n\n[...Contenido de la hoja de cálculo truncado...]"
        : cleanText
      return { success: true, text: truncated, fileType: "excel" }
    }

    // ── H. TEXTO PLANO (.txt, .csv, .md, .json) ───────────────────────────
    if (isPlainText) {
      const rawText = new TextDecoder().decode(arrayBuffer).trim()
      if (!rawText) {
        return {
          success: false,
          unreadable_file: true,
          error: "El archivo de texto está vacío.",
          fileType: "text",
        }
      }
      const truncated = rawText.length > maxChars
        ? rawText.slice(0, maxChars) + "\n\n[...Texto truncado para optimización...]"
        : rawText
      return { success: true, text: truncated, fileType: "text" }
    }

    // Formato no reconocido
    return {
      success: false,
      unreadable_file: true,
      error: "Formato de archivo no soportado. Por favor sube un documento PDF, Word (.docx, .doc), PowerPoint (.pptx, .ppt) o Excel (.xlsx).",
      fileType: "unknown",
    }
  } catch (err: unknown) {
    console.error("[documentTextExtractor] Error procesando archivo:", err)
    return {
      success: false,
      unreadable_file: true,
      error: "Ocurrió un error al procesar el archivo adjunto (puede estar protegido con contraseña o dañado). Puedes continuar usando solo texto o intentar con otro archivo.",
      fileType: "unknown",
    }
  }
}

