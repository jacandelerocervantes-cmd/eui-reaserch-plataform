'use client';

import { use, useState, useMemo, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Upload, CheckCircle2, Loader2, AlertCircle,
  Clock, ExternalLink, MessageSquare, HardDrive, ChevronRight, RotateCcw
} from 'lucide-react';
import ExpandingButton from "@/components/ui/ExpandingButton";
import { fetchAssignment, typeMeta } from './_services/fetchAssignment';
import { AssignmentHeader } from './_components/AssignmentHeader';
import { WorkspaceZone } from './_components/WorkspaceZone';
import { FileZone } from './_components/FileZone';
import { ForumZone } from './_components/ForumZone';
import PuzzlePlayZone from './_components/PuzzlePlayZone';
import type { PuzzleData } from '@/app/(docente)/panel/materias/[id]/actividades/nueva/_components/PuzzlePreviewModal';
import type { FetchResult } from './_services/fetchAssignment';

// ── Contenido (post-carga) ──────────────────────────────────────────────────
function EntregarContent({
  resource, courseId, assignmentId, onRetry,
}: { resource: Promise<FetchResult>; courseId: string; assignmentId: string; onRetry: () => void }) {
  const result = use(resource);
  const router = useRouter();

  const [uploading, setUploading] = useState(false);
  const [file, setFile]           = useState<File | null>(null);
  const [forumText, setForumText] = useState(result.kind === 'ok' ? result.initialForumText : '');
  const [wsConfirmed, setWsConfirmed] = useState(result.kind === 'ok' ? result.initialWsConfirmed : false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);

  if (result.kind === 'redirect') return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="animate-spin text-[#1B396A]" size={48} />
    </div>
  );

  if (result.kind === 'error') return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-red-500 font-bold">{result.message}</p>
      <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={onRetry} variant="secondary" size={44} radius={12} gap={10} padding="0 16px" fontWeight={700} durationMs={300} />
    </div>
  );

  const { studentId, assignment, existing } = result;

  // ── Determinar tipo normalizado ──
  const subType: 'file' | 'workspace' | 'hybrid' | 'forum' = (() => {
    const t = assignment?.submission_type ?? 'file';
    if (['doc', 'sheet', 'slide'].includes(t)) return 'workspace';
    if (t === 'hybrid') return 'hybrid';
    if (t === 'forum') return 'forum';
    return 'file';
  })();

  const isOverdue = assignment?.soft_deadline ? new Date() > new Date(assignment.soft_deadline) : false;
  // Fecha límite dura: si hay hard_deadline se respeta esa; si no, la soft_deadline
  // actúa como límite absoluto también. Pasada esta fecha, ya no se acepta nada.
  const effectiveDeadline = assignment?.hard_deadline ?? assignment?.soft_deadline ?? null;
  const isLocked = effectiveDeadline ? new Date() > new Date(effectiveDeadline) : false;
  const alreadySubmitted = existing?.status === 'submitted' || existing?.status === 'graded';

  // ── Validar si se puede entregar ──
  const canSubmit = (() => {
    if (subType === 'file')      return !!file || !!existing?.file_path;
    if (subType === 'workspace') return wsConfirmed;
    if (subType === 'hybrid')    return wsConfirmed || !!file;
    if (subType === 'forum')     return forumText.trim().length >= 20;
    return false;
  })();

  // ── Lógica de entrega ──
  const handleSubmit = async () => {
    if (!studentId || !assignment) return;
    if (isLocked) { setError('La fecha límite de esta actividad ya pasó. Ya no se aceptan entregas ni cambios.'); return; }
    setError('');
    setUploading(true);

    try {
      const now = new Date().toISOString();
      const isLate = isOverdue;
      const filePath: string | null = existing?.file_path ?? null;
      let contentUrl: string | null = existing?.content_url ?? null;

      // 1. Subir archivo si hay uno seleccionado — va a Drive (carpeta de la
      // actividad, subcarpeta del alumno), no a Supabase Storage, para que el
      // mismo bloqueo de acceso post-cierre que ya aplica a los Docs también
      // cubra estas entregas.
      if (file && (subType === 'file' || subType === 'hybrid')) {
        const uploadForm = new FormData();
        uploadForm.append('assignment_id', assignmentId as string);
        uploadForm.append('course_id', courseId as string);
        uploadForm.append('file', file);
        const { data: uploadData, error: uploadErr } = await supabase.functions.invoke('submit-assignment-file', { body: uploadForm });
        if (uploadErr || !uploadData?.success) throw new Error(uploadData?.error || uploadErr?.message || 'No se pudo subir el archivo.');
        contentUrl = uploadData.fileUrl;
      }

      // 2. Para workspace/hybrid: guardar URL del Doc
      if (subType === 'workspace' || subType === 'hybrid') {
        contentUrl = assignment.workspace_url ?? contentUrl;
      }

      // 3. Para forum: guardar texto
      if (subType === 'forum') {
        contentUrl = forumText.trim();
      }

      const submissionPayload = {
        file_path:      filePath,
        content_url:    contentUrl,
        status:         isLate ? 'late' : 'submitted',
        submitted_at:   now,
        version_number: (existing?.version_number ?? 0) + 1,
      };

      if (existing) {
        const { error: updateErr } = await supabase
          .from('submissions')
          .update(submissionPayload)
          .eq('id', existing.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('submissions')
          .insert({ assignment_id: assignmentId, student_id: studentId, ...submissionPayload });
        if (insertErr) throw insertErr;
      }

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  // ── Éxito ──
  if (done || alreadySubmitted) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="text-emerald-500" size={48} />
        </div>
        <h2 className="text-3xl font-black text-[#1B396A]">
          {done ? '¡Entrega Exitosa!' : 'Ya entregaste esta actividad'}
        </h2>
        <p className="text-slate-500 font-medium max-w-sm">
          {alreadySubmitted && !done
            ? `Entregada el ${existing?.submitted_at ? new Date(existing.submitted_at).toLocaleDateString('es-MX', { dateStyle: 'long' }) : '—'}.`
            : 'Tu docente podrá revisarla en breve.'}
        </p>

        {/* Para workspace/hybrid: mostrar acceso al Doc incluso después de entregar */}
        {(subType === 'workspace' || subType === 'hybrid') && assignment?.workspace_url && (
          <a
            href={assignment.workspace_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-slate-200 text-[#1B396A] px-6 py-3 rounded-[14px] font-bold hover:bg-slate-50 transition-colors no-underline"
          >
            {typeMeta(assignment.submission_type).icon}
            Ver documento compartido
            <ExternalLink size={15} />
          </a>
        )}

        {/* Para file (subido a Drive): ver el archivo entregado */}
        {subType === 'file' && existing?.content_url && (
          <a
            href={existing.content_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-slate-200 text-[#1B396A] px-6 py-3 rounded-[14px] font-bold hover:bg-slate-50 transition-colors no-underline"
          >
            <HardDrive size={20} />
            Ver mi archivo entregado
            <ExternalLink size={15} />
          </a>
        )}

        <button
          onClick={() => router.push(`/alumno/materia/${courseId}`)}
          className="bg-[#1B396A] text-white px-8 py-3 rounded-[14px] font-bold hover:bg-blue-800 transition-colors"
        >
          Volver a la Materia
        </button>
      </div>
    );
  }

  // ── Fecha límite vencida y nunca se entregó: ya no se acepta nada ──
  if (isLocked) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
          <Clock className="text-red-500" size={48} />
        </div>
        <h2 className="text-3xl font-black text-[#1B396A]">Fecha límite vencida</h2>
        <p className="text-slate-500 font-medium max-w-sm">
          Esta actividad cerró el {effectiveDeadline ? new Date(effectiveDeadline).toLocaleDateString('es-MX', { dateStyle: 'long', timeStyle: 'short' }) : '—'}. Ya no se aceptan entregas ni cambios.
        </p>
        <button
          onClick={() => router.push(`/alumno/materia/${courseId}`)}
          className="bg-[#1B396A] text-white px-8 py-3 rounded-[14px] font-bold hover:bg-blue-800 transition-colors"
        >
          Volver a la Materia
        </button>
      </div>
    );
  }

  // ── Formulario principal ──
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <button
        onClick={() => router.back()}
        className="text-slate-400 hover:text-[#1B396A] font-semibold text-sm flex items-center gap-1 transition-colors"
      >
        ← Volver
      </button>

      {/* Cabecera */}
      <AssignmentHeader assignment={assignment} isOverdue={isOverdue} />

      {/* Sección de entrega: PUZZLE GAMIFICADO INTERACTIVO */}
      {assignment?.submission_type?.startsWith('puzzle_') ? (
        <PuzzlePlayZone
          assignmentId={assignmentId}
          studentId={studentId}
          courseId={courseId}
          puzzleType={assignment.submission_type as "puzzle_crossword" | "puzzle_wordsearch"}
          puzzleData={
            (((assignment.rubric_data as Record<string, unknown>)?.puzzle_data ||
              assignment.rubric_data) as PuzzleData)
          }
          existingSubmission={existing}
          onSuccess={() => onRetry()}
        />
      ) : (
        <>
          {/* Sección de entrega según tipo estándar */}
          {(subType === 'workspace') && (
            <WorkspaceZone assignment={assignment} confirmed={wsConfirmed} onConfirm={setWsConfirmed} />
          )}

          {(subType === 'file') && (
            <FileZone file={file} onFile={setFile} required />
          )}

          {(subType === 'hybrid') && (
            <>
              {/* Paso 1: Workspace */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-wider px-1">
                  <span className="w-5 h-5 bg-[#1B396A] text-white rounded-full flex items-center justify-center text-[10px]">1</span>
                  Trabajo en Google Workspace
                </div>
                <WorkspaceZone assignment={assignment} confirmed={wsConfirmed} onConfirm={setWsConfirmed} />
              </div>

              {/* Paso 2: Archivo adicional */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-wider px-1">
                  <span className="w-5 h-5 bg-[#1B396A] text-white rounded-full flex items-center justify-center text-[10px]">2</span>
                  Evidencia adicional (opcional)
                </div>
                <FileZone file={file} onFile={setFile} />
              </div>
            </>
          )}

          {(subType === 'forum') && (
            <ForumZone text={forumText} onText={setForumText} />
          )}
        </>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[16px] p-4 flex items-center gap-3 text-red-700 font-medium">
          <AlertCircle size={20} className="flex-shrink-0" /> {error}
        </div>
      )}

      {!assignment?.submission_type?.startsWith('puzzle_') && (
        <>
          {/* Botón de entrega */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || uploading}
            className="w-full bg-[#1B396A] disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-[14px] font-black text-lg hover:bg-blue-800 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
          >
            {uploading ? (
              <><Loader2 className="animate-spin" size={22} /> Enviando...</>
            ) : (
              <>{subType === 'forum' ? <MessageSquare size={22} /> : <Upload size={22} />}
              {subType === 'workspace' ? 'Marcar como Entregado' :
               subType === 'forum' ? 'Publicar Respuesta' : 'Entregar Actividad'}
              <ChevronRight size={20} /></>
            )}
          </button>

          {!canSubmit && !uploading && (
            <p className="text-center text-slate-400 text-sm font-medium">
              {subType === 'file' && 'Selecciona un archivo para continuar.'}
              {subType === 'workspace' && 'Confirma que completaste el trabajo en el documento.'}
              {subType === 'hybrid' && 'Confirma el trabajo en el Doc o sube un archivo de evidencia.'}
              {subType === 'forum' && `Escribe al menos 20 caracteres (${forumText.length}/20).`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────
export default function EntregarActividad() {
  const { id: courseId, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const resource = useMemo(
    () => fetchAssignment(courseId, assignmentId, router, reloadKey),
    [courseId, assignmentId, router, reloadKey]
  );

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-[#1B396A]" size={48} />
      </div>
    }>
      <EntregarContent resource={resource} courseId={courseId} assignmentId={assignmentId} onRetry={() => setReloadKey((k) => k + 1)} />
    </Suspense>
  );
}
