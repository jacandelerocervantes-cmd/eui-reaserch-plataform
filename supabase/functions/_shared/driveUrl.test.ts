import { describe, expect, it } from 'vitest'
import { extractDriveFileId } from './driveUrl'

// Usado por evaluate-submissions-ia para recuperar el fileId real de Drive
// desde submissions.content_url y pedirle el base64 a Apps Script
// (obtenerArchivoBase64) en vez de descargar de Supabase Storage.
describe('_shared/driveUrl — extractDriveFileId', () => {
  it('extrae el fileId de una URL de vista típica (/file/d/ID/view)', () => {
    expect(extractDriveFileId('https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing'))
      .toBe('1A2B3C4D5E6F7G8H9I0J')
  })

  it('extrae el fileId de una URL de descarga (?id=ID)', () => {
    expect(extractDriveFileId('https://drive.google.com/uc?id=1A2B3C4D5E6F7G8H9I0J&export=download'))
      .toBe('1A2B3C4D5E6F7G8H9I0J')
  })

  it('extrae el fileId de una URL de "open" (?id=ID)', () => {
    expect(extractDriveFileId('https://drive.google.com/open?id=1A2B3C4D5E6F7G8H9I0J'))
      .toBe('1A2B3C4D5E6F7G8H9I0J')
  })

  it('extrae el fileId de una URL de Google Docs (/document/d/ID/edit)', () => {
    expect(extractDriveFileId('https://docs.google.com/document/d/1A2B3C4D5E6F7G8H9I0J/edit'))
      .toBe('1A2B3C4D5E6F7G8H9I0J')
  })

  it('devuelve null para una URL que no es de Drive', () => {
    expect(extractDriveFileId('https://example.com/archivo.pdf')).toBeNull()
  })

  it('devuelve null para null/undefined/cadena vacía', () => {
    expect(extractDriveFileId(null)).toBeNull()
    expect(extractDriveFileId(undefined)).toBeNull()
    expect(extractDriveFileId('')).toBeNull()
  })
})
