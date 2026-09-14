import { describe, expect, it } from 'vitest'
import { sniffFileType, validateFileBytes, validateFileBytesByExtension } from './fileValidation'

// Usada por import-ia-students e intelligent-file-parser antes de mandar los
// bytes a Gemini — bloquea aquí, no solo confía en file.type/nombre.
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00])
const MZ_EXE_BYTES = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])

describe('_shared/fileValidation — magic bytes en Edge Functions de importación IA', () => {
  it('sniffFileType reconoce las firmas reales', () => {
    expect(sniffFileType(PDF_BYTES)).toBe('pdf')
    expect(sniffFileType(PNG_BYTES)).toBe('png')
    expect(sniffFileType(MZ_EXE_BYTES)).toBe('exe')
  })

  it('ACEPTA un PDF real declarado como pdf', () => {
    expect(validateFileBytes(PDF_BYTES, 'pdf')).toEqual({ ok: true })
  })

  it('RECHAZA EXTENSIÓN FALSA: se declara "pdf" pero el contenido real es PNG', () => {
    const result = validateFileBytes(PNG_BYTES, 'pdf')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/dice ser PDF/i)
  })

  it('RECHAZA un ejecutable disfrazado de "office" (docx/xlsx declarado)', () => {
    const result = validateFileBytes(MZ_EXE_BYTES, 'office')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/ejecutable/i)
  })

  it('ACEPTA un .docx real (ZIP) declarado como "office"', () => {
    expect(validateFileBytes(ZIP_BYTES, 'office')).toEqual({ ok: true })
  })

  it('RECHAZA "image" declarada cuando el contenido real es un PDF', () => {
    const result = validateFileBytes(PDF_BYTES, 'image')
    expect(result.ok).toBe(false)
  })

  it('RECHAZA "text" declarado cuando el contenido real es un binario reconocido (ZIP)', () => {
    const result = validateFileBytes(ZIP_BYTES, 'text')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/texto plano/i)
  })
})

// Usada por upload-course-material y submit-assignment-file — el nombre de
// archivo llega arbitrario (lo elige quien sube), sin un "tipo declarado" fijo.
describe('_shared/fileValidation — validateFileBytesByExtension (subidas a Drive)', () => {
  it('ACEPTA un PDF real con extensión .pdf', () => {
    expect(validateFileBytesByExtension(PDF_BYTES, 'tarea.pdf')).toEqual({ ok: true })
  })

  it('RECHAZA un .docx cuyo contenido real es un PDF', () => {
    const result = validateFileBytesByExtension(PDF_BYTES, 'entrega.docx')
    expect(result.ok).toBe(false)
  })

  it('RECHAZA un ejecutable disfrazado con extensión .pdf', () => {
    const result = validateFileBytesByExtension(MZ_EXE_BYTES, 'inocente.pdf')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/ejecutable/i)
  })

  it('RECHAZA un ejecutable aunque la extensión no esté en el mapa (ej. .zip)', () => {
    const result = validateFileBytesByExtension(MZ_EXE_BYTES, 'paquete.zip')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/ejecutable/i)
  })

  it('ACEPTA extensiones sin categoría conocida (ej. .zip real) sin más validación', () => {
    expect(validateFileBytesByExtension(ZIP_BYTES, 'material.zip')).toEqual({ ok: true })
  })

  it('ACEPTA una imagen PNG real con extensión .png', () => {
    expect(validateFileBytesByExtension(PNG_BYTES, 'foto.png')).toEqual({ ok: true })
  })
})
