// Sube un archivo a Supabase Storage vía app/api/storage/validated-upload
// (valida magic bytes server-side antes de escribir) en vez de llamar a
// supabase.storage.from(bucket).upload(...) directo desde el navegador —
// esa vía se salta cualquier validación con solo llamar a la API de Storage
// con la anon key. Ver SECURITY_AUDIT.md punto 20 y
// qa-05a-doublecheck/02-SOLUCION.md.
export async function uploadValidated(params: {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
}): Promise<{ publicUrl: string }> {
  const form = new FormData();
  form.append('bucket', params.bucket);
  form.append('path', params.path);
  form.append('file', params.file);
  if (params.upsert) form.append('upsert', 'true');

  const res = await fetch('/api/storage/validated-upload', { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `No se pudo subir el archivo (${res.status}).`);
  return { publicUrl: json.publicUrl as string };
}
