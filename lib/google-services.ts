import { supabase } from './supabase'

/**
 * Todas las llamadas a Google Apps Script pasan por Supabase Edge Functions.
 * El secret APPS_SCRIPT_SECRET se inyecta server-side — nunca llega al browser.
 */

export async function setupGoogleCourse(courseId: string, title: string, clave?: string) {
  const { data, error } = await supabase.functions.invoke('provision-course-environment', {
    body: { courseId, title, clave },
  })
  if (error) throw error
  return data
}

export async function syncStudentSheet(payload: {
  googleSheetId: string
  matricula: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno?: string
  correo?: string
}) {
  const { data, error } = await supabase.functions.invoke('enroll-manual', {
    body: { mode: 'sync', ...payload },
  })
  if (error) throw error
  return data
}
