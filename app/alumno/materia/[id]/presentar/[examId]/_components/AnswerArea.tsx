import type { Answers, AnswerValue, Question } from '../_lib/examHelpers';

export function AnswerArea({ q, answers, onAnswer }: {
  q: Question;
  answers: Answers;
  onAnswer: (questionId: string, value: AnswerValue) => void;
}) {
  if (q.q_type === 'multiple_choice' || q.q_type === 'true_false') {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {(q.q_type === 'true_false' ? ['Verdadero', 'Falso'] : (q.options as string[] ?? [])).map((opt: string, i: number) => {
          const isSelected = answers[q.id] === opt;
          return (
            <button
              key={i}
              onClick={() => onAnswer(q.id, opt)}
              style={{ textAlign: "left", padding: "22px 28px", borderRadius: "18px", border: "2px solid", borderColor: isSelected ? "#1B396A" : "#f1f5f9", backgroundColor: isSelected ? "#f0f4ff" : "white", color: isSelected ? "#1B396A" : "#475569", fontWeight: "700", fontSize: "1.1rem", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <span style={{ display: "inline-flex", width: "28px", height: "28px", borderRadius: "50%", border: "2px solid", borderColor: isSelected ? "#1B396A" : "#cbd5e1", backgroundColor: isSelected ? "#1B396A" : "transparent", color: isSelected ? "white" : "#94a3b8", alignItems: "center", justifyContent: "center", marginRight: "14px", fontSize: "0.85rem", fontWeight: 900, flexShrink: 0 }}>
                {isSelected ? '✓' : String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.q_type === 'multi_select') {
    const selected: string[] = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {(q.options as string[] ?? []).map((opt: string, i: number) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={i}
              onClick={() => onAnswer(q.id, isSelected ? selected.filter(s => s !== opt) : [...selected, opt])}
              style={{ textAlign: "left", padding: "22px 28px", borderRadius: "18px", border: "2px solid", borderColor: isSelected ? "#1B396A" : "#f1f5f9", backgroundColor: isSelected ? "#f0f4ff" : "white", color: isSelected ? "#1B396A" : "#475569", fontWeight: "700", fontSize: "1.1rem", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <span style={{ display: "inline-flex", width: "28px", height: "28px", borderRadius: "8px", border: "2px solid", borderColor: isSelected ? "#1B396A" : "#cbd5e1", backgroundColor: isSelected ? "#1B396A" : "transparent", color: "white", alignItems: "center", justifyContent: "center", marginRight: "14px", fontSize: "0.85rem", fontWeight: 900, flexShrink: 0 }}>
                {isSelected ? '✓' : ''}
              </span>
              {opt}
            </button>
          );
        })}
        <p style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Puede haber más de una respuesta correcta.</p>
      </div>
    );
  }

  if (q.q_type === 'matching') {
    const mapa = (answers[q.id] as Record<number, string> | undefined) ?? {};
    const opts = q.options as { left: string[]; right: string[] } | undefined;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {(opts?.left ?? []).map((concepto: string, i: number) => (
            <div key={i} style={{ padding: "16px 20px", borderRadius: "14px", border: "2px solid #f1f5f9", fontWeight: "700", color: "#1B396A" }}>{i + 1}. {concepto}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {(opts?.right ?? []).map((_: string, i: number) => (
            <select
              key={i}
              value={mapa[i] ?? ''}
              onChange={(e) => onAnswer(q.id, { ...mapa, [i]: e.target.value })}
              style={{ padding: "16px 20px", borderRadius: "14px", border: "2px solid #f1f5f9", color: "#475569", fontWeight: "600", fontFamily: "inherit" }}
            >
              <option value="">Selecciona la definición...</option>
              {(opts?.right ?? []).map((r: string, ri: number) => (
                <option key={ri} value={ri}>{String.fromCharCode(65 + ri)}. {r}</option>
              ))}
            </select>
          ))}
        </div>
      </div>
    );
  }

  if (q.q_type === 'ordering') {
    const order: string[] = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : (q.options as string[] ?? []);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {order.map((item: string, i: number) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderRadius: "14px", border: "2px solid #f1f5f9" }}>
            <span style={{ fontWeight: "900", color: "#94a3b8" }}>{i + 1}.</span>
            <span style={{ flex: 1, fontWeight: "700", color: "#1B396A", userSelect: 'text' }}>{item}</span>
            <button disabled={i === 0} onClick={() => { const next = [...order]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; onAnswer(q.id, next); }} style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#cbd5e1" : "#64748b" }}>▲</button>
            <button disabled={i === order.length - 1} onClick={() => { const next = [...order]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; onAnswer(q.id, next); }} style={{ border: "none", background: "none", cursor: i === order.length - 1 ? "default" : "pointer", color: i === order.length - 1 ? "#cbd5e1" : "#64748b" }}>▼</button>
          </div>
        ))}
        <p style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>Usa las flechas para ordenar de la posición 1 a la última.</p>
      </div>
    );
  }

  if (q.q_type === 'short_answer') {
    return (
      <input
        type="text"
        value={(answers[q.id] as string | undefined) ?? ''}
        onChange={(e) => onAnswer(q.id, e.target.value)}
        placeholder="Escribe tu respuesta aquí..."
        style={{ width: "100%", borderRadius: "20px", border: "2px solid #f1f5f9", padding: "20px", fontSize: "1.1rem", outline: "none", fontFamily: "inherit", userSelect: 'text', boxSizing: "border-box" }}
      />
    );
  }

  if (q.q_type === 'fill_blank') {
    const blanksCount = (q.options as string[] | undefined)?.length || (q.content.match(/___/g) || []).length || 1;
    const given: string[] = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {Array.from({ length: blanksCount }).map((_, i) => (
          <input
            key={i}
            type="text"
            value={given[i] ?? ''}
            onChange={(e) => { const next = [...given]; next[i] = e.target.value; onAnswer(q.id, next); }}
            placeholder={`Espacio ${i + 1}...`}
            style={{ width: "100%", borderRadius: "20px", border: "2px solid #f1f5f9", padding: "20px", fontSize: "1.1rem", outline: "none", fontFamily: "inherit", userSelect: 'text', boxSizing: "border-box" }}
          />
        ))}
      </div>
    );
  }

  // open
  return (
    <textarea
      value={(answers[q.id] as string | undefined) ?? ''}
      onChange={(e) => onAnswer(q.id, e.target.value)}
      placeholder="Escribe tu respuesta aquí..."
      style={{ width: "100%", height: "200px", borderRadius: "20px", border: "2px solid #f1f5f9", padding: "20px", fontSize: "1.1rem", outline: "none", fontFamily: "inherit", resize: "none", userSelect: 'text', boxSizing: "border-box" }}
    />
  );
}
