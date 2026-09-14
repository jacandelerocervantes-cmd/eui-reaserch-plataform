"use client";

import { useState } from "react";
import {
  Sparkles, Trash2, Maximize2, Minimize2, Check,
  ChevronUp, ChevronDown, X, Loader2
} from "lucide-react";
import { TYPE_LABELS } from "../../_components/constants";
import type { EditQuestion } from "../../_components/questionMapping";

export type ExamQuestionCardProps = {
  question: EditQuestion;
  index: number;
  onUpdate: (patch: Partial<EditQuestion>) => void;
  onDelete: () => void;
  onRegenerate: (instruction?: string, difficulty?: string) => Promise<void>;
  isRegenerating?: boolean;
};

const DIFFICULTY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  basica:     { label: "Básica", color: "#16a34a", bg: "#f0fdf4" },
  intermedia: { label: "Intermedia", color: "#d97706", bg: "#fffbeb" },
  avanzada:   { label: "Avanzada", color: "#dc2626", bg: "#fef2f2" },
};

function getDifficultyKey(bloom?: string | null): string {
  const b = (bloom ?? "").toLowerCase();
  if (b.includes("recordar") || b.includes("comprender") || b.includes("básica") || b.includes("basica")) return "basica";
  if (b.includes("evaluar") || b.includes("crear") || b.includes("avanzada")) return "avanzada";
  return "intermedia";
}

export default function ExamQuestionCard({
  question: q,
  index: idx,
  onUpdate,
  onDelete,
  onRegenerate,
  isRegenerating = false,
}: ExamQuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);
  const [customRegenPrompt, setCustomRegenPrompt] = useState("");

  const currentDiffKey = getDifficultyKey(q.bloom);
  const diffInfo = DIFFICULTY_MAP[currentDiffKey] ?? DIFFICULTY_MAP.intermedia;

  const cycleDifficulty = async () => {
    const nextKey = currentDiffKey === "basica" ? "intermedia" : currentDiffKey === "intermedia" ? "avanzada" : "basica";
    const nextBloom = nextKey === "basica" ? "Comprender" : nextKey === "avanzada" ? "Evaluar" : "Aplicar";
    onUpdate({ bloom: nextBloom });
    await onRegenerate(`Ajusta el nivel de dificultad a ${nextKey} (${nextBloom}) manteniendo el tema.`, nextKey);
  };

  const handleQuickRegenerate = async () => {
    await onRegenerate(customRegenPrompt.trim() || undefined, currentDiffKey);
    setShowRegenPrompt(false);
    setCustomRegenPrompt("");
  };

  return (
    <div style={{
      backgroundColor: "white",
      borderRadius: "16px",
      border: "1px solid #e2e8f0",
      boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
      overflow: "hidden",
      transition: "border-color 0.2s, box-shadow 0.2s",
    }}>
      {/* ── BARRA SUPERIOR / ENCABEZADO ───────────────────────────── */}
      <div style={{
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: isExpanded ? "#f8fafc" : "white",
        borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
        gap: "10px",
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{
            backgroundColor: "#1B396A", color: "white",
            width: "28px", height: "28px", borderRadius: "8px",
            display: "flex", justifyContent: "center", alignItems: "center",
            fontWeight: "900", fontSize: "0.85rem", flexShrink: 0,
          }}>
            {idx + 1}
          </div>

          <select
            value={q.type}
            onChange={(e) => onUpdate({ type: e.target.value })}
            style={{
              fontSize: "0.75rem", fontWeight: "800", color: "#1B396A",
              border: "1px solid #cbd5e1", borderRadius: "8px", padding: "4px 8px",
              backgroundColor: "white", cursor: "pointer",
            }}
          >
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {/* Dificultad individual */}
          <button
            type="button"
            onClick={cycleDifficulty}
            disabled={isRegenerating}
            title="Clic para cambiar dificultad de este reactivo"
            style={{
              fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase",
              padding: "4px 8px", borderRadius: "8px",
              border: `1px solid ${diffInfo.color}30`,
              backgroundColor: diffInfo.bg, color: diffInfo.color,
              cursor: isRegenerating ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: "4px",
            }}
          >
            ● {diffInfo.label} {q.bloom ? `(${q.bloom})` : ""}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* PUNTOS */}
          <div style={{
            display: "flex", alignItems: "center", gap: "4px",
            backgroundColor: "#f8fafc", padding: "3px 8px", borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}>
            <span style={{ fontSize: "0.65rem", fontWeight: "900", color: "#64748b" }}>PTS:</span>
            <input
              type="number"
              value={q.points}
              onChange={(e) => onUpdate({ points: e.target.value })}
              style={{
                width: "40px", border: "none", background: "transparent",
                fontWeight: "900", color: "#1B396A", textAlign: "center",
                outline: "none", fontSize: "0.85rem",
              }}
            />
          </div>

          {/* BOTÓN REGENERAR PREGUNTA INDIVIDUAL */}
          <button
            type="button"
            onClick={() => setShowRegenPrompt(!showRegenPrompt)}
            disabled={isRegenerating}
            title="Regenerar o ajustar este reactivo con IA"
            style={{
              padding: "6px 10px", borderRadius: "8px", border: "1px solid #cbd5e1",
              backgroundColor: showRegenPrompt ? "#1B396A" : "white",
              color: showRegenPrompt ? "white" : "#1B396A",
              cursor: isRegenerating ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: "5px",
              fontSize: "0.75rem", fontWeight: "700",
            }}
          >
            {isRegenerating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            Regenerar
          </button>

          {/* BOTÓN EXPANDIR / CONTRAER */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Contraer reactivo" : "Expandir para ver opciones y respuesta"}
            style={{
              padding: "6px 8px", borderRadius: "8px", border: "1px solid #cbd5e1",
              backgroundColor: "white", color: "#64748b", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* ELIMINAR */}
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar este reactivo"
            style={{
              padding: "6px", borderRadius: "8px", border: "none",
              backgroundColor: "#fee2e2", color: "#ef4444", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── MODAL / PROMPT RÁPIDO DE REGENERACIÓN ───────────────────── */}
      {showRegenPrompt && (
        <div style={{
          padding: "10px 16px", backgroundColor: "#f0fdf4",
          borderBottom: "1px solid #bbf7d0", display: "flex", gap: "8px", alignItems: "center",
        }}>
          <input
            type="text"
            placeholder="Instrucción de ajuste (ej: 'cambia las opciones', 'hazla más práctica') o déjalo vacío..."
            value={customRegenPrompt}
            onChange={(e) => setCustomRegenPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleQuickRegenerate(); }}
            style={{
              flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #86efac",
              fontSize: "0.85rem", outline: "none",
            }}
          />
          <button
            type="button"
            onClick={handleQuickRegenerate}
            disabled={isRegenerating}
            style={{
              padding: "6px 12px", borderRadius: "6px", border: "none",
              backgroundColor: "#16a34a", color: "white", fontWeight: "700",
              fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
            }}
          >
            {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => setShowRegenPrompt(false)}
            style={{
              background: "none", border: "none", color: "#64748b", cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── CUERPO DEL REACTIVO ────────────────────────────────────── */}
      <div style={{ padding: "14px 16px" }}>
        {/* ENUNCIADO (Colapsado: preview / Expandido: textarea editable) */}
        {isExpanded ? (
          <div>
            <label style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
              Enunciado de la pregunta:
            </label>
            <textarea
              value={q.content}
              onChange={(e) => onUpdate({ content: e.target.value })}
              placeholder="Escribe el enunciado técnico del reactivo..."
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: "8px",
                border: "1px solid #cbd5e1", outline: "none",
                fontSize: "0.95rem", fontWeight: "700", color: "#1B396A",
                fontFamily: "inherit", resize: "vertical",
              }}
            />
          </div>
        ) : (
          <div
            onClick={() => setIsExpanded(true)}
            style={{
              cursor: "pointer", color: "#1B396A", fontWeight: "700",
              fontSize: "0.95rem", lineHeight: 1.5,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title="Haz clic para expandir y editar"
          >
            {q.content || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin enunciado redactado...</span>}
          </div>
        )}

        {/* CONTENIDO INTERACTIVO SEGÚN TIPO (SOLO EXPANDIDO) */}
        {isExpanded && (
          <div style={{ marginTop: "14px" }}>
            {/* OPCIÓN MÚLTIPLE */}
            {q.type === "multiple_choice" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b" }}>OPCIONES Y RESPUESTA CORRECTA:</span>
                {(q.options ?? ["", "", "", ""]).map((opt: string, oi: number) => {
                  const isCorrect = q.answer === opt && opt !== "";
                  return (
                    <div key={oi} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => onUpdate({ answer: opt })}
                        title={isCorrect ? "Respuesta correcta seleccionada" : "Marcar como respuesta correcta"}
                        style={{
                          width: "24px", height: "24px", borderRadius: "50%",
                          border: isCorrect ? "2px solid #10b981" : "2px solid #cbd5e1",
                          backgroundColor: isCorrect ? "#10b981" : "white",
                          color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        {isCorrect && <Check size={14} />}
                      </button>
                      <input
                        value={opt}
                        placeholder={`Opción ${oi + 1}`}
                        onChange={(e) => {
                          const opts = [...(q.options ?? ["", "", "", ""])];
                          const old = opts[oi];
                          opts[oi] = e.target.value;
                          const newAnswer = q.answer === old ? e.target.value : q.answer;
                          onUpdate({ options: opts, answer: newAnswer });
                        }}
                        style={{
                          flex: 1, padding: "8px 12px", borderRadius: "8px",
                          border: isCorrect ? "2px solid #10b981" : "1px solid #e2e8f0",
                          outline: "none", fontSize: "0.9rem",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* VERDADERO / FALSO */}
            {q.type === "true_false" && (
              <div style={{ display: "flex", gap: "10px" }}>
                {["Verdadero", "Falso"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onUpdate({ answer: opt })}
                    style={{
                      flex: 1, padding: "10px", borderRadius: "8px",
                      border: q.answer === opt ? "2px solid #10b981" : "1px solid #e2e8f0",
                      backgroundColor: q.answer === opt ? "#f0fdf4" : "white",
                      color: q.answer === opt ? "#166534" : "#64748b",
                      fontWeight: "700", cursor: "pointer",
                    }}
                  >
                    {opt} {q.answer === opt ? "✓ (Correcta)" : ""}
                  </button>
                ))}
              </div>
            )}

            {/* PREGUNTA ABIERTA */}
            {q.type === "open" && (
              <div>
                <label style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>
                  Guía de Evaluación Docente / Criterios esperados:
                </label>
                <textarea
                  value={q.answer ?? ""}
                  onChange={(e) => onUpdate({ answer: e.target.value })}
                  placeholder="Describe los conceptos teóricos o metodológicos que debe responder el estudiante..."
                  rows={2}
                  style={{
                    width: "100%", marginTop: "6px", padding: "8px 12px", borderRadius: "8px",
                    border: "1px solid #e2e8f0", fontSize: "0.85rem", outline: "none", resize: "vertical",
                  }}
                />
              </div>
            )}

            {/* RELACIÓN DE COLUMNAS */}
            {q.type === "matching" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b" }}>COLUMNA A (CONCEPTOS):</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                    {(q.left ?? ["", "", ""]).map((l: string, li: number) => (
                      <input
                        key={li}
                        value={l}
                        placeholder={`Concepto ${li + 1}`}
                        onChange={(e) => {
                          const left = [...(q.left ?? ["", "", ""])];
                          left[li] = e.target.value;
                          onUpdate({ left });
                        }}
                        style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", outline: "none" }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b" }}>COLUMNA B (DEFINICIONES EN PAREJA):</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                    {(q.right ?? ["", "", ""]).map((r: string, ri: number) => (
                      <input
                        key={ri}
                        value={r}
                        placeholder={`Definición correspondiente ${ri + 1}`}
                        onChange={(e) => {
                          const right = [...(q.right ?? ["", "", ""])];
                          right[ri] = e.target.value;
                          onUpdate({ right });
                        }}
                        style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", outline: "none" }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* RESPUESTA CORTA */}
            {q.type === "short_answer" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b" }}>RESPUESTAS EXACTAS ACEPTADAS:</span>
                {(q.options ?? [""]).map((opt: string, oi: number) => (
                  <div key={oi} style={{ display: "flex", gap: "6px" }}>
                    <input
                      value={opt}
                      placeholder={`Respuesta válida ${oi + 1}`}
                      onChange={(e) => {
                        const opts = [...(q.options ?? [""])];
                        opts[oi] = e.target.value;
                        onUpdate({ options: opts });
                      }}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", outline: "none" }}
                    />
                    {(q.options ?? [""]).length > 1 && (
                      <button
                        type="button"
                        onClick={() => onUpdate({ options: (q.options ?? [""]).filter((_, i) => i !== oi) })}
                        style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer" }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onUpdate({ options: [...(q.options ?? [""]), ""] })}
                  style={{ alignSelf: "flex-start", border: "1px dashed #cbd5e1", borderRadius: "6px", background: "white", color: "#1B396A", fontWeight: "700", fontSize: "0.75rem", padding: "4px 10px", cursor: "pointer" }}
                >
                  + Agregar variante
                </button>
              </div>
            )}

            {/* COMPLETAR ESPACIOS */}
            {q.type === "fill_blank" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b" }}>PALABRAS POR ESPACIO (EN ORDEN DE APARICIÓN):</span>
                {(q.options ?? [""]).map((opt: string, oi: number) => (
                  <div key={oi} style={{ display: "flex", gap: "6px" }}>
                    <input
                      value={opt}
                      placeholder={`Hueco ${oi + 1}`}
                      onChange={(e) => {
                        const opts = [...(q.options ?? [""])];
                        opts[oi] = e.target.value;
                        onUpdate({ options: opts });
                      }}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", outline: "none" }}
                    />
                    {(q.options ?? [""]).length > 1 && (
                      <button
                        type="button"
                        onClick={() => onUpdate({ options: (q.options ?? [""]).filter((_, i) => i !== oi) })}
                        style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer" }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ORDENAR */}
            {q.type === "ordering" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b" }}>SECUENCIA EN SU ORDEN CORRECTO:</span>
                {(q.options ?? ["", "", ""]).map((opt: string, oi: number) => {
                  const opts = q.options ?? ["", "", ""];
                  return (
                    <div key={oi} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: "900", color: "#94a3b8", width: "16px" }}>{oi + 1}.</span>
                      <input
                        value={opt}
                        placeholder={`Elemento ${oi + 1}`}
                        onChange={(e) => {
                          const next = [...opts];
                          next[oi] = e.target.value;
                          onUpdate({ options: next });
                        }}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.85rem", outline: "none" }}
                      />
                      <button
                        type="button"
                        disabled={oi === 0}
                        onClick={() => {
                          const next = [...opts];
                          [next[oi - 1], next[oi]] = [next[oi], next[oi - 1]];
                          onUpdate({ options: next });
                        }}
                        style={{ border: "none", background: "none", color: oi === 0 ? "#cbd5e1" : "#64748b", cursor: oi === 0 ? "default" : "pointer" }}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={oi === opts.length - 1}
                        onClick={() => {
                          const next = [...opts];
                          [next[oi], next[oi + 1]] = [next[oi + 1], next[oi]];
                          onUpdate({ options: next });
                        }}
                        style={{ border: "none", background: "none", color: oi === opts.length - 1 ? "#cbd5e1" : "#64748b", cursor: oi === opts.length - 1 ? "default" : "pointer" }}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SELECCIÓN MÚLTIPLE */}
            {q.type === "multi_select" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b" }}>MARCA LAS OPCIONES CORRECTAS (PUEDEN SER VARIAS):</span>
                {(q.options ?? ["", "", "", ""]).map((opt: string, oi: number) => {
                  const isCorrect = !!opt && (q.correct ?? []).includes(opt);
                  return (
                    <div key={oi} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={isCorrect}
                        onChange={(e) => {
                          const current = (q.correct ?? []) as string[];
                          const next = e.target.checked ? [...current, opt] : current.filter((c) => c !== opt);
                          onUpdate({ correct: next });
                        }}
                      />
                      <input
                        value={opt}
                        placeholder={`Opción ${oi + 1}`}
                        onChange={(e) => {
                          const opts = [...(q.options ?? ["", "", "", ""])];
                          const oldVal = opts[oi];
                          opts[oi] = e.target.value;
                          const correct = ((q.correct ?? []) as string[]).map((c) => c === oldVal ? e.target.value : c);
                          onUpdate({ options: opts, correct });
                        }}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: isCorrect ? "2px solid #10b981" : "1px solid #e2e8f0", fontSize: "0.85rem", outline: "none" }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

