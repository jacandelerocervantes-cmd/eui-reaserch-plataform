"use client";

import { Trash2, X, ChevronUp, ChevronDown } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { TYPE_LABELS } from "./constants";
import type { EditQuestion } from "./questionMapping";

// Tarjeta editable de un reactivo — antes duplicada (con variaciones mínimas)
// en nuevo/page.tsx y [examId]/configuracion/page.tsx.
export const QuestionCard = ({ question: q, index: idx, onUpdate, onDelete }: {
  question: EditQuestion; index: number; onUpdate: (patch: Partial<EditQuestion>) => void; onDelete: () => void;
}) => {
  const updateQuestion = (patch: Partial<EditQuestion>) => onUpdate(patch);

  return (
    <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ backgroundColor: "#1B396A", color: "white", width: "32px", height: "32px", borderRadius: "8px", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "900" }}>{idx + 1}</div>
          <select value={q.type} onChange={(e) => updateQuestion({ type: e.target.value })} style={{ fontSize: "0.75rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "4px 8px", backgroundColor: "white", cursor: "pointer" }}>
            {Object.entries(TYPE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#f8fafc", padding: "6px 14px", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: "900", color: "#64748b" }}>PUNTOS:</span>
          <input
            type="number" value={q.points}
            onChange={(e) => updateQuestion({ points: e.target.value })}
            style={{ width: "45px", border: "none", background: "transparent", fontWeight: "900", color: "#1B396A", textAlign: "center", outline: "none", fontSize: "1rem" }}
          />
        </div>
      </div>
      <textarea
        value={q.content}
        onChange={(e) => updateQuestion({ content: e.target.value })}
        placeholder="Enunciado del reactivo..."
        style={{ width: "100%", border: "none", outline: "none", fontSize: "1.15rem", fontWeight: "700", color: "#1B396A", resize: "none", fontFamily: "inherit", lineHeight: "1.5" }}
      />

      {q.type === 'multiple_choice' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
          {(q.options ?? ["", "", "", ""]).map((opt: string, oi: number) => (
            <input key={oi} value={opt} placeholder={`Opción ${oi + 1}`}
              onChange={(e) => { const opts = [...(q.options ?? ["", "", "", ""])]; opts[oi] = e.target.value; updateQuestion({ options: opts }); }}
              style={{ padding: "10px 14px", borderRadius: "8px", border: q.answer === opt && opt ? "2px solid #10b981" : "1px solid #e2e8f0", outline: "none", fontSize: "0.95rem" }} />
          ))}
          <select value={q.answer ?? ""} onChange={(e) => updateQuestion({ answer: e.target.value })} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", color: "#10b981", fontWeight: "700", fontSize: "0.85rem" }}>
            <option value="">Marcar opción correcta...</option>
            {(q.options ?? []).filter((o: string) => o).map((o: string, oi: number) => <option key={oi} value={o}>{o}</option>)}
          </select>
        </div>
      )}

      {q.type === 'true_false' && (
        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
          {["Verdadero", "Falso"].map(opt => (
            <button key={opt} onClick={() => updateQuestion({ answer: opt })} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: q.answer === opt ? "2px solid #10b981" : "1px solid #e2e8f0", backgroundColor: q.answer === opt ? "#f0fdf4" : "white", color: q.answer === opt ? "#166534" : "#64748b", fontWeight: "700", cursor: "pointer" }}>{opt}</button>
          ))}
        </div>
      )}

      {q.type === 'open' && (
        <textarea value={q.answer ?? ""} onChange={(e) => updateQuestion({ answer: e.target.value })} placeholder="Guía de evaluación para la IA (conceptos clave que debe mencionar el alumno)..." rows={2} style={{ width: "100%", marginTop: "12px", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none", resize: "none" }} />
      )}

      {q.type === 'matching' && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(q.left ?? ["", "", ""]).map((l: string, li: number) => (
              <input key={li} value={l} placeholder={`Concepto ${li + 1}`}
                onChange={(e) => { const left = [...(q.left ?? ["", "", ""])]; left[li] = e.target.value; updateQuestion({ left }); }}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem" }} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(q.right ?? ["", "", ""]).map((r: string, ri: number) => (
              <input key={ri} value={r} placeholder={`Definición ${ri + 1}`}
                onChange={(e) => { const right = [...(q.right ?? ["", "", ""])]; right[ri] = e.target.value; updateQuestion({ right }); }}
                style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.9rem" }} />
            ))}
          </div>
          <p style={{ gridColumn: "1 / -1", fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>El orden de cada columna define la pareja correcta (concepto 1 ↔ definición 1, etc.). La IA puede generar esto directamente desde el prompt o el archivo.</p>
        </div>
      )}

      {q.type === 'short_answer' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>Respuestas aceptadas (cualquiera de estas cuenta como correcta):</p>
          {(q.options ?? [""]).map((opt: string, oi: number) => (
            <div key={oi} style={{ display: "flex", gap: "6px" }}>
              <input value={opt} placeholder={`Respuesta aceptada ${oi + 1}`}
                onChange={(e) => { const opts = [...(q.options ?? [""])]; opts[oi] = e.target.value; updateQuestion({ options: opts }); }}
                style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.95rem" }} />
              {(q.options ?? [""]).length > 1 && (
                <button onClick={() => updateQuestion({ options: (q.options ?? [""]).filter((_: string, i: number) => i !== oi) })} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer" }}><X size={16} /></button>
              )}
            </div>
          ))}
          <button onClick={() => updateQuestion({ options: [...(q.options ?? [""]), ""] })} style={{ alignSelf: "flex-start", border: "1px dashed #cbd5e1", borderRadius: "8px", background: "white", color: "#1B396A", fontWeight: "700", fontSize: "0.8rem", padding: "6px 12px", cursor: "pointer" }}>+ Agregar variante aceptada</button>
        </div>
      )}

      {q.type === 'fill_blank' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>Escribe el enunciado arriba usando &quot;___&quot; para cada espacio, y aquí la respuesta correcta de cada uno, en orden:</p>
          {(q.options ?? [""]).map((opt: string, oi: number) => (
            <div key={oi} style={{ display: "flex", gap: "6px" }}>
              <input value={opt} placeholder={`Espacio ${oi + 1}`}
                onChange={(e) => { const opts = [...(q.options ?? [""])]; opts[oi] = e.target.value; updateQuestion({ options: opts }); }}
                style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.95rem" }} />
              {(q.options ?? [""]).length > 1 && (
                <button onClick={() => updateQuestion({ options: (q.options ?? [""]).filter((_: string, i: number) => i !== oi) })} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer" }}><X size={16} /></button>
              )}
            </div>
          ))}
          <button onClick={() => updateQuestion({ options: [...(q.options ?? [""]), ""] })} style={{ alignSelf: "flex-start", border: "1px dashed #cbd5e1", borderRadius: "8px", background: "white", color: "#1B396A", fontWeight: "700", fontSize: "0.8rem", padding: "6px 12px", cursor: "pointer" }}>+ Agregar espacio</button>
        </div>
      )}

      {q.type === 'ordering' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>Orden correcto (el alumno los verá revueltos y deberá ordenarlos así):</p>
          {(q.options ?? ["", "", ""]).map((opt: string, oi: number) => {
            const opts = q.options ?? ["", "", ""];
            return (
              <div key={oi} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: "900", color: "#94a3b8", width: "16px" }}>{oi + 1}.</span>
                <input value={opt} placeholder={`Elemento ${oi + 1}`}
                  onChange={(e) => { const next = [...opts]; next[oi] = e.target.value; updateQuestion({ options: next }); }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "0.95rem" }} />
                <button disabled={oi === 0} onClick={() => { const next = [...opts]; [next[oi - 1], next[oi]] = [next[oi], next[oi - 1]]; updateQuestion({ options: next }); }}
                  style={{ border: "none", background: "none", color: oi === 0 ? "#cbd5e1" : "#64748b", cursor: oi === 0 ? "default" : "pointer", padding: 0 }}><ChevronUp size={16} /></button>
                <button disabled={oi === opts.length - 1} onClick={() => { const next = [...opts]; [next[oi], next[oi + 1]] = [next[oi + 1], next[oi]]; updateQuestion({ options: next }); }}
                  style={{ border: "none", background: "none", color: oi === opts.length - 1 ? "#cbd5e1" : "#64748b", cursor: oi === opts.length - 1 ? "default" : "pointer", padding: 0 }}><ChevronDown size={16} /></button>
                {opts.length > 2 && (
                  <button onClick={() => updateQuestion({ options: opts.filter((_: string, i: number) => i !== oi) })} style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", padding: 0 }}><X size={16} /></button>
                )}
              </div>
            );
          })}
          <button onClick={() => updateQuestion({ options: [...(q.options ?? ["", "", ""]), ""] })} style={{ alignSelf: "flex-start", border: "1px dashed #cbd5e1", borderRadius: "8px", background: "white", color: "#1B396A", fontWeight: "700", fontSize: "0.8rem", padding: "6px 12px", cursor: "pointer" }}>+ Agregar elemento</button>
        </div>
      )}

      {q.type === 'multi_select' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>Marca todas las opciones correctas (puede haber más de una):</p>
          {(q.options ?? ["", "", "", ""]).map((opt: string, oi: number) => {
            const isCorrect = !!opt && (q.correct ?? []).includes(opt);
            return (
              <div key={oi} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input type="checkbox" checked={isCorrect} onChange={(e) => {
                  const current = (q.correct ?? []) as string[];
                  const next = e.target.checked ? [...current, opt] : current.filter((c) => c !== opt);
                  updateQuestion({ correct: next });
                }} />
                <input value={opt} placeholder={`Opción ${oi + 1}`}
                  onChange={(e) => {
                    const opts = [...(q.options ?? ["", "", "", ""])];
                    const oldVal = opts[oi];
                    opts[oi] = e.target.value;
                    const correct = ((q.correct ?? []) as string[]).map((c) => c === oldVal ? e.target.value : c);
                    updateQuestion({ options: opts, correct });
                  }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: isCorrect ? "2px solid #10b981" : "1px solid #e2e8f0", outline: "none", fontSize: "0.95rem" }} />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
        <ExpandingButton icon={Trash2} label="Eliminar" onClick={onDelete} variant="danger" small smallSize={36} radius={12} gap={8} padding="0 14px" fontWeight={600} durationMs={300} colors={{ bg: "#fee2e2", hoverBg: "#ef4444", text: "#ef4444", hoverText: "white", border: "transparent" }} />
      </div>
    </div>
  );
};
