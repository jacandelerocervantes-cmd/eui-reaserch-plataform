import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface Aviso {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author_id: string;
}

export type FeedItem =
  | { tipo: 'aviso'; id: string; title: string; content: string; created_at: string }
  | { tipo: 'actividad'; id: string; title: string; deadline: string | null; created_at: string }
  | { tipo: 'examen'; id: string; title: string; status: string; created_at: string };

export type Materia = {
  id: string;
  title: string;
  allow_student_comments?: boolean;
};

export type FetchResult = {
  materia: Materia | null;
  anuncios: Aviso[];
  feedItems: FeedItem[];
  feedError: string | null;
  userProfile: User | null;
};

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya manejaba el error del feed de forma inline (no bloqueante).
export async function fetchTablon(courseId: string, _reloadKey: number): Promise<FetchResult> {
  const { data: { user } } = await supabase.auth.getUser();
  const userProfile = user ?? null;

  const { data: materiaData } = await supabase
    .from("courses")
    .select("id, title, allow_student_comments")
    .eq("id", courseId)
    .maybeSingle();

  let anuncios: Aviso[] = [];
  let feedItems: FeedItem[] = [];
  let feedError: string | null = null;

  // El Tablón combina avisos (course_announcements), actividades (assignments)
  // y exámenes (exams) en una sola línea de tiempo — no solo avisos manuales.
  try {
    const { data: avisosData, error } = await supabase.functions.invoke('sync-tablon', {
      method: 'POST',
      body: { action: 'fetchPosts', payload: { course_id: courseId } }
    });
    anuncios = !error && avisosData?.success ? avisosData.data : [];

    const { data: unitsData } = await supabase
      .from('course_units').select('id').eq('course_id', courseId);
    const unitIds = (unitsData ?? []).map((u: { id: string }) => u.id);

    type ActividadRow = { id: string; title: string; soft_deadline: string | null; created_at: string };
    type ExamenRow = { id: string; title: string; status: string; created_at: string };
    let actividades: ActividadRow[] = [];
    let examenes: ExamenRow[] = [];
    if (unitIds.length > 0) {
      const [{ data: actsData }, { data: examsData }] = await Promise.all([
        supabase.from('assignments').select('id, title, soft_deadline, created_at').in('unit_id', unitIds),
        supabase.from('exams').select('id, title, status, created_at').in('unit_id', unitIds),
      ]);
      actividades = actsData ?? [];
      examenes = examsData ?? [];
    }

    feedItems = [
      ...anuncios.map((a): FeedItem => ({ tipo: 'aviso', id: a.id, title: a.title, content: a.content, created_at: a.created_at })),
      ...actividades.map((a): FeedItem => ({ tipo: 'actividad', id: a.id, title: a.title, deadline: a.soft_deadline ?? null, created_at: a.created_at })),
      ...examenes.map((e): FeedItem => ({ tipo: 'examen', id: e.id, title: e.title, status: e.status, created_at: e.created_at })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.error(err);
    feedError = "No se pudo cargar el tablón de la materia.";
  }

  return { materia: materiaData ?? null, anuncios, feedItems, feedError, userProfile };
}
