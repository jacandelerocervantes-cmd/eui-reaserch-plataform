import React from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  FileText, FileSpreadsheet, Presentation, MessageSquare, HardDrive,
} from 'lucide-react';

// ── Iconos por tipo de entorno ──────────────────────────────────────────────
export const WORKSPACE_META: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  doc:   { icon: <FileText size={28} />,        label: 'Google Docs',   color: '#2563eb', bg: '#eff6ff' },
  sheet: { icon: <FileSpreadsheet size={28} />, label: 'Google Sheets', color: '#16a34a', bg: '#f0fdf4' },
  slide: { icon: <Presentation size={28} />,    label: 'Google Slides', color: '#ea580c', bg: '#fff7ed' },
  forum: { icon: <MessageSquare size={28} />,   label: 'Participación', color: '#7c3aed', bg: '#f5f3ff' },
  file:  { icon: <HardDrive size={28} />,       label: 'Subida de archivo', color: '#1B396A', bg: '#f0f7ff' },
};

export function typeMeta(submission_type: string) {
  if (['doc', 'sheet', 'slide'].includes(submission_type)) return WORKSPACE_META[submission_type];
  if (submission_type === 'forum') return WORKSPACE_META.forum;
  return WORKSPACE_META.file;
}

export type Assignment = {
  id: string;
  title: string;
  description: string | null;
  soft_deadline: string | null;
  hard_deadline: string | null;
  submission_type: string;
  rubric_data: unknown;
  late_penalty_percent: number;
  workspace_url: string | null;
};

export type Submission = {
  id: string;
  status: string;
  file_path: string | null;
  content_url: string | null;
  submitted_at: string | null;
  version_number: number;
};

export type FetchResult =
  | { kind: "ok"; studentId: string; assignment: Assignment; existing: Submission | null; initialForumText: string; initialWsConfirmed: boolean }
  | { kind: "error"; message: string }
  | { kind: "redirect" };

// No usamos throw/reject: use() reserva el "throw" para Suspense/ErrorBoundary,
// y esta pantalla ya tenía su propia UI de error con botón de reintento.
export async function fetchAssignment(
  courseId: string,
  assignmentId: string,
  router: ReturnType<typeof useRouter>,
  _reloadKey: number
): Promise<FetchResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/alumno/login'); return { kind: "redirect" }; }

    const { data: studentRec } = await supabase
      .from('students')
      .select('id')
      .ilike('correo', user.email ?? '')
      .eq('course_id', courseId)
      .maybeSingle();

    if (!studentRec) { router.push('/alumno'); return { kind: "redirect" }; }

    const { data: asgn } = await supabase
      .from('assignments')
      .select('id, title, description, soft_deadline, hard_deadline, submission_type, rubric_data, late_penalty_percent, workspace_url')
      .eq('id', assignmentId)
      .maybeSingle();

    if (!asgn) { router.push(`/alumno/materia/${courseId}`); return { kind: "redirect" }; }

    const { data: sub } = await supabase
      .from('submissions')
      .select('id, status, file_path, content_url, submitted_at, version_number')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentRec.id)
      .maybeSingle();

    let resolvedContentUrl = sub?.content_url ?? null;
    if (!resolvedContentUrl) {
      // Intentar buscar en assignment_teams si la actividad es por equipos
      const { data: teamMember } = await supabase
        .from('assignment_team_members')
        .select('team_id, assignment_teams(workspace_url)')
        .eq('student_id', studentRec.id)
        .limit(1)
        .maybeSingle();
      if (teamMember) {
        resolvedContentUrl = (teamMember as unknown as { assignment_teams: { workspace_url: string | null } | null })?.assignment_teams?.workspace_url ?? null;
      }
    }

    const effectiveExisting: Submission | null = sub
      ? { ...sub, content_url: resolvedContentUrl }
      : resolvedContentUrl
        ? { id: '', status: 'draft', file_path: null, content_url: resolvedContentUrl, submitted_at: null, version_number: 1 }
        : null;

    let initialForumText = '';
    let initialWsConfirmed = false;
    if (effectiveExisting) {
      if (effectiveExisting.content_url && !effectiveExisting.content_url.startsWith('http')) {
        initialForumText = effectiveExisting.content_url;
      }
      if (effectiveExisting.content_url && effectiveExisting.content_url.startsWith('http')) {
        initialWsConfirmed = effectiveExisting.status === 'submitted';
      }
    }

    return {
      kind: "ok",
      studentId: studentRec.id,
      assignment: asgn as Assignment,
      existing: effectiveExisting,
      initialForumText,
      initialWsConfirmed
    };
  } catch (err) {
    console.error('Error cargando la actividad:', err);
    return { kind: "error", message: 'No se pudo cargar esta actividad. Intenta de nuevo.' };
  }
}

