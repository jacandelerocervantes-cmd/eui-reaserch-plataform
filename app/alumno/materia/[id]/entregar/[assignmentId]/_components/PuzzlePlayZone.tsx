"use client";

import { useState, useEffect } from "react";
import {
  Clock, CheckCircle2, HelpCircle,
  Send, Loader2, Award, Zap
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PuzzleData } from "@/app/(docente)/panel/materias/[id]/actividades/nueva/_components/PuzzlePreviewModal";

export default function PuzzlePlayZone({
  assignmentId,
  studentId,
  courseId: _courseId,
  puzzleType,
  puzzleData,
  existingSubmission,
  onSuccess,
}: {
  assignmentId: string;
  studentId: string;
  courseId?: string;
  puzzleType: "puzzle_crossword" | "puzzle_wordsearch";
  puzzleData: PuzzleData;
  existingSubmission?: { id: string; status: string; ai_score?: number | null; submitted_at?: string | null; metadata?: Record<string, unknown> } | null;
  onSuccess: () => void;
}) {
  const isAlreadySubmitted = existingSubmission?.status === "completed" || existingSubmission?.status === "submitted";

  const [seconds, setSeconds] = useState(0);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);

  // Crucigrama
  const [gridValues, setGridValues] = useState<Record<string, string>>({});

  // Sopa de letras
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [selectedStart, setSelectedStart] = useState<{ r: number; c: number } | null>(null);

  // Timer activo si no está entregado
  useEffect(() => {
    if (isAlreadySubmitted) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isAlreadySubmitted]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isCrossword = puzzleType === "puzzle_crossword";
  const size = puzzleData.size || 12;

  // Crucigrama: Mapa de celdas
  const crosswordCells: Record<string, { char: string; number?: number; wordIndices: number[] }> = {};
  if (isCrossword && Array.isArray(puzzleData.words)) {
    puzzleData.words.forEach((w, wIdx) => {
      const word = w.word.toUpperCase();
      for (let i = 0; i < word.length; i++) {
        const r = w.direction === "across" ? w.row : w.row + i;
        const c = w.direction === "across" ? w.col + i : w.col;
        const key = `${r}-${c}`;
        if (!crosswordCells[key]) {
          crosswordCells[key] = { char: word[i], wordIndices: [wIdx] };
        } else {
          crosswordCells[key].wordIndices.push(wIdx);
        }
        if (i === 0) {
          crosswordCells[key].number = w.number;
        }
      }
    });
  }

  // Sopa de Letras: Manejo de selección
  const handleCellClick = (r: number, c: number) => {
    if (isAlreadySubmitted) return;
    if (!selectedStart) {
      setSelectedStart({ r, c });
    } else {
      const placed = puzzleData.placedWords || [];
      const match = placed.find(
        (pw) =>
          (pw.startRow === selectedStart.r &&
            pw.startCol === selectedStart.c &&
            pw.endRow === r &&
            pw.endCol === c) ||
          (pw.startRow === r &&
            pw.startCol === c &&
            pw.endRow === selectedStart.r &&
            pw.endCol === selectedStart.c)
      );

      if (match && !foundWords.includes(match.word)) {
        setFoundWords((prev) => [...prev, match.word]);
      }
      setSelectedStart(null);
    }
  };

  const isCellInFoundWord = (r: number, c: number) => {
    const placed = puzzleData.placedWords || [];
    return placed.some((pw) => {
      if (!foundWords.includes(pw.word)) return false;
      const dr = Math.sign(pw.endRow - pw.startRow);
      const dc = Math.sign(pw.endCol - pw.startCol);
      const len = pw.word.length;
      for (let i = 0; i < len; i++) {
        if (pw.startRow + dr * i === r && pw.startCol + dc * i === c) return true;
      }
      return false;
    });
  };

  const totalWords = isCrossword
    ? puzzleData.words?.length || 0
    : puzzleData.placedWords?.length || 0;
  const completedCount = isCrossword
    ? (puzzleData.words || []).filter((w) => {
        const word = w.word.toUpperCase();
        return Array.from(word).every((char, i) => {
          const r = w.direction === "across" ? w.row : w.row + i;
          const c = w.direction === "across" ? w.col + i : w.col;
          return (gridValues[`${r}-${c}`] || "").toUpperCase() === char;
        });
      }).length
    : foundWords.length;

  const is100Percent = completedCount === totalWords && totalWords > 0;

  // Entrega formal del puzzle
  const handleSubmit = async () => {
    if (!is100Percent) return;
    setIsSubmitting(true);
    try {
      const metadata = {
        time_seconds: seconds,
        time_formatted: formatTimer(seconds),
        completed_words: completedCount,
        total_words: totalWords,
        puzzle_type: puzzleType,
        completed_at: new Date().toISOString(),
      };

      if (existingSubmission?.id) {
        const { error } = await supabase
          .from("submissions")
          .update({
            status: "completed",
            ai_score: 100,
            submitted_at: new Date().toISOString(),
            metadata,
          })
          .eq("id", existingSubmission.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("submissions").insert([
          {
            assignment_id: assignmentId,
            student_id: studentId,
            status: "completed",
            ai_score: 100,
            submitted_at: new Date().toISOString(),
            metadata,
          },
        ]);
        if (error) throw error;
      }

      setShowVictoryModal(true);
      onSuccess();
    } catch (err: unknown) {
      alert(`Error al entregar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAlreadySubmitted && !showVictoryModal) {
    return (
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "24px",
          padding: "48px 32px",
          textAlign: "center",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          maxWidth: "700px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            backgroundColor: "#dcfce7",
            color: "#16a34a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Award size={44} />
        </div>
        <h2 style={{ color: "#1B396A", fontSize: "1.8rem", fontWeight: "900", margin: "0 0 8px" }}>
          ¡Actividad Completada y Calificada!
        </h2>
        <div style={{ fontSize: "3rem", fontWeight: "900", color: "#16a34a", margin: "16px 0" }}>
          100 / 100
        </div>
        <p style={{ color: "#64748b", fontSize: "1rem", margin: "0 0 24px", fontWeight: "600" }}>
          Has resuelto con éxito todos los conceptos de esta actividad gamificada.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1150px", margin: "0 auto" }}>
      {/* HEADER DE ACTIVIDAD */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "20px",
          padding: "20px 32px",
          border: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              backgroundColor: "#1B396A",
              color: "white",
              padding: "8px 14px",
              borderRadius: "10px",
              fontWeight: "900",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Zap size={16} /> ACTIVIDAD GAMIFICADA
          </div>
          <div>
            <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>
              {puzzleData.title || (isCrossword ? "Crucigrama Interactivo" : "Sopa de Letras")}
            </h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>
              Resuelve todos los términos para obtener tu calificación automática de 100 puntos.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#eff6ff",
              color: "#1B396A",
              padding: "8px 16px",
              borderRadius: "12px",
              fontWeight: "800",
              fontSize: "0.95rem",
            }}
          >
            <Clock size={18} /> {formatTimer(seconds)}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: is100Percent ? "#dcfce7" : "#f1f5f9",
              color: is100Percent ? "#16a34a" : "#334155",
              padding: "8px 16px",
              borderRadius: "12px",
              fontWeight: "800",
              fontSize: "0.95rem",
            }}
          >
            <CheckCircle2 size={18} /> {completedCount} de {totalWords}
          </div>

          <button
            type="button"
            disabled={!is100Percent || isSubmitting}
            onClick={handleSubmit}
            style={{
              backgroundColor: is100Percent ? "#10b981" : "#cbd5e1",
              color: "white",
              border: "none",
              padding: "10px 22px",
              borderRadius: "12px",
              fontWeight: "800",
              fontSize: "0.9rem",
              cursor: is100Percent ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Entregando...
              </>
            ) : (
              <>
                <Send size={18} /> Entregar Actividad
              </>
            )}
          </button>
        </div>
      </div>

      {/* CUERPO DEL TABLERO Y PISTAS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "24px",
        }}
      >
        {/* TABLERO */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "24px",
            padding: "28px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          }}
        >
          {isCrossword ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                gap: "3px",
                maxWidth: "460px",
                width: "100%",
                aspectRatio: "1 / 1",
                backgroundColor: "#0f172a",
                padding: "8px",
                borderRadius: "16px",
              }}
            >
              {Array.from({ length: size }).map((_, r) =>
                Array.from({ length: size }).map((_, c) => {
                  const key = `${r}-${c}`;
                  const cell = crosswordCells[key];
                  const val = gridValues[key] || "";
                  const isSelected =
                    selectedWordIndex !== null && cell?.wordIndices?.includes(selectedWordIndex);

                  if (!cell) {
                    return (
                      <div
                        key={key}
                        style={{
                          backgroundColor: "#0f172a",
                          borderRadius: "4px",
                        }}
                      />
                    );
                  }

                  return (
                    <div
                      key={key}
                      style={{
                        position: "relative",
                        backgroundColor: isSelected ? "#eff6ff" : "white",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: isSelected ? "2px solid #1B396A" : "1px solid #cbd5e1",
                      }}
                    >
                      {cell.number && (
                        <span
                          style={{
                            position: "absolute",
                            top: "2px",
                            left: "3px",
                            fontSize: "0.6rem",
                            fontWeight: "900",
                            color: "#1B396A",
                          }}
                        >
                          {cell.number}
                        </span>
                      )}
                      <input
                        type="text"
                        maxLength={1}
                        value={val}
                        onChange={(e) => {
                          const letter = e.target.value.slice(-1).toUpperCase();
                          setGridValues((prev) => ({ ...prev, [key]: letter }));
                        }}
                        onFocus={() => {
                          if (cell.wordIndices.length > 0) {
                            setSelectedWordIndex(cell.wordIndices[0]);
                          }
                        }}
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          background: "transparent",
                          textAlign: "center",
                          fontSize: "clamp(0.9rem, 2vw, 1.2rem)",
                          fontWeight: "900",
                          color: "#1B396A",
                          outline: "none",
                          textTransform: "uppercase",
                          padding: "0",
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                gap: "4px",
                maxWidth: "480px",
                width: "100%",
                aspectRatio: "1 / 1",
                backgroundColor: "#f8fafc",
                padding: "14px",
                borderRadius: "18px",
                border: "2px solid #e2e8f0",
              }}
            >
              {(puzzleData.grid || []).map((row, r) =>
                row.map((char, c) => {
                  const isFound = isCellInFoundWord(r, c);
                  const isStart = selectedStart?.r === r && selectedStart?.c === c;

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onClick={() => handleCellClick(r, c)}
                      style={{
                        aspectRatio: "1 / 1",
                        borderRadius: "8px",
                        border: isStart ? "2px solid #1B396A" : "none",
                        backgroundColor: isFound ? "#dcfce7" : isStart ? "#dbeafe" : "white",
                        color: isFound ? "#15803d" : isStart ? "#1B396A" : "#334155",
                        fontWeight: "900",
                        fontSize: "clamp(0.9rem, 1.8vw, 1.15rem)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s ease",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}
                    >
                      {char}
                    </button>
                  );
                })
              )}
            </div>
          )}

          <p style={{ margin: "18px 0 0", fontSize: "0.85rem", color: "#64748b", fontWeight: "600" }}>
            {isCrossword
              ? "Haz clic en una casilla para escribir o selecciona una pista de la derecha."
              : "Haz clic en la primera letra y luego en la última letra de la palabra para descubrirla."}
          </p>
        </div>

        {/* LISTA DE PISTAS */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "24px",
            padding: "28px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            overflowY: "auto",
            maxHeight: "560px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          }}
        >
          <h4
            style={{
              margin: 0,
              color: "#1B396A",
              fontSize: "1.05rem",
              fontWeight: "900",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              textTransform: "uppercase",
            }}
          >
            <HelpCircle size={20} /> Pistas Conceptuales
          </h4>

          {isCrossword ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h5 style={{ margin: "0 0 8px", color: "#1B396A", fontSize: "0.85rem", fontWeight: "800" }}>
                  HORIZONTALES
                </h5>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(puzzleData.words || [])
                    .filter((w) => w.direction === "across")
                    .map((w, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          const originalIdx = (puzzleData.words || []).indexOf(w);
                          setSelectedWordIndex(originalIdx);
                        }}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor:
                            selectedWordIndex === (puzzleData.words || []).indexOf(w)
                              ? "#eff6ff"
                              : "#f8fafc",
                          border: `1px solid ${
                            selectedWordIndex === (puzzleData.words || []).indexOf(w)
                              ? "#bfdbfe"
                              : "#e2e8f0"
                          }`,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontWeight: "900", color: "#1B396A", marginRight: "6px" }}>
                          {w.number}.
                        </span>
                        <span style={{ fontSize: "0.88rem", color: "#334155", fontWeight: "600" }}>
                          {w.clue}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h5 style={{ margin: "0 0 8px", color: "#1B396A", fontSize: "0.85rem", fontWeight: "800" }}>
                  VERTICALES
                </h5>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(puzzleData.words || [])
                    .filter((w) => w.direction === "down")
                    .map((w, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          const originalIdx = (puzzleData.words || []).indexOf(w);
                          setSelectedWordIndex(originalIdx);
                        }}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor:
                            selectedWordIndex === (puzzleData.words || []).indexOf(w)
                              ? "#eff6ff"
                              : "#f8fafc",
                          border: `1px solid ${
                            selectedWordIndex === (puzzleData.words || []).indexOf(w)
                              ? "#bfdbfe"
                              : "#e2e8f0"
                          }`,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontWeight: "900", color: "#1B396A", marginRight: "6px" }}>
                          {w.number}.
                        </span>
                        <span style={{ fontSize: "0.88rem", color: "#334155", fontWeight: "600" }}>
                          {w.clue}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(puzzleData.placedWords || []).map((pw, idx) => {
                const isFound = foundWords.includes(pw.word);
                return (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "12px",
                      backgroundColor: isFound ? "#dcfce7" : "#f8fafc",
                      border: `1px solid ${isFound ? "#86efac" : "#e2e8f0"}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontWeight: "900",
                          color: isFound ? "#15803d" : "#1B396A",
                          fontSize: "0.9rem",
                          textDecoration: isFound ? "line-through" : "none",
                        }}
                      >
                        {isFound ? pw.word : "Palabra Oculta"}
                      </span>
                      {isFound && (
                        <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#16a34a" }}>
                          ✓ ¡Descubierta!
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569", fontWeight: "600", lineHeight: "1.4" }}>
                      {pw.clue}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
