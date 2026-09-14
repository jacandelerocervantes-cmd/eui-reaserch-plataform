// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useExamSession } from './useExamSession';
import type { FetchResult, Question } from '../_lib/examHelpers';

// Confirma, además de la lógica del hook, que el alias `@/*` resuelve en
// Vitest (docs/ENTORNO_DE_PRUEBAS.md §1.4/§2) — `useExamSession.ts` importa
// `@/lib/supabase`; si `vitest.config.ts` no tuviera `resolve.alias`, este
// archivo fallaría al cargar con "Failed to resolve import \"@/lib/supabase\"".
const from = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => from(...args) },
}));

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  builder.update = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve({ data: { id: 'resp-1' }, error: null }));
  // Builder "thenable": awaitear el builder directamente (sin .select().single())
  // resuelve como una promesa, igual que el cliente real de supabase-js.
  builder.then = (resolve: (v: { data: null; error: null }) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve);
  return builder;
}

const question: Question = {
  id: 'q1',
  content: '¿Cuánto es 2+2?',
  q_type: 'short_answer',
  options: null,
  points: 10,
  order_index: 0,
};

function makeOkResult(overrides: Partial<Extract<FetchResult, { kind: 'ok' }>> = {}): FetchResult {
  return {
    kind: 'ok',
    studentId: 'student-1',
    exam: { id: 'exam-1', title: 'Examen', status: 'active', course_id: 'course-1', duration_minutes: 1 },
    questions: [question],
    initialAnswers: {},
    existingResponse: null,
    alreadySubmitted: false,
    ...overrides,
  };
}

describe('useExamSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    from.mockReset();
    from.mockImplementation(() => makeBuilder());
    // jsdom no implementa fullscreen — se mockea para que handleStart/handleAutoBlock/handleSubmit no truenen.
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
    });
    Object.defineProperty(document, 'exitFullscreen', { value: vi.fn().mockResolvedValue(undefined), configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('el alias @/lib/supabase resuelve correctamente (import no lanza al cargar el módulo)', () => {
    const { result } = renderHook(() => useExamSession({ result: makeOkResult(), examId: 'exam-1' }));
    expect(result.current.studentId).toBe('student-1');
  });

  it('entrega automáticamente con lo respondido al llegar el timer a 0 (timeExpired=true)', async () => {
    const { result } = renderHook(() => useExamSession({ result: makeOkResult(), examId: 'exam-1' }));

    await act(async () => {
      await result.current.handleStart();
    });
    expect(result.current.timeLeft).toBe(60); // duration_minutes=1 → 60s

    // El hook reprograma un setTimeout(1000) nuevo dentro de cada tick del
    // anterior — se avanza de a 1s por vez para que React confirme cada
    // efecto/render entre ticks (un solo advanceTimersByTimeAsync(60000) no
    // alcanza a reprogramar+ejecutar los 60 timeouts encadenados).
    for (let i = 0; i < 61; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    expect(result.current.timeExpired).toBe(true);
    expect(result.current.submitted).toBe(true);
    expect(from).toHaveBeenCalledWith('evaluation_responses');
  });

  it('bloquea automáticamente en la 3ra incidencia (tabSwitches) sin pedir confirmación', async () => {
    const { result } = renderHook(() => useExamSession({ result: makeOkResult(), examId: 'exam-1' }));

    await act(async () => {
      await result.current.handleStart();
    });

    // Simula 3 cambios de pestaña — registerViolation solo se conecta a
    // listeners reales del DOM, así que se accede al mismo efecto disparando
    // el evento 'visibilitychange' con document.hidden en true.
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.runOnlyPendingTimersAsync();
        await vi.advanceTimersByTimeAsync(0);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.violations.tabSwitches).toBe(3);
    expect(result.current.autoBlocked).toBe(true);
    expect(result.current.submitted).toBe(true);
  });

  it('handleSubmit rechaza el envío si quedan preguntas sin responder (sin force)', async () => {
    const { result } = renderHook(() => useExamSession({ result: makeOkResult(), examId: 'exam-1' }));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe('Faltan 1 pregunta(s) por responder.');
    expect(result.current.submitted).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it('handleSubmit envía correctamente cuando todas las preguntas están respondidas', async () => {
    const { result } = renderHook(() => useExamSession({ result: makeOkResult(), examId: 'exam-1' }));

    act(() => {
      result.current.handleAnswer('q1', '4');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe('');
    expect(result.current.submitted).toBe(true);
    expect(from).toHaveBeenCalledWith('evaluation_responses');
  });
});
