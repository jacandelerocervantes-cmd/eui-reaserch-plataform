// Watermark invisible (Unicode de ancho cero) para detectar copy-paste crudo
// de IA en texto plano — port a TypeScript de
// D-watermark-integridad-academica/watermark_codec.py (CORRE 9). Mismo
// algoritmo bit por bit, mismos nombres de función, para que quien lea ambos
// lados pueda comparar 1:1.
//
// Por qué un port y no invocar Python: la Edge Function que lo usa
// (create-assignment-hub) corre en Deno Deploy (runtime de Supabase Edge
// Functions), que no tiene un intérprete Python disponible — no hay forma de
// invocar el módulo Python original desde ahí. El algoritmo es compacto
// (bit-packing + 3 caracteres de ancho cero) y no tiene dependencias, así
// que portarlo es más simple y más confiable en producción que intentar
// levantar un subproceso Python que Deno Deploy no puede ejecutar de todas
// formas.
//
// ADVERTENCIA (la misma que en el módulo Python): esto es una HEURÍSTICA de
// detección, NO una prueba forense infalible. Se rompe si el texto pasa por
// un normalizador de Unicode, un "quitar formato" al pegar, se reescribe con
// otras palabras, o el editor colapsa caracteres de ancho cero. Ver
// D-watermark-integridad-academica/GUIA_USO_DOCENTE.md.
//
// DISEÑO (idéntico al original):
//   ZWSP U+200B -> bit 0
//   ZWJ  U+200D -> bit 1
//   ZWNJ U+200C -> delimitador de inicio/fin de "frame"
//
//   FRAME = ZWNJ | LEN (8 bits) | ID_BYTES (LEN*8 bits, UTF-8 de `identifier`)
//           | CHECKSUM (8 bits) | ZWNJ
//   CHECKSUM = (suma_de_bytes(ID_BYTES) + LEN) mod 256
//
// El frame se repite `redundancy` veces, dispersas en huecos entre palabras
// espaciados lo más parejo posible a lo largo de todo el texto.
//
// MATEMÁTICA DE CAPACIDAD: num_palabras >= 1 + redundancy * (16 + 8*L),
// donde L = bytes UTF-8 del identificador. Ver capacityReport() abajo —
// misma fórmula que capacity_report() en el módulo Python, ya validada ahí.

export const ZWSP = "​" // bit 0
export const ZWJ = "‍" // bit 1
export const ZWNJ = "‌" // delimitador de frame

export const ZW_CHARS = [ZWSP, ZWJ, ZWNJ] as const

export const DEFAULT_REDUNDANCY = 6

// Equivalente a `TextoDemasiadoCortoError(ValueError)` del módulo Python.
export class TextoDemasiadoCortoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TextoDemasiadoCortoError"
  }
}

export interface CapacityReport {
  identifier: string
  identifier_bytes: number
  frame_bits: number
  redundancy: number
  total_bits_needed: number
  min_words_required: number
}

export interface DecodeResult {
  identifier: string | null
  has_watermark: boolean
  symbols_matched: number
  symbols_expected: number
  expected_frames: number
  density_percent: number
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function frameBits(identifier: string): number {
  const length = utf8Bytes(identifier).length
  if (length > 255) {
    throw new Error("El identificador no puede superar 255 bytes UTF-8.")
  }
  return 16 + 8 * length
}

export function capacityReport(identifier: string, redundancy: number = DEFAULT_REDUNDANCY): CapacityReport {
  const fb = frameBits(identifier)
  const totalBits = fb * redundancy
  const minWords = 1 + totalBits
  return {
    identifier,
    identifier_bytes: utf8Bytes(identifier).length,
    frame_bits: fb,
    redundancy,
    total_bits_needed: totalBits,
    min_words_required: minWords,
  }
}

function toBinary(n: number, width: number): string {
  return n.toString(2).padStart(width, "0")
}

function buildFrameSymbols(identifier: string): string[] {
  const idBytes = utf8Bytes(identifier)
  const length = idBytes.length
  let sum = 0
  for (const b of idBytes) sum += b
  const checksum = (sum + length) % 256

  let bits = toBinary(length, 8)
  for (const b of idBytes) bits += toBinary(b, 8)
  bits += toBinary(checksum, 8)

  const symbols: string[] = [ZWNJ]
  for (const bit of bits) symbols.push(bit === "1" ? ZWJ : ZWSP)
  symbols.push(ZWNJ)
  return symbols
}

// k índices distintos en [0, n) espaciados lo más parejo posible — mismo
// patrón que `_evenly_spaced_indices` en Python (dedup vía Set, luego sort).
function evenlySpacedIndices(n: number, k: number): number[] {
  if (k > n) throw new Error("k no puede ser mayor que n")
  if (k === 0) return []
  if (k >= n) return Array.from({ length: n }, (_, i) => i)
  const set = new Set<number>()
  for (let i = 0; i < k; i++) set.add(Math.floor((i * n) / k))
  return Array.from(set).sort((a, b) => a - b)
}

/**
 * Inserta `redundancy` copias del watermark de `identifier`, dispersas en
 * huecos entre palabras distintos a lo largo de todo `text`.
 *
 * Preserva las palabras de `text` tal cual (split/join por espacio simple);
 * espacios múltiples o saltos de línea dentro del texto original se
 * normalizan a un solo espacio entre palabras — misma limitación conocida
 * que el original (ver GUIA_USO_DOCENTE.md).
 *
 * Lanza TextoDemasiadoCortoError si el texto no tiene huecos suficientes.
 */
export function encode(text: string, identifier: string, redundancy: number = DEFAULT_REDUNDANCY): string {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  if (words.length < 2) {
    throw new TextoDemasiadoCortoError("El texto necesita al menos 2 palabras.")
  }

  const frame = buildFrameSymbols(identifier)
  const allSymbols: string[] = []
  for (let i = 0; i < redundancy; i++) allSymbols.push(...frame)

  const gaps = words.length - 1
  if (gaps < allSymbols.length) {
    const needed = capacityReport(identifier, redundancy)
    throw new TextoDemasiadoCortoError(
      `Texto demasiado corto para embeber el watermark: tiene ${words.length} ` +
        `palabras (${gaps} huecos) pero se necesitan al menos ` +
        `${needed.min_words_required} palabras para ${redundancy} copias ` +
        `del identificador "${identifier}" (${needed.total_bits_needed} bits).`
    )
  }

  const positions = evenlySpacedIndices(gaps, allSymbols.length)
  const symbolAtGap = new Map<number, string>()
  positions.forEach((pos, i) => symbolAtGap.set(pos, allSymbols[i]))

  const out: string[] = [words[0]]
  for (let i = 1; i < words.length; i++) {
    const gapIndex = i - 1
    const symbol = symbolAtGap.get(gapIndex)
    out.push(symbol ? " " + symbol + words[i] : " " + words[i])
  }
  return out.join("")
}

export function extractSymbols(text: string): string[] {
  const zwSet = new Set<string>(ZW_CHARS)
  const out: string[] = []
  for (const c of text) if (zwSet.has(c)) out.push(c)
  return out
}

function splitFrames(symbols: string[]): string[][] {
  const frames: string[][] = []
  let current: string[] | null = null
  for (const s of symbols) {
    if (s === ZWNJ) {
      if (current === null) {
        current = []
      } else {
        frames.push(current)
        current = null
      }
    } else if (current !== null) {
      current.push(s)
    }
    // símbolo fuera de un delimitador ZWNJ: descartado (frame corrupto)
  }
  return frames
}

function decodeFrame(bitSymbols: string[]): string | null {
  const bits = bitSymbols.map((s) => (s === ZWJ ? "1" : "0")).join("")
  if (bits.length < 16) return null
  const length = parseInt(bits.slice(0, 8), 2)
  const needed = 16 + 8 * length
  if (bits.length < needed) return null
  const idBits = bits.slice(8, 8 + 8 * length)
  const checksumBits = bits.slice(8 + 8 * length, needed)
  const idBytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) idBytes[i] = parseInt(idBits.slice(i * 8, i * 8 + 8), 2)
  const checksum = parseInt(checksumBits, 2)
  let sum = 0
  for (const b of idBytes) sum += b
  const expectedChecksum = (sum + length) % 256
  if (checksum !== expectedChecksum) return null
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(idBytes)
  } catch {
    return null
  }
}

/**
 * Modo de descubrimiento ciego: busca CUALQUIER frame con checksum válido,
 * sin saber de antemano qué identificador esperar. Todo-o-nada por frame —
 * por eso no se usa para medir densidad, solo para listar identificadores
 * presentes.
 */
export function scanForAnyWatermark(text: string): string[] {
  const frames = splitFrames(extractSymbols(text))
  const out: string[] = []
  for (const f of frames) {
    const d = decodeFrame(f)
    if (d !== null) out.push(d)
  }
  return out
}

// Longitud de la subsecuencia común más larga entre `a` y `b` (programación
// dinámica clásica, O(len(a)*len(b)) tiempo, O(len(b)) memoria) — mismo
// algoritmo que `_lcs_length` en Python.
function lcsLength(a: string[], b: string[]): number {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return 0
  let prev = new Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    const curr = new Array(m + 1).fill(0)
    const ai = a[i - 1]
    for (let j = 1; j <= m; j++) {
      curr[j] = ai === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1])
    }
    prev = curr
  }
  return prev[m]
}

/**
 * Mide cuánto del watermark de `expectedIdentifier` sigue intacto en `text`,
 * comparando (por subsecuencia común más larga) la secuencia de símbolos
 * invisibles que encode() habría insertado contra la que realmente está
 * presente en el texto entregado.
 *
 * `density_percent` es la métrica a usar como proxy de "cuánto del
 * watermark original sigue intacto": 100% = idéntico símbolo por símbolo,
 * 0% = ningún símbolo del watermark esperado sobrevivió.
 */
export function decode(
  text: string,
  expectedIdentifier: string,
  expectedFrames: number = DEFAULT_REDUNDANCY
): DecodeResult {
  const frame = buildFrameSymbols(expectedIdentifier)
  const reference: string[] = []
  for (let i = 0; i < expectedFrames; i++) reference.push(...frame)
  const extracted = extractSymbols(text)
  const matched = lcsLength(reference, extracted)
  const total = reference.length

  const density = total ? (matched / total) * 100 : 0.0
  const hasWatermark = matched > 0

  return {
    identifier: hasWatermark ? expectedIdentifier : null,
    has_watermark: hasWatermark,
    symbols_matched: matched,
    symbols_expected: total,
    expected_frames: expectedFrames,
    density_percent: Math.round(density * 10) / 10,
  }
}
