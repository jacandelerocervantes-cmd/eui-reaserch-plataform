// Validación de archivos por contenido real (magic bytes), no por extensión
// ni por el Content-Type que reporta el navegador — ambos son solo
// metadatos que cualquiera puede cambiar antes de subir el archivo.
//
// IMPORTANTE: esto corre en el cliente, así que es una capa de UX/fricción
// (evita que alguien suba por error un archivo con la extensión equivocada,
// o renombre algo trivialmente) — NO es un límite de seguridad real. Un
// atacante que use la API de Supabase Storage directo con la anon key se
// la salta sin problema. Los buckets que reciben archivos así
// (JUSTIFICANTES, campo-capturas) todavía no tienen validación server-side;
// ver SECURITY_AUDIT.md, punto 20.

type Sniffed = 'pdf' | 'zip' | 'png' | 'jpg' | 'gif' | 'ole' | 'exe' | 'elf' | 'macho' | 'unknown';

function matches(bytes: Uint8Array, offset: number, sig: number[]): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

function sniffFileType(bytes: Uint8Array): Sniffed {
  if (matches(bytes, 0, [0x25, 0x50, 0x44, 0x46])) return 'pdf';
  if (
    matches(bytes, 0, [0x50, 0x4b, 0x03, 0x04]) ||
    matches(bytes, 0, [0x50, 0x4b, 0x05, 0x06]) ||
    matches(bytes, 0, [0x50, 0x4b, 0x07, 0x08])
  ) return 'zip';
  if (matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (matches(bytes, 0, [0xff, 0xd8, 0xff])) return 'jpg';
  if (matches(bytes, 0, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (matches(bytes, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole';
  if (matches(bytes, 0, [0x4d, 0x5a])) return 'exe';
  if (matches(bytes, 0, [0x7f, 0x45, 0x4c, 0x46])) return 'elf';
  if (
    matches(bytes, 0, [0xca, 0xfe, 0xba, 0xbe]) ||
    matches(bytes, 0, [0xcf, 0xfa, 0xed, 0xfe]) ||
    matches(bytes, 0, [0xfe, 0xed, 0xfa, 0xce])
  ) return 'macho';
  return 'unknown';
}

const EXECUTABLE_SIGNATURES: Sniffed[] = ['exe', 'elf', 'macho'];

// Extensiones para las que sí existe una firma binaria confiable que
// verificar. Todo lo que no está en este mapa (txt, csv, rar sin firma
// estándar consistente, etc.) solo se filtra contra ejecutables.
const SIGNATURES_BY_EXT: Record<string, Sniffed[]> = {
  pdf: ['pdf'],
  doc: ['ole'],
  docx: ['zip'],
  xls: ['ole'],
  xlsx: ['zip'],
  pptx: ['zip'],
  zip: ['zip'],
  png: ['png'],
  jpg: ['jpg'],
  jpeg: ['jpg'],
  gif: ['gif'],
};

export async function validateFileContent(file: File): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Alcanza con la cabecera del archivo — nunca hace falta leerlo completo.
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffFileType(head);

  if (EXECUTABLE_SIGNATURES.includes(sniffed)) {
    return { ok: false, reason: `"${file.name}" es un ejecutable, no un documento válido.` };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const expected = SIGNATURES_BY_EXT[ext];
  if (expected && !expected.includes(sniffed)) {
    return { ok: false, reason: `"${file.name}" tiene extensión .${ext} pero su contenido no corresponde a ese formato.` };
  }

  return { ok: true };
}
