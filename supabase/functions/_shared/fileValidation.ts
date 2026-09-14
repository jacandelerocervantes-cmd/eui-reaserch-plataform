// Verifica que los primeros bytes del archivo coincidan con lo que dice ser
// (extensión / Content-Type) en vez de confiar ciegamente en esos campos —
// ambos los controla por completo quien hace el request.

type Sniffed = 'pdf' | 'zip' | 'png' | 'jpg' | 'gif' | 'ole' | 'exe' | 'elf' | 'macho' | 'unknown';

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
  return 'unknown';
}

const EXECUTABLE_SIGNATURES: Sniffed[] = ['exe', 'elf', 'macho'];

// Agrupa lo que el frontend declara que es el archivo (por extensión/MIME)
// en una categoría amplia, para compararla contra el contenido real.
export type DeclaredKind = 'pdf' | 'image' | 'office' | 'text';

export function validateFileBytes(
  bytes: Uint8Array,
  declared: DeclaredKind
): { ok: true } | { ok: false; reason: string } {
  const sniffed = sniffFileType(bytes);

  if (EXECUTABLE_SIGNATURES.includes(sniffed)) {
    return { ok: false, reason: `El archivo es un ejecutable (${sniffed}), no un documento.` };
  }

  switch (declared) {
    case 'pdf':
      return sniffed === 'pdf'
        ? { ok: true }
        : { ok: false, reason: 'El archivo dice ser PDF pero su contenido no lo es.' };
    case 'image':
      return sniffed === 'png' || sniffed === 'jpg' || sniffed === 'gif'
        ? { ok: true }
        : { ok: false, reason: 'El archivo dice ser una imagen pero su contenido no lo es.' };
    case 'office':
      // .xlsx/.docx/.pptx son ZIP internamente; .doc/.xls viejos son OLE.
      return sniffed === 'zip' || sniffed === 'ole'
        ? { ok: true }
        : { ok: false, reason: 'El archivo dice ser un documento de Office pero su contenido no lo es.' };
    case 'text':
      // csv/txt no tienen magic bytes propios — se rechaza solo si el
      // contenido real resultó ser un formato binario reconocido (alguien
      // renombró un binario a .txt/.csv para evadir el filtro por extensión).
      return sniffed === 'unknown'
        ? { ok: true }
        : { ok: false, reason: 'El archivo dice ser texto plano pero su contenido es binario.' };
  }
}

// Mapa extensión → categoría amplia esperada, para los flujos que reciben un
// nombre de archivo arbitrario (material didáctico, entregas de alumnos) en
// vez de un tipo declarado fijo de antemano. Extensiones fuera de este mapa
// (ej. .zip genérico, .txt) solo se filtran contra ejecutables — igual que
// hace lib/server/fileValidationServer.ts en el lado Next.js.
const DECLARED_KIND_BY_EXT: Record<string, DeclaredKind> = {
  pdf: 'pdf',
  doc: 'office', docx: 'office',
  xls: 'office', xlsx: 'office',
  ppt: 'office', pptx: 'office',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image',
  txt: 'text', csv: 'text', md: 'text',
};

/**
 * Como `validateFileBytes`, pero infiere la categoría esperada a partir de la
 * extensión del nombre de archivo en vez de recibirla ya resuelta — usado por
 * las Edge Functions que suben binarios arbitrarios a Drive
 * (upload-course-material, submit-assignment-file) donde el tipo declarado no
 * es fijo de antemano. Extensiones sin categoría conocida en el mapa (ej.
 * .zip, .mp4) no se validan por contenido más allá de rechazar ejecutables.
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
  const declared = DECLARED_KIND_BY_EXT[ext];
  if (!declared) return { ok: true };

  return validateFileBytes(bytes, declared);
}
