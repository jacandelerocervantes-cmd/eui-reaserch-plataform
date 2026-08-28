export type QuestionOptions = string[] | { left: string[]; right: string[] } | undefined | null;

export type Question = {
  id: string;
  content: string;
  q_type: 'multiple_choice' | 'true_false' | 'open' | 'matching' | 'short_answer' | 'fill_blank' | 'ordering' | 'multi_select';
  options: QuestionOptions;
  points: number;
  order_index: number | null;
};

export type AnswerValue = string | string[] | Record<number, string> | undefined;
export type Answers = Record<string, AnswerValue>;

export type ExamRecord = { id: string; title: string; status: string; course_id: string; duration_minutes: number };

export type ExistingResponse = {
  id: string;
  status: string;
  answers: Answers;
  final_score: number | null;
  score_ia: number | null;
  metadata: unknown;
};

export type Violations = {
  tabSwitches: number;
  focusLost: number;
  copyAttempts: number;
  fullscreenExits: number;
};

export type FetchResult =
  | { kind: 'ok'; studentId: string; exam: ExamRecord; questions: Question[]; initialAnswers: Answers; existingResponse: ExistingResponse | null; alreadySubmitted: boolean }
  | { kind: 'error'; message: string }
  | { kind: 'redirect' };

export const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Opción Múltiple',
  true_false: 'Verdadero/Falso',
  open: 'Abierta',
  matching: 'Relación de Columnas',
  short_answer: 'Respuesta Corta',
  fill_blank: 'Completar Espacios',
  ordering: 'Ordenar/Secuenciar',
  multi_select: 'Selección Múltiple',
};

// Determina si una pregunta ya tiene una respuesta capturable como "completa"
// — cada tipo guarda su respuesta en una forma distinta (string, array u objeto).
export function isAnswered(q: Question, val: AnswerValue): boolean {
  if (val == null) return false;
  switch (q.q_type) {
    case 'matching': {
      const leftLen = (!Array.isArray(q.options) ? q.options?.left?.length : undefined) ?? 0;
      return typeof val === 'object' && Object.keys(val).length >= leftLen && leftLen > 0;
    }
    case 'ordering':
    case 'multi_select':
      return Array.isArray(val) && val.length > 0;
    case 'fill_blank':
      return Array.isArray(val) && val.length > 0 && val.every((v) => (v ?? '').toString().trim());
    default:
      return typeof val === 'string' && val.trim().length > 0;
  }
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
