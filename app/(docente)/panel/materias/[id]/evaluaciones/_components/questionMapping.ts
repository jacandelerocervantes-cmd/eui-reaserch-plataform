// Conversión entre el estado de edición en UI (q.type, q.options, q.answer,
// q.left/right/correct) y las columnas reales de `questions` (q_type,
// options jsonb, correct_answer text). Centralizado para que nuevo/page.tsx,
// configuracion/page.tsx y publish-exam-form usen exactamente la misma regla
// por tipo — antes vivía duplicado e incompleto en cada archivo.

// Estado de edición en UI — las claves relevantes varían según `type`
// (matching usa left/right/correct, multi_select usa options/correct, etc.),
// por eso todos los campos salvo type/content/points son opcionales.
export type EditQuestion = {
  id?: string;
  type: string;
  content: string;
  points: number | string;
  bloom?: string | null;
  options?: string[];
  answer?: string;
  left?: string[];
  right?: string[];
  correct?: (string | number)[];
};

export type QuestionRow = {
  id: string;
  q_type: string;
  content: string;
  points: number;
  bloom_level: string | null;
  options: { left?: string[]; right?: string[] } | string[] | null;
  correct_answer: string | null;
};

export function buildQuestionRow(q: EditQuestion, examId: string, idx: number) {
  const points = parseFloat(String(q.points)) || 0;
  let options: unknown = q.options ?? [];
  let correct_answer: string;

  if (q.type === 'matching') {
    options = { left: q.left ?? [], right: q.right ?? [] };
    // Si no se definió "correct" a mano (captura manual sin IA), se asume
    // correspondencia por posición: concepto i ↔ definición i.
    const correct = (q.correct && q.correct.length > 0) ? q.correct : (q.left ?? []).map((_, i) => i);
    correct_answer = JSON.stringify(correct);
  } else if (q.type === 'ordering') {
    correct_answer = JSON.stringify(q.options ?? []);
  } else if (q.type === 'multi_select') {
    correct_answer = JSON.stringify(q.correct ?? []);
  } else if (q.type === 'short_answer' || q.type === 'fill_blank') {
    correct_answer = JSON.stringify((q.options ?? []).filter((o: string) => o));
  } else {
    correct_answer = String(q.answer ?? "");
  }

  return {
    exam_id: examId,
    q_type: q.type,
    content: q.content,
    options,
    correct_answer,
    points,
    bloom_level: q.bloom ?? null,
    order_index: idx,
  };
}

// Inverso: de una fila de `questions` al estado de edición de UI.
export function parseQuestionRow(row: QuestionRow): EditQuestion {
  const t = row.q_type;
  const safeParse = (s: string | null) => { try { return JSON.parse(s ?? "null") } catch { return null } };
  const opts = row.options;

  const base = { id: row.id, type: t, content: row.content, points: row.points, bloom: row.bloom_level };

  if (t === 'matching') {
    const matchingOpts = !Array.isArray(opts) ? opts : null;
    return { ...base, left: matchingOpts?.left ?? [], right: matchingOpts?.right ?? [], correct: safeParse(row.correct_answer) ?? [] };
  }
  if (t === 'ordering') {
    return { ...base, options: safeParse(row.correct_answer) ?? (Array.isArray(opts) ? opts : []) };
  }
  if (t === 'multi_select') {
    return { ...base, options: Array.isArray(opts) ? opts : [], correct: safeParse(row.correct_answer) ?? [] };
  }
  if (t === 'short_answer' || t === 'fill_blank') {
    return { ...base, options: safeParse(row.correct_answer) ?? [] };
  }
  return { ...base, options: Array.isArray(opts) ? opts : [], answer: row.correct_answer ?? undefined };
}
