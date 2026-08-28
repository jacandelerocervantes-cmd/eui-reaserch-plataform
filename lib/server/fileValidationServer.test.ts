import { describe, expect, it } from 'vitest'
import { sniffFileType, validateFileBytesByExtension } from './fileValidationServer'

// Firmas binarias reales (magic bytes), no strings simuladas — son los
// primeros bytes reales que produce cada formato.
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]) // "%PDF-1.4"
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]) // docx/xlsx/zip
const MZ_EXE_BYTES = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]) // "MZ" (Windows PE)
const ELF_BYTES = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00])

describe('lib/server/fileValidationServer — magic bytes reales (límite de seguridad server-side)', () => {
  it('sniffFileType identifica cada firma real correctamente', () => {
    expect(sniffFileType(PDF_BYTES)).toBe('pdf')
    expect(sniffFileType(PNG_BYTES)).toBe('png')
    expect(sniffFileType(ZIP_BYTES)).toBe('zip')
    expect(sniffFileType(MZ_EXE_BYTES)).toBe('exe')
    expect(sniffFileType(ELF_BYTES)).toBe('elf')
  })

  it('ACEPTA un .pdf cuyo contenido real es PDF (camino feliz)', () => {
    const result = validateFileBytesByExtension(PDF_BYTES, 'justificante.pdf')
    expect(result.ok).toBe(true)
  })

  it('RECHAZA un archivo con EXTENSIÓN FALSA: nombrado .pdf pero con contenido real PNG', () => {
    const result = validateFileBytesByExtension(PNG_BYTES, 'justificante.pdf')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/extensión \.pdf.*no corresponde/i)
  })

  it('RECHAZA un ejecutable (MZ) disfrazado de documento .pdf, sin importar la extensión declarada', () => {
    const result = validateFileBytesByExtension(MZ_EXE_BYTES, 'tarea.pdf')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/ejecutable/i)
  })

  it('RECHAZA un ejecutable ELF disfrazado de imagen .png', () => {
    const result = validateFileBytesByExtension(ELF_BYTES, 'foto.png')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/ejecutable/i)
  })

  it('RECHAZA un .docx (zip por dentro) cuyo contenido real es un JPEG', () => {
    const JPG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
    const result = validateFileBytesByExtension(JPG_BYTES, 'reporte.docx')
    expect(result.ok).toBe(false)
  })

  it('ACEPTA .docx real (contenido ZIP) y .doc viejo real (contenido OLE)', () => {
    const OLE_BYTES = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    expect(validateFileBytesByExtension(ZIP_BYTES, 'trabajo.docx').ok).toBe(true)
    expect(validateFileBytesByExtension(OLE_BYTES, 'trabajo.doc').ok).toBe(true)
  })
})
