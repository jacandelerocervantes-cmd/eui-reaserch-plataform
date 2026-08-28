// deno-lint-ignore-file no-import-prefix
// Parseo puro (sin I/O) del fileId de Google Drive a partir de una URL
// guardada en `submissions.content_url` / `materiales_boveda.url`. Usado por
// evaluate-submissions-ia para volver a descargar el archivo del alumno vía
// Apps Script (obtenerArchivoBase64) en vez de Supabase Storage — los
// archivos de entregas viven en Drive desde submit-assignment-file, no en un
// bucket de Storage.
//
// Formatos reales que produce Apps Script / que puede pegar un usuario:
//   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
//   https://drive.google.com/open?id=FILE_ID
//   https://drive.google.com/uc?id=FILE_ID&export=download
//   https://docs.google.com/document/d/FILE_ID/edit
export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;

  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{10,})/,      // /file/d/ID/... o /document/d/ID/...
    /[?&]id=([a-zA-Z0-9_-]{10,})/,    // ?id=ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}
