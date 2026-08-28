"use client";

import { useState } from "react";
import {
  Trophy, X, ChevronLeft, ChevronRight, LayoutList,
  Layers, CheckCircle2, BookOpen, Clock, AlertCircle, HelpCircle
} from "lucide-react";
import { TYPE_LABELS } from "../../_components/constants";
import type { EditQuestion } from "../../_components/questionMapping";

export default function SimulacionModal({
  questions,
  onClose,
  examTitle = "Examen de Prueba",
  durationMinutes = 60,
}: {
  questions: EditQuestion[];
  onClose: () => void;
  examTitle?: string;
  durationMinutes?: number;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"single" | "all">("all");
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [isFinished, setIsFinished] = useState(false);

  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  const answeredCount = Object.keys(answers).filter((k) => {
    const val = answers[Number(k)];
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object") return Object.keys(val).length > 0;
    return true;
  }).length;

  const currentQ = questions[currentIdx];

  const handleAnswer = (qIdx: number, val: unknown) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: val }));
  };

  const renderAnswerArea = (q: EditQuestion, qIdx: number) => {
    const currentAnswer = answers[qIdx];

    // 1. OPCIÓN MÚLTIPLE / VERDADERO O FALSO
    if (q.type === "multiple_choice" || q.type === "true_false") {
      const opts = q.type === "true_false" ? ["Verdadero", "Falso"] : (q.options ?? []);
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {opts.map((opt, i) => {
            const isSelected = currentAnswer === opt;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleAnswer(qIdx, opt)}
                style={{
                  textAlign: "left",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  border: `2px solid ${isSelected ? "#1B396A" : "#e2e8f0"}`,
                  backgroundColor: isSelected ? "#eff6ff" : "white",
                  color: isSelected ? "#1B396A" : "#334155",
                  fontWeight: isSelected ? "700" : "600",
                  fontSize: "1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  transition: "all 0.15s ease",
                  outline: "none",
                }}
              >
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: `2px solid ${isSelected ? "#1B396A" : "#cbd5e1"}`,
                    backgroundColor: isSelected ? "#1B396A" : "transparent",
                    color: isSelected ? "white" : "#94a3b8",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: "900",
                    flexShrink: 0,
                  }}
                >
                  {isSelected ? "✓" : String.fromCharCode(65 + i)}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      );
    }

    // 2. SELECCIÓN MÚLTIPLE
    if (q.type === "multi_select") {
      const selected: string[] = Array.isArray(currentAnswer) ? (currentAnswer as string[]) : [];
      const opts = q.options ?? [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {opts.map((opt, i) => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const next = isSelected ? selected.filter((s) => s !== opt) : [...selected, opt];
                  handleAnswer(qIdx, next);
                }}
                style={{
                  textAlign: "left",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  border: `2px solid ${isSelected ? "#1B396A" : "#e2e8f0"}`,
                  backgroundColor: isSelected ? "#eff6ff" : "white",
                  color: isSelected ? "#1B396A" : "#334155",
                  fontWeight: isSelected ? "700" : "600",
                  fontSize: "1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  transition: "all 0.15s ease",
                  outline: "none",
                }}
              >
                <span
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    border: `2px solid ${isSelected ? "#1B396A" : "#cbd5e1"}`,
                    backgroundColor: isSelected ? "#1B396A" : "transparent",
                    color: "white",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: "900",
                    flexShrink: 0,
                  }}
                >
                  {isSelected ? "✓" : ""}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
          <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "4px 0 0 4px", fontWeight: "600" }}>
            * Puede seleccionarse más de una opción.
          </p>
        </div>
      );
    }

    // 3. RELACIÓN DE COLUMNAS
    if (q.type === "matching") {
      const mapa = (currentAnswer as Record<number, string> | undefined) ?? {};
      const leftItems = q.left ?? [];
      const rightItems = q.right ?? [];
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {leftItems.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: "14px 18px",
                  borderRadius: "12px",
                  border: "2px solid #f1f5f9",
                  backgroundColor: "#f8fafc",
                  fontWeight: "700",
                  color: "#1B396A",
                  fontSize: "0.95rem",
                }}
              >
                {i + 1}. {item}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {leftItems.map((_, i) => (
              <select
                key={i}
                value={mapa[i] ?? ""}
                onChange={(e) => handleAnswer(qIdx, { ...mapa, [i]: e.target.value })}
                style={{
                  padding: "14px 18px",
                  borderRadius: "12px",
                  border: "2px solid #e2e8f0",
                  backgroundColor: "white",
                  color: "#334155",
                  fontWeight: "600",
                  fontSize: "0.95rem",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Selecciona la definición correspondiente...</option>
                {rightItems.map((r, ri) => (
                  <option key={ri} value={ri}>
                    {String.fromCharCode(65 + ri)}. {r}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </div>
      );
    }

    // 4. ORDENAR / SECUENCIAR
    if (q.type === "ordering") {
      const order: string[] = Array.isArray(currentAnswer) ? (currentAnswer as string[]) : (q.options ?? []);
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {order.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "14px 18px",
                borderRadius: "12px",
                border: "2px solid #e2e8f0",
                backgroundColor: "white",
              }}
            >
              <span style={{ fontWeight: "900", color: "#1B396A", fontSize: "1rem" }}>{i + 1}.</span>
              <span style={{ flex: 1, fontWeight: "600", color: "#334155", fontSize: "0.95rem" }}>{item}</span>
              <button
                type="button"
                disabled={i === 0}
                onClick={() => {
                  const next = [...order];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  handleAnswer(qIdx, next);
                }}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  backgroundColor: i === 0 ? "#f8fafc" : "#eff6ff",
                  cursor: i === 0 ? "default" : "pointer",
                  color: i === 0 ? "#cbd5e1" : "#1B396A",
                  fontWeight: "800",
                }}
              >
                ▲
              </button>
              <button
                type="button"
                disabled={i === order.length - 1}
                onClick={() => {
                  const next = [...order];
                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                  handleAnswer(qIdx, next);
                }}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  backgroundColor: i === order.length - 1 ? "#f8fafc" : "#eff6ff",
                  cursor: i === order.length - 1 ? "default" : "pointer",
                  color: i === order.length - 1 ? "#cbd5e1" : "#1B396A",
                  fontWeight: "800",
                }}
              >
                ▼
              </button>
            </div>
          ))}
          <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "4px 0 0 4px", fontWeight: "600" }}>
            * Usa las flechas para ordenar los pasos del 1 al último.
          </p>
        </div>
      );
    }

    // 5. RESPUESTA CORTA
    if (q.type === "short_answer") {
      return (
        <input
          type="text"
          value={(currentAnswer as string) || ""}
          onChange={(e) => handleAnswer(qIdx, e.target.value)}
          placeholder="Escribe tu respuesta aquí..."
          style={{
            width: "100%",
            borderRadius: "14px",
            border: "2px solid #e2e8f0",
            padding: "16px 20px",
            fontSize: "1rem",
            outline: "none",
            backgroundColor: "white",
            fontFamily: "inherit",
          }}
        />
      );
    }

    // 6. COMPLETAR ESPACIOS
    if (q.type === "fill_blank") {
      const blanksCount = q.options?.length || (q.content.match(/___/g) || []).length || 1;
      const given: string[] = Array.isArray(currentAnswer) ? (currentAnswer as string[]) : [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Array.from({ length: blanksCount }).map((_, i) => (
            <input
              key={i}
              value={given[i] ?? ""}
              placeholder={`Espacio en blanco ${i + 1}...`}
              onChange={(e) => {
                const next = [...given];
                next[i] = e.target.value;
                handleAnswer(qIdx, next);
              }}
              style={{
                width: "100%",
                borderRadius: "12px",
                border: "2px solid #e2e8f0",
                padding: "14px 18px",
                fontSize: "1rem",
                outline: "none",
                fontFamily: "inherit",
                backgroundColor: "white",
              }}
            />
          ))}
        </div>
      );
    }

    // 7. PREGUNTA ABIERTA (DESARROLLO)
    return (
      <textarea
        value={(currentAnswer as string) || ""}
        onChange={(e) => handleAnswer(qIdx, e.target.value)}
        placeholder="Escribe tu análisis o desarrollo argumentativo aquí..."
        style={{
          width: "100%",
          height: "160px",
          padding: "16px 20px",
          borderRadius: "14px",
          border: "2px solid #e2e8f0",
          resize: "vertical",
          fontFamily: "inherit",
          fontSize: "1rem",
          outline: "none",
          backgroundColor: "white",
          lineHeight: "1.6",
        }}
      />
    );
  };

  if (isFinished) {
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "#F8FAFC", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", padding: "40px" }}>
        <div style={{ maxWidth: "600px", width: "100%", backgroundColor: "white", padding: "40px", borderRadius: "24px", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "#dbeafe", color: "#1B396A", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Trophy size={44} />
          </div>
          <h2 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "900", margin: "0 0 8px 0" }}>¡Vista Previa Completada!</h2>
          <p style={{ color: "#64748b", fontSize: "0.95rem", margin: "0 0 24px 0", lineHeight: "1.5" }}>
            Has respondido <strong>{answeredCount} de {questions.length} reactivos</strong> ({totalPoints} puntos totales).
          </p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => setIsFinished(false)}
              style={{ padding: "12px 24px", borderRadius: "12px", border: "2px solid #e2e8f0", backgroundColor: "white", color: "#1B396A", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem" }}
            >
              Volver a Revisar
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "12px 28px", borderRadius: "12px", border: "none", backgroundColor: "#1B396A", color: "white", fontWeight: "800", cursor: "pointer", fontSize: "0.95rem" }}
            >
              Cerrar Vista Previa
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "#F8FAFC", zIndex: 9999, display: "flex", flexDirection: "column" }}>
      {/* ── HEADER DE VISTA PREVIA ── */}
      <header style={{ backgroundColor: "white", padding: "16px 32px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ backgroundColor: "#1B396A", color: "white", padding: "8px 14px", borderRadius: "10px", fontWeight: "900", fontSize: "0.85rem" }}>
            VISTA PREVIA
          </div>
          <div>
            <h2 style={{ color: "#1B396A", margin: 0, fontSize: "1.15rem", fontWeight: "800" }}>{examTitle}</h2>
            <p style={{ color: "#64748b", margin: 0, fontSize: "0.8rem", fontWeight: "600" }}>
              {questions.length} reactivos · {totalPoints} pts · {durationMinutes} min límite
            </p>
          </div>
        </div>

        {/* SELECTOR DE MODO DE VISTA */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", backgroundColor: "#f1f5f9", padding: "4px", borderRadius: "10px", gap: "4px" }}>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: viewMode === "all" ? "white" : "transparent",
                color: viewMode === "all" ? "#1B396A" : "#64748b",
                fontWeight: "700",
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: viewMode === "all" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              }}
            >
              <LayoutList size={16} /> Ver Todos los Reactivos
            </button>
            <button
              type="button"
              onClick={() => setViewMode("single")}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: viewMode === "single" ? "white" : "transparent",
                color: viewMode === "single" ? "#1B396A" : "#64748b",
                fontWeight: "700",
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: viewMode === "single" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              }}
            >
              <Layers size={16} /> Uno por Uno
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFinished(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontWeight: "700",
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <CheckCircle2 size={16} /> Finalizar Simulación
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              backgroundColor: "#f1f5f9",
              color: "#64748b",
              border: "none",
              borderRadius: "10px",
              fontWeight: "700",
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <X size={16} /> Cerrar
          </button>
        </div>
      </header>

      {/* ── CUERPO PRINCIPAL ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* SIDEBAR NAVEGADOR DE REACTIVOS */}
        <aside style={{ width: "280px", backgroundColor: "white", borderRight: "1px solid #e2e8f0", padding: "24px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>
          <div>
            <h4 style={{ margin: "0 0 6px 0", color: "#1B396A", fontSize: "0.9rem", fontWeight: "800", textTransform: "uppercase" }}>Mapa del Examen</h4>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem" }}>
              Respondidos: <strong>{answeredCount} de {questions.length}</strong>
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            {questions.map((_, i) => {
              const hasAns = answers[i] !== undefined && answers[i] !== null && answers[i] !== "";
              const isCurrent = viewMode === "single" && currentIdx === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setCurrentIdx(i);
                    if (viewMode === "all") {
                      const el = document.getElementById(`reactivo-card-${i}`);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  style={{
                    height: "44px",
                    borderRadius: "10px",
                    border: `2px solid ${isCurrent ? "#1B396A" : hasAns ? "#10b981" : "#e2e8f0"}`,
                    backgroundColor: isCurrent ? "#1B396A" : hasAns ? "#ecfdf5" : "white",
                    color: isCurrent ? "white" : hasAns ? "#059669" : "#64748b",
                    fontWeight: "800",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: "auto", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1B396A", fontWeight: "700", fontSize: "0.85rem", marginBottom: "6px" }}>
              <Clock size={16} /> Tiempo estimado
            </div>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem" }}>
              Aprox. {Math.round(durationMinutes / (questions.length || 1))} min por reactivo
            </p>
          </div>
        </aside>

        {/* CONTENEDOR DE REACTIVOS */}
        <main style={{ flex: 1, overflowY: "auto", padding: "40px", backgroundColor: "#F8FAFC" }}>
          <div style={{ maxWidth: "820px", margin: "0 auto" }}>
            {/* ── MODO 1: VER TODOS LOS REACTIVOS (SCROLL CONTINUO) ── */}
            {viewMode === "all" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "60px" }}>
                {questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    id={`reactivo-card-${qIdx}`}
                    style={{
                      backgroundColor: "white",
                      borderRadius: "20px",
                      border: "1px solid #e2e8f0",
                      padding: "32px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", backgroundColor: "#f1f5f9", padding: "4px 10px", borderRadius: "8px" }}>
                        Reactivo {qIdx + 1} · {TYPE_LABELS[q.type] ?? q.type}
                      </span>
                      <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#1B396A", backgroundColor: "#eff6ff", padding: "4px 10px", borderRadius: "8px" }}>
                        {q.points} {Number(q.points) === 1 ? "punto" : "puntos"}
                      </span>
                    </div>

                    <h3 style={{ color: "#1B396A", fontSize: "1.2rem", fontWeight: "800", margin: "0 0 24px 0", lineHeight: "1.5" }}>
                      {q.content}
                    </h3>

                    {renderAnswerArea(q, qIdx)}
                  </div>
                ))}
              </div>
            ) : (
              /* ── MODO 2: UNO POR UNO (PAGINADO) ── */
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "24px",
                    border: "1px solid #e2e8f0",
                    padding: "40px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", backgroundColor: "#f1f5f9", padding: "6px 12px", borderRadius: "8px" }}>
                      Reactivo {currentIdx + 1} de {questions.length} · {TYPE_LABELS[currentQ?.type] ?? currentQ?.type}
                    </span>
                    <span style={{ fontSize: "0.9rem", fontWeight: "800", color: "#1B396A", backgroundColor: "#eff6ff", padding: "6px 12px", borderRadius: "8px" }}>
                      {currentQ?.points} {Number(currentQ?.points) === 1 ? "punto" : "puntos"}
                    </span>
                  </div>

                  <h2 style={{ color: "#1B396A", fontSize: "1.35rem", fontWeight: "800", margin: "0 0 32px 0", lineHeight: "1.5" }}>
                    {currentQ?.content}
                  </h2>

                  {currentQ && renderAnswerArea(currentQ, currentIdx)}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                  <button
                    type="button"
                    disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx(currentIdx - 1)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "12px",
                      border: "2px solid #e2e8f0",
                      backgroundColor: "white",
                      color: currentIdx === 0 ? "#cbd5e1" : "#1B396A",
                      fontWeight: "700",
                      cursor: currentIdx === 0 ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "0.95rem",
                    }}
                  >
                    <ChevronLeft size={18} /> Reactivo Anterior
                  </button>

                  <button
                    type="button"
                    disabled={currentIdx === questions.length - 1}
                    onClick={() => setCurrentIdx(currentIdx + 1)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "12px",
                      border: "none",
                      backgroundColor: currentIdx === questions.length - 1 ? "#e2e8f0" : "#1B396A",
                      color: currentIdx === questions.length - 1 ? "#94a3b8" : "white",
                      fontWeight: "800",
                      cursor: currentIdx === questions.length - 1 ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "0.95rem",
                    }}
                  >
                    Siguiente Reactivo <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
