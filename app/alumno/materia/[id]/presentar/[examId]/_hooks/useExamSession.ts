import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { isAnswered, type AnswerValue, type Answers, type ExistingResponse, type FetchResult, type Violations } from '../_lib/examHelpers';

export function useExamSession({ result, examId }: { result: FetchResult; examId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Answers>(result.kind === 'ok' ? result.initialAnswers : {});
  const [current, setCurrent] = useState(0);
  const [existingResponse, setExistingResponse] = useState<ExistingResponse | null>(result.kind === 'ok' ? result.existingResponse : null);
  const [submitted, setSubmitted] = useState(result.kind === 'ok' ? result.alreadySubmitted : false);
  const [error, setError] = useState('');

  // ── Anti-trampa ──
  const [examStarted, setExamStarted] = useState(false);
  const [violations, setViolations] = useState<Violations>({
    tabSwitches: 0, focusLost: 0, copyAttempts: 0, fullscreenExits: 0,
  });
  const [violationMsg, setViolationMsg] = useState<string | null>(null);
  const [autoBlocked, setAutoBlocked] = useState(false);
  const examStartTimeRef = useRef<Date | null>(null);
  const violationsRef = useRef<Violations>({ tabSwitches: 0, focusLost: 0, copyAttempts: 0, fullscreenExits: 0 });

  // ── Timer ──
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const autoSubmittingRef = useRef(false);
  const [timeExpired, setTimeExpired] = useState(false);

  const [saveDraftError, setSaveDraftError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const studentId = result.kind === 'ok' ? result.studentId : null;
  const exam = result.kind === 'ok' ? result.exam : null;
  // Memoizado para que handleSubmit no cambie de identidad en cada render
  // por un array recién creado a partir de un ternario.
  const questions = useMemo(() => (result.kind === 'ok' ? result.questions : []), [result]);

  // Mantener violationsRef sincronizado
  useEffect(() => { violationsRef.current = violations; }, [violations]);

  // Cambios de pestaña, copiar y salir de fullscreen cuentan como "strike"
  // (focusLost no — es muy fácil de disparar sin querer). 2 advertencias;
  // la 3ra incidencia ya no es advertencia, bloquea el examen directo.
  const registerViolation = useCallback((type: keyof Violations, msg: string) => {
    setViolations(prev => {
      const next = { ...prev, [type]: prev[type] + 1 };
      violationsRef.current = next;
      if (type === 'focusLost') {
        setViolationMsg(msg);
      } else {
        const strikes = next.tabSwitches + next.copyAttempts + next.fullscreenExits;
        setViolationMsg(strikes < 3 ? `⚠️ Advertencia ${strikes}/2 — ${msg.replace('⚠️ ', '')}` : null);
      }
      return next;
    });
  }, []);

  // ── Listeners anti-trampa (solo activos cuando el examen está en curso) ──
  useEffect(() => {
    if (!examStarted || submitted) return;

    const onVisibility = () => {
      if (document.hidden) registerViolation('tabSwitches', '⚠️ Cambio de pestaña detectado — incidencia registrada.');
    };
    const onBlur = () => registerViolation('focusLost', '⚠️ Pérdida de foco detectada — incidencia registrada.');
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      registerViolation('copyAttempts', '⚠️ Intento de copia bloqueado — incidencia registrada.');
    };
    const onContextMenu = (e: MouseEvent) => { e.preventDefault(); };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && examStarted) {
        registerViolation('fullscreenExits', '⚠️ Saliste de pantalla completa — re-activando y registrando incidencia.');
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [examStarted, submitted, registerViolation]);

  // ── Iniciar examen ──
  const handleStart = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch { /* usuario denegó fullscreen — lo registramos pero continuamos */ }
    examStartTimeRef.current = new Date();
    setTimeLeft((exam?.duration_minutes ?? 60) * 60);
    setExamStarted(true);
  };

  const handleAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const buildMetadata = () => {
    const v = violationsRef.current;
    const start = examStartTimeRef.current;
    return {
      anti_cheat: {
        tab_switches: v.tabSwitches,
        focus_lost: v.focusLost,
        copy_attempts: v.copyAttempts,
        fullscreen_exits: v.fullscreenExits,
        total_violations: v.tabSwitches + v.copyAttempts + v.fullscreenExits,
        duration_minutes: start ? Math.round((Date.now() - start.getTime()) / 60000) : null,
        started_at: start?.toISOString() ?? null,
        submitted_at: new Date().toISOString(),
        auto_blocked: undefined as boolean | undefined,
        block_reason: undefined as string | undefined,
        time_expired: undefined as boolean | undefined,
      },
    };
  };

  const handleSaveDraft = async () => {
    if (!studentId) return;
    setSavingDraft(true);
    setSaveDraftError(null);
    try {
      const metadata = buildMetadata();
      const payload = { student_id: studentId, exam_id: examId, answers, status: 'draft', metadata };
      if (existingResponse) {
        const { error } = await supabase.from('evaluation_responses').update({ answers, status: 'draft', metadata }).eq('id', existingResponse.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('evaluation_responses').insert(payload).select().single();
        if (error) throw error;
        if (data) setExistingResponse(data);
      }
    } catch (err) {
      console.error('Error guardando borrador:', err);
      setSaveDraftError('No se pudo guardar tu borrador. Tus respuestas siguen en pantalla — vuelve a intentar antes de cerrar.');
    } finally {
      setSavingDraft(false);
    }
  };

  // 2 advertencias; la 3ra incidencia ya no es advertencia — entrega forzada
  // con lo que el alumno tenga respondido hasta ese momento, sin pedir
  // confirmación (a diferencia de handleSubmit, no exige que esté completo).
  const handleAutoBlock = useCallback(async () => {
    if (!studentId) return;
    setSubmitting(true);
    try {
      const metadata = buildMetadata();
      metadata.anti_cheat.auto_blocked = true;
      metadata.anti_cheat.block_reason = 'Excedió el límite de incidencias permitidas (2 advertencias, bloqueo automático en la 3ra).';
      const payload = { student_id: studentId, exam_id: examId, answers, status: 'submitted', metadata };
      if (existingResponse) {
        await supabase.from('evaluation_responses').update({ answers, status: 'submitted', metadata }).eq('id', existingResponse.id);
      } else {
        await supabase.from('evaluation_responses').insert(payload);
      }
    } catch {
      // Aunque falle el guardado, igual se bloquea la interfaz — las
      // incidencias ya quedaron registradas en violationsRef para el docente.
    } finally {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setAutoBlocked(true);
      setSubmitted(true);
      setSubmitting(false);
    }
  }, [studentId, examId, answers, existingResponse]);

  // Dispara el bloqueo automático en cuanto el conteo de incidencias llega a 3.
  useEffect(() => {
    if (!examStarted || submitted || autoBlocked) return;
    const strikes = violations.tabSwitches + violations.copyAttempts + violations.fullscreenExits;
    if (strikes < 3) return;
    // Defiere la llamada fuera del cuerpo síncrono del efecto (mismo motivo
    // que en la validación de asistencia): no cambia el comportamiento, solo
    // evita que el guardado dispare en el mismo tick síncrono del efecto.
    const t = setTimeout(() => { handleAutoBlock(); }, 0);
    return () => clearTimeout(t);
  }, [violations, examStarted, submitted, autoBlocked, handleAutoBlock]);

  const handleSubmit = useCallback(async (force = false) => {
    if (!studentId) return;
    if (!force) {
      const unanswered = questions.filter(q => !isAnswered(q, answers[q.id]));
      if (unanswered.length > 0) {
        setError(`Faltan ${unanswered.length} pregunta(s) por responder.`);
        return;
      }
    }
    setSubmitting(true);
    setError('');
    try {
      const metadata = buildMetadata();
      if (force) metadata.anti_cheat.time_expired = true;
      const payload = { student_id: studentId, exam_id: examId, answers, status: 'submitted', metadata };
      if (existingResponse) {
        await supabase.from('evaluation_responses').update({ answers, status: 'submitted', metadata }).eq('id', existingResponse.id);
      } else {
        await supabase.from('evaluation_responses').insert(payload);
      }
      // Salir de fullscreen al terminar
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setSubmitted(true);
    } catch {
      setError('Error al enviar el examen. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }, [studentId, examId, answers, existingResponse, questions]);

  // ── Cuenta regresiva — al llegar a 0 se entrega automáticamente con lo
  // que el alumno tenga respondido, sin exigir que esté completo. ──
  useEffect(() => {
    if (!examStarted || submitted || autoBlocked || timeLeft === null) return;
    if (timeLeft <= 0) {
      if (!autoSubmittingRef.current) {
        autoSubmittingRef.current = true;
        setTimeExpired(true);
        handleSubmit(true);
      }
      return;
    }
    const t = setTimeout(() => setTimeLeft(prev => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [examStarted, submitted, autoBlocked, timeLeft, handleSubmit]);

  return {
    submitting, answers, current, setCurrent,
    existingResponse, submitted, error,
    examStarted, violations, violationMsg, autoBlocked,
    timeLeft, timeExpired,
    saveDraftError, savingDraft,
    studentId, exam, questions,
    handleStart, handleAnswer, handleSaveDraft, handleSubmit,
  };
}
