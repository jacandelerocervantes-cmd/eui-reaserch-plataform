// Validación de archivos por contenido real (magic bytes) para el servidor
// (Next.js Route Handlers) — a diferencia de lib/fileValidation.ts (cliente,
// solo UX/fricción, se salta trivialmente), esto SÍ es un límite de
// seguridad real: corre antes de que app/api/storage/validated-upload/route.ts
// escriba el archivo a Supabase Storage.
//
// Cierra el gap documentado en SECURITY_AUDIT.md punto 20: las subidas
// directas a Storage (buckets JUSTIFICANTES, campo-capturas) no tenían
// ningún punto de validación server-side.
//
// Incluye firmas de audio (wav/mp3/ogg/m4a/webm) que la versión de
// supabase/functions/_shared/fileValidation.ts no necesita — esa la usan
// funciones que solo procesan PDF/imagen/Office, mientras que
// campo/captura acepta grabaciones de audio.

export type Sniffed =
  | 'pdf' | 'zip' | 'png' | 'jpg' | 'gif' | 'ole'
  | 'exe' | 'elf' | 'macho'
  | 'wav' | 'mp3' | 'ogg' | 'm4a' | 'webm'
  | 'unknown';

function matches(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

export function sniffFileType(bytes: Uint8Array): Sniffed {
  if (matches(bytes, 0, [0x25, 0x50, 0x44, 0x46])) return 'pdf';               // %PDF
  if (
    matches(bytes, 0, [0x50, 0x4b, 0x03, 0x04]) ||
    matches(bytes, 0, [0x50, 0x4b, 0x05, 0x06]) ||
    matches(bytes, 0, [0x50, 0x4b, 0x07, 0x08])
  ) return 'zip';                                                              // docx/xlsx/pptx/zip
  if (matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (matches(bytes, 0, [0xff, 0xd8, 0xff])) return 'jpg';
  if (matches(bytes, 0, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (matches(bytes, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole'; // .doc/.xls viejo
  if (matches(bytes, 0, [0x4d, 0x5a])) return 'exe';                           // MZ (Windows PE)
  if (matches(bytes, 0, [0x7f, 0x45, 0x4c, 0x46])) return 'elf';               // Linux
  if (
    matches(bytes, 0, [0xca, 0xfe, 0xba, 0xbe]) ||
    matches(bytes, 0, [0xcf, 0xfa, 0xed, 0xfe]) ||
    matches(bytes, 0, [0xfe, 0xed, 0xfa, 0xce])
  ) return 'macho';                                                            // macOS

  // ── Audio ──────────────────────────────────────────────────────────────
  if (matches(bytes, 0, [0x52, 0x49, 0x46, 0x46])) return 'wav';               // "RIFF" (....WAVE)
  if (
    matches(bytes, 0, [0x49, 0x44, 0x33]) ||                                   // "ID3"
    matches(bytes, 0, [0xff, 0xfb]) || matches(bytes, 0, [0xff, 0xf3]) || matches(bytes, 0, [0xff, 0xf2]) // frame sync MPEG-1 Layer 3
  ) return 'mp3';
  if (matches(bytes, 0, [0x4f, 0x67, 0x67, 0x53])) return 'ogg';               // "OggS"
  if (matches(bytes, 4, [0x66, 0x74, 0x79, 0x70])) return 'm4a';               // "....ftyp" (MP4/M4A container)
  if (matches(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm';              // EBML header (WebM/Matroska)

  return 'unknown';
}

const EXECUTABLE_SIGNATURES: Sniffed[] = ['exe', 'elf', 'macho'];
const AUDIO_SIGNATURES: Sniffed[] = ['wav', 'mp3', 'ogg', 'm4a', 'webm'];

// Extensiones para las que existe una firma binaria confiable que verificar.
const SIGNATURES_BY_EXT: Record<string, Sniffed[]> = {
  pdf: ['pdf'],
  doc: ['ole'], docx: ['zip'],
  xls: ['ole'], xlsx: ['zip'],
  ppt: ['ole'], pptx: ['zip'],
  zip: ['zip'],
  png: ['png'],
  jpg: ['jpg'], jpeg: ['jpg'],
  gif: ['gif'],
  wav: ['wav'],
  mp3: ['mp3'],
  ogg: ['ogg'],
  m4a: ['m4a'],
  webm: ['webm'],
};

/**
 * Valida contenido binario real contra lo que la extensión del archivo dice
 * que es. Bloquea ejecutables siempre (sin importar la extensión). Para
 * extensiones sin firma conocida en el mapa de arriba (ej. .txt, .csv), solo
 * se filtra contra ejecutables/audio — no hay más que verificar.
 */
export function validateFileBytesByExtension(
  bytes: Uint8Array,
  filename: string,
): { ok: true } | { ok: false; reason: string } {
  const sniffed = sniffFileType(bytes);

  if (EXECUTABLE_SIGNATURES.includes(sniffed)) {
    return { ok: false, reason: `"${filename}" es un ejecutable, no un archivo válido para esta subida.` };
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const expected = SIGNATURES_BY_EXT[ext];
  if (expected && !expected.includes(sniffed)) {
    return { ok: false, reason: `"${filename}" tiene extensión .${ext} pero su contenido no corresponde a ese formato.` };
  }
  // Extensión sin firma en el mapa (ej. .txt) pero el contenido real SÍ es
  // un formato binario reconocido que no coincide con nada esperable ahí
  // (ej. alguien renombró un ejecutable a .txt) — no debería pasar audio
  // disfrazado de texto tampoco.
  if (!expected && AUDIO_SIGNATURES.includes(sniffed) && !['wav', 'mp3', 'ogg', 'm4a', 'webm'].includes(ext)) {
    return { ok: false, reason: `"${filename}" dice ser .${ext} pero su contenido es un archivo de audio.` };
  }

  return { ok: true };
}
