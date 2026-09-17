"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Paperclip, FileText, X, Send, Loader2,
  ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, Layers, BookOpen
} from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import ExamQuestionCard from "./ExamQuestionCard";
import type { EditQuestion } from "../../_components/questionMapping";

export type ExamChatAssistantProps = {
  courseId: string;
  units: { id: string; unit_number: number; title: string }[];
  unitId: string;
  setUnitId: (id: string) => void;
  questions: EditQuestion[];
  totalPoints: number;
  onUpdateQuestion: (idx: number, patch: Partial<EditQuestion>) => void;
  onDeleteQuestion: (idx: number) => void;
  onRegenerateQuestion: (idx: number, instruction?: string, difficulty?: string) => Promise<void>;
  onGenerateInitial: (params: {
    topic: string;
    file: File | null;
    count: number;
    difficulty: string;
    questionTypes: string[];
  }) => Promise<{ success: boolean; unreadable_file?: boolean; error?: string }>;
  onSendChatTurn: (instruction: string, file?: File | null) => Promise<string>;
  onGoToResult: () => void;
  onCancel: () => void;
};

type ChatStep = "step_topic" | "step_count" | "step_difficulty" | "step_types" | "generating" | "chat_free";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  unreadableFile?: boolean;
  showQuestions?: boolean;
};

const INITIAL_TYPES = [
  { id: "multiple_choice", label: "Opción Múltiple", recommended: true },
  { id: "true_false",      label: "Verdadero / Falso", recommended: true },
  { id: "open",            label: "Pregunta Abierta", recommended: true },
  { id: "matching",        label: "Relación de Columnas", recommended: false },
  { id: "short_answer",    label: "Respuesta Corta", recommended: false },
  { id: "fill_blank",      label: "Completar Espacios", recommended: false },
  { id: "ordering",        label: "Ordenar Pasos", recommended: false },
  { id: "multi_select",    label: "Selección Múltiple", recommended: false },
];

export default function ExamChatAssistant({
  courseId,
  units,
  unitId,
  setUnitId,
  questions,
  totalPoints,
  onUpdateQuestion,
  onDeleteQuestion,
  onRegenerateQuestion,
  onGenerateInitial,
  onSendChatTurn,
  onGoToResult,
  onCancel,
}: ExamChatAssistantProps) {
  // Estado del flujo conversacional
  const [step, setStep] = useState<ChatStep>(() => (questions.length > 0 ? "chat_free" : "step_topic"));
  const [topic, setTopic] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState("intermedia");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["multiple_choice", "true_false", "open"]);

  // Estados de generación y etapas
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState("Iniciando...");
  const [currentProgressQuestion, setCurrentProgressQuestion] = useState(1);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  // Historial de mensajes
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (questions.length > 0) {
      return [
        {
          id: "m-0",
          role: "assistant",
          text: `Tienes un borrador activo con ${questions.length} reactivos. Puedes expandir cualquier reactivo para editarlo, cambiar su dificultad o pedirme ajustes ("agrega una pregunta sobre...", "cambia la 2 a opción múltiple").`,
          showQuestions: true,
        },
      ];
    }
    return [
      {
        id: "m-init",
        role: "assistant",
        text: "¡Hola! Diseñemos tu examen con IA paso a paso.\n\nPara empezar: ¿cuál es el tema principal de la evaluación? Puedes escribir los temas clave aquí abajo o adjuntar un archivo de referencia (PDF, Word, Excel o foto de apuntes).",
      },
    ];
  });

  const [input, setInput] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating, step]);

  // Manejador del ticker de etapas animadas
  useEffect(() => {
    if (!isGenerating) return;
    const stages = selectedFile
      ? ["Leyendo el documento adjunto...", "Identificando conceptos clave y competencias...", "Redactando reactivos pedagógicos..."]
      : ["Analizando el temario...", "Identificando conceptos clave y competencias...", "Redactando reactivos pedagógicos..."];

    let sIdx = 0;
    setGenerationStage(stages[0]);
    const stageTimer = setInterval(() => {
      sIdx++;
      if (sIdx < stages.length) {
        setGenerationStage(stages[sIdx]);
      }
    }, 2500);

    // Contador simulado de preguntas mientras responde Gemini
    let qCounter = 1;
    setCurrentProgressQuestion(1);
    const counterTimer = setInterval(() => {
      if (qCounter < questionCount) {
        qCounter++;
        setCurrentProgressQuestion(qCounter);
      }
    }, 1800);

    return () => {
      clearInterval(stageTimer);
      clearInterval(counterTimer);
    };
  }, [isGenerating, selectedFile, questionCount]);

  // ── PASO 1: ENVIAR TEMA / ARCHIVO ───────────────────────────────────────
  const handleSendTopic = () => {
    const trimmed = input.trim();
    if (!trimmed && !selectedFile) return;

    const topicText = trimmed || (selectedFile ? `Material adjunto: ${selectedFile.name}` : "Temas de la materia");
    setTopic(topicText);

    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        role: "user",
        text: trimmed ? (selectedFile ? `${trimmed} (Adjunto: ${selectedFile.name})` : trimmed) : `Analiza el documento adjunto: ${selectedFile?.name}`,
      },
      {
        id: `m-${Date.now() + 1}`,
        role: "assistant",
        text: `Excelente tema: "${topicText}".\n\n¿Cuántas preguntas deseas incluir en este examen?`,
      },
    ]);

    setInput("");
    setStep("step_count");
  };

  // ── PASO 2: SELECCIONAR CANTIDAD ─────────────────────────────────────────
  const handleSelectCount = (count: number) => {
    setQuestionCount(count);
    setMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, role: "user", text: `${count} preguntas` },
      {
        id: `m-${Date.now() + 1}`,
        role: "assistant",
        text: `Perfecto, generaremos ${count} preguntas.\n\n¿Qué nivel de dificultad general prefieres como punto de partida? (Podrás ajustarla pregunta por pregunta después).`,
      },
    ]);
    setStep("step_difficulty");
  };

  // ── PASO 3: SELECCIONAR DIFICULTAD ───────────────────────────────────────
  const handleSelectDifficulty = (diff: string, label: string) => {
    setDifficulty(diff);
    setMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, role: "user", text: `Dificultad ${label}` },
      {
        id: `m-${Date.now() + 1}`,
        role: "assistant",
        text: `Anotado: Dificultad ${label}.\n\nPor último, ¿qué tipos de reactivos deseas incluir? Selecciona los que prefieras y presiona "Generar Examen".`,
      },
    ]);
    setStep("step_types");
  };

  // ── PASO 4: CONFIRMAR TIPOS Y DISPARAR GENERACIÓN ─────────────────────────
  const handleToggleType = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      if (selectedTypes.length > 1) setSelectedTypes(selectedTypes.filter((t) => t !== typeId));
    } else {
      setSelectedTypes([...selectedTypes, typeId]);
    }
  };

  const handleStartGeneration = async () => {
    const typeLabelsStr = selectedTypes
      .map((t) => INITIAL_TYPES.find((it) => it.id === t)?.label ?? t)
      .join(", ");

    setMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, role: "user", text: `Tipos seleccionados: ${typeLabelsStr}` },
    ]);

    setStep("generating");
    setIsGenerating(true);

    try {
      const res = await onGenerateInitial({
        topic,
        file: selectedFile,
        count: questionCount,
        difficulty,
        questionTypes: selectedTypes,
      });

      if (!res.success) {
        if (res.unreadable_file) {
          setMessages((prev) => [
            ...prev,
            {
              id: `m-${Date.now() + 1}`,
              role: "assistant",
              unreadableFile: true,
              text: `⚠️ No pude extraer el contenido de "${selectedFile?.name}". El archivo puede estar dañado, escaneado de forma ilegible o protegido.\n\n¿Cómo deseas continuar?`,
            },
          ]);
          setStep("step_topic");
          return;
        }
        throw new Error(res.error || "No se pudo generar el examen.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now() + 1}`,
          role: "assistant",
          text: `¡Listo! He generado los reactivos para "${topic}". Abajo puedes expandir cualquiera para revisar sus opciones, cambiar su dificultad, regenerarla individualmente o pedirme cualquier ajuste aquí en el chat.`,
          showQuestions: true,
        },
      ]);
      setStep("chat_free");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now() + 1}`,
          role: "assistant",
          text: `Error al generar reactivos: ${err instanceof Error ? err.message : String(err)}. Intenta reformular el tema o haz clic en reintentar.`,
        },
      ]);
      setStep("step_types");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── TURNO LIBRE MULTI-TURNO ───────────────────────────────────────────────
  const handleSendFreeTurn = async () => {
    const trimmed = input.trim();
    if (!trimmed && !selectedFile) return;

    const userText = trimmed || (selectedFile ? `Revisa el adjunto: ${selectedFile.name}` : "");
    setMessages((prev) => [...prev, { id: `m-${Date.now()}`, role: "user", text: userText }]);
    setInput("");
    setIsGenerating(true);
    setGenerationStage("Ajustando los reactivos del examen...");

    try {
      const reply = await onSendChatTurn(userText, selectedFile);
      setMessages((prev) => [
        ...prev,
        { id: `m-${Date.now() + 1}`, role: "assistant", text: reply, showQuestions: true },
      ]);
      setSelectedFile(null);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now() + 1}`,
          role: "assistant",
          text: `No pude aplicar el ajuste: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── REGENERAR PREGUNTA INDIVIDUAL AISLADA ─────────────────────────────────
  const handleRegenerateQuestionItem = async (idx: number, instruction?: string, diff?: string) => {
    setRegeneratingIndex(idx);
    try {
      await onRegenerateQuestion(idx, instruction, diff);
    } finally {
      setRegeneratingIndex(null);
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      backgroundColor: "#F8FAFC", overflow: "hidden",
    }}>
      {/* ── BARRA SUPERIOR ────────────────────────────────────────────── */}
      <header style={{
        backgroundColor: "white", borderBottom: "1px solid #e2e8f0",
        padding: "12px clamp(16px, 3vw, 32px)", display: "flex",
        alignItems: "center", justifyContent: "space-between", gap: "16px",
        flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <button
            type="button"
            onClick={onCancel}
            title="Regresar a Evaluaciones"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "36px", height: "36px", borderRadius: "10px",
              border: "1px solid #e2e8f0", backgroundColor: "white",
              color: "#64748b", cursor: "pointer",
            }}
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{
                margin: 0, color: "#1B396A", fontSize: "1.15rem",
                fontWeight: "900", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                Crear Examen con IA
              </h2>
              <span style={{
                backgroundColor: "#fef3c7", color: "#92400e",
                fontSize: "0.65rem", fontWeight: "900", textTransform: "uppercase",
                padding: "3px 8px", borderRadius: "6px", border: "1px solid #fde68a",
                letterSpacing: "0.04em", flexShrink: 0,
              }}>
                Borrador (en memoria)
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>
              TecNM • Asistente de Evaluación por Competencias
            </p>
          </div>
        </div>

        {/* SELECTOR DE UNIDAD TEMÁTICA */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            backgroundColor: "#f0f7ff", border: "1px solid #bfdbfe",
            borderRadius: "10px", padding: "6px 10px",
          }}>
            <BookOpen size={14} color="#1B396A" />
            <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#1B396A" }}>UNIDAD:</span>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              style={{
                border: "none", background: "transparent", color: "#1B396A",
                fontWeight: "700", fontSize: "0.8rem", outline: "none", cursor: "pointer",
              }}
            >
              <option value="">Selecciona unidad...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  U{u.unit_number}: {u.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* RESUMEN Y BOTÓN RESULTADO */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          {questions.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "6px 12px", backgroundColor: "#f8fafc",
              borderRadius: "10px", border: "1px solid #e2e8f0",
              fontSize: "0.8rem", fontWeight: "800", color: "#1B396A",
            }}>
              <span>{questions.length} reactivos</span>
              <span>•</span>
              <span style={{ color: totalPoints === 100 ? "#16a34a" : "#d97706" }}>
                {totalPoints} pts
              </span>
            </div>
          )}

          <ExpandingButton
            icon={ArrowRight}
            label="Guardar y Revisar Resultado"
            onClick={onGoToResult}
            variant="primary"
            disabled={questions.length === 0}
            size={40}
            radius={10}
            gap={8}
            padding="0 14px"
            fontWeight={700}
            durationMs={300}
          />
        </div>
      </header>

      {/* ── HILO DE CONVERSACIÓN (SCROLLABLE) ─────────────────────────── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "clamp(16px, 2.5vw, 32px)",
        display: "flex", flexDirection: "column", gap: "18px",
        maxWidth: "960px", width: "100%", margin: "0 auto",
      }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex", flexDirection: "column",
              alignItems: m.role === "user" ? "flex-end" : "flex-start",
              width: "100%",
            }}
          >
            {/* BURBUJA DE MENSAJE */}
            <div style={{
              maxWidth: m.showQuestions ? "100%" : "85%",
              padding: "14px 18px", borderRadius: "18px",
              fontSize: "0.95rem", lineHeight: 1.6, fontWeight: 600,
              backgroundColor: m.role === "user" ? "#1B396A" : "white",
              color: m.role === "user" ? "white" : "#1e293b",
              border: m.role === "assistant" ? "1px solid #e2e8f0" : "none",
              boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
              whiteSpace: "pre-line",
            }}>
              {m.text}

              {/* OPCIONES DE RECUPERACIÓN ANTE ARCHIVO ILEGIBLE */}
              {m.unreadableFile && (
                <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      fileInputRef.current?.click();
                    }}
                    style={{
                      padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1",
                      backgroundColor: "white", color: "#1B396A", fontWeight: "700",
                      fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    <Paperclip size={14} /> Reintentar con otro archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setInput(topic);
                    }}
                    style={{
                      padding: "8px 14px", borderRadius: "8px", border: "1px solid #1B396A",
                      backgroundColor: "#1B396A", color: "white", fontWeight: "700",
                      fontSize: "0.85rem", cursor: "pointer",
                    }}
                  >
                    Continuar solo con texto
                  </button>
                </div>
              )}
            </div>

            {/* TARJETAS DE REACTIVOS INLINE SI EL MENSAJE LO INDICA */}
            {m.showQuestions && questions.length > 0 && (
              <div style={{
                width: "100%", marginTop: "14px", display: "flex",
                flexDirection: "column", gap: "12px",
              }}>
                {questions.map((q, idx) => (
                  <ExamQuestionCard
                    key={idx}
                    question={q}
                    index={idx}
                    onUpdate={(patch) => onUpdateQuestion(idx, patch)}
                    onDelete={() => onDeleteQuestion(idx)}
                    onRegenerate={(instr, diff) => handleRegenerateQuestionItem(idx, instr, diff)}
                    isRegenerating={regeneratingIndex === idx}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* ── PASO 2: CONTROLES DE CANTIDAD EN LÍNEA ─────────────────── */}
        {step === "step_count" && !isGenerating && (
          <div style={{
            alignSelf: "flex-start", backgroundColor: "white", padding: "16px 20px",
            borderRadius: "16px", border: "1px solid #e2e8f0", maxWidth: "600px", width: "100%",
            boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          }}>
            <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", fontWeight: "800", color: "#64748b" }}>
              SELECCIONA LA CANTIDAD DE REACTIVOS:
            </p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              {[5, 10, 20, 50].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSelectCount(c)}
                  style={{
                    padding: "10px 18px", borderRadius: "10px", border: "1px solid #cbd5e1",
                    backgroundColor: "white", color: "#1B396A", fontWeight: "800",
                    fontSize: "0.9rem", cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f7ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
                >
                  {c} preguntas
                </button>
              ))}

              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600" }}>Otro:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="#"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      if (val > 0) handleSelectCount(val);
                    }
                  }}
                  style={{
                    width: "55px", padding: "6px", borderRadius: "8px",
                    border: "1px solid #cbd5e1", textAlign: "center", fontWeight: "800",
                    fontSize: "0.85rem", color: "#1B396A",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── PASO 3: CONTROLES DE DIFICULTAD EN LÍNEA ───────────────── */}
        {step === "step_difficulty" && !isGenerating && (
          <div style={{
            alignSelf: "flex-start", backgroundColor: "white", padding: "16px 20px",
            borderRadius: "16px", border: "1px solid #e2e8f0", maxWidth: "680px", width: "100%",
            boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          }}>
            <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", fontWeight: "800", color: "#64748b" }}>
              NIVEL DE DIFICULTAD INICIAL (TAXONOMÍA DE BLOOM):
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              <button
                type="button"
                onClick={() => handleSelectDifficulty("basica", "Básica (Recordar y Comprender)")}
                style={{
                  padding: "14px", borderRadius: "12px", border: "1px solid #bbf7d0",
                  backgroundColor: "#f0fdf4", color: "#166534", textAlign: "left", cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: "900", fontSize: "0.95rem" }}>🟢 Básica</div>
                <div style={{ fontSize: "0.75rem", marginTop: "4px", color: "#15803d" }}>
                  Recordar y Comprender conceptos teóricos y definiciones.
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDifficulty("intermedia", "Intermedia (Aplicar y Analizar)")}
                style={{
                  padding: "14px", borderRadius: "12px", border: "2px solid #1B396A",
                  backgroundColor: "#f0f7ff", color: "#1B396A", textAlign: "left", cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: "900", fontSize: "0.95rem" }}>🟡 Intermedia (Recomendada)</div>
                <div style={{ fontSize: "0.75rem", marginTop: "4px", color: "#334155" }}>
                  Aplicar procedimientos y resolver problemas de ingeniería.
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDifficulty("avanzada", "Avanzada (Evaluar y Diseñar)")}
                style={{
                  padding: "14px", borderRadius: "12px", border: "1px solid #fecaca",
                  backgroundColor: "#fef2f2", color: "#991b1b", textAlign: "left", cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: "900", fontSize: "0.95rem" }}>🔴 Avanzada</div>
                <div style={{ fontSize: "0.75rem", marginTop: "4px", color: "#b91c1c" }}>
                  Evaluar trade-offs técnicos, diseñar soluciones y justificar.
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 4: SELECTOR DE TIPOS Y BOTÓN DE GENERACIÓN ───────── */}
        {step === "step_types" && !isGenerating && (
          <div style={{
            alignSelf: "flex-start", backgroundColor: "white", padding: "20px",
            borderRadius: "16px", border: "1px solid #e2e8f0", maxWidth: "720px", width: "100%",
            boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
          }}>
            <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", fontWeight: "800", color: "#64748b" }}>
              TIPOS DE PREGUNTA DESEADOS:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px", marginBottom: "16px" }}>
              {INITIAL_TYPES.map((t) => {
                const isSelected = selectedTypes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleToggleType(t.id)}
                    style={{
                      padding: "10px 12px", borderRadius: "10px",
                      border: isSelected ? "2px solid #1B396A" : "1px solid #e2e8f0",
                      backgroundColor: isSelected ? "#f0f7ff" : "white",
                      color: isSelected ? "#1B396A" : "#64748b",
                      textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                      fontWeight: isSelected ? "800" : "600", fontSize: "0.85rem",
                    }}
                  >
                    <div style={{
                      width: "16px", height: "16px", borderRadius: "4px",
                      border: isSelected ? "none" : "1px solid #cbd5e1",
                      backgroundColor: isSelected ? "#1B396A" : "white",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "white",
                    }}>
                      {isSelected && <CheckCircle2 size={14} />}
                    </div>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <ExpandingButton
                icon={Sparkles}
                label="🚀 Generar Examen con IA"
                onClick={handleStartGeneration}
                variant="primary"
                size={44}
                radius={12}
                gap={10}
                padding="0 20px"
                fontWeight={800}
                durationMs={300}
              />
            </div>
          </div>
        )}

        {/* ── ESTADO DE GENERACIÓN POR ETAPAS ───────────────────────── */}
        {isGenerating && (
          <div style={{
            display: "flex", flexDirection: "column", gap: "10px",
            alignSelf: "flex-start", backgroundColor: "#f8fafc",
            border: "1px solid #bfdbfe", padding: "16px 20px", borderRadius: "16px",
            maxWidth: "460px", width: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#1B396A", fontWeight: "800", fontSize: "0.95rem" }}>
              <Loader2 className="animate-spin" size={18} />
              <span>{generationStage}</span>
            </div>

            {step === "generating" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.8rem", color: "#64748b", fontWeight: "700" }}>
                <span>Redactando reactivo:</span>
                <span style={{ color: "#1B396A", fontWeight: "900" }}>
                  Pregunta {currentProgressQuestion} de {questionCount}
                </span>
              </div>
            )}
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* ── BARRA INFERIOR DE ENTRADA (PROMPT + ADJUNTAR ARCHIVO) ─────── */}
      <footer style={{
        borderTop: "1px solid #e2e8f0", backgroundColor: "white",
        padding: "14px clamp(16px, 3vw, 32px)", flexShrink: 0,
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{
            display: "flex", gap: "10px", alignItems: "flex-end",
            backgroundColor: "#f8fafc", border: "1px solid #e2e8f0",
            borderRadius: "16px", padding: "8px 14px",
          }}>
            <Sparkles color="#1B396A" size={20} style={{ marginBottom: "8px", flexShrink: 0 }} />

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (step === "step_topic") handleSendTopic();
                  else if (step === "chat_free") handleSendFreeTurn();
                }
              }}
              placeholder={
                step === "step_topic"
                  ? "Escribe el tema de la evaluación o adjunta material..."
                  : step === "chat_free"
                  ? "Pide cualquier ajuste: 'agrega una pregunta sobre...', 'haz la pregunta 2 más difícil'..."
                  : "Selecciona las opciones arriba para avanzar..."
              }
              rows={1}
              disabled={isGenerating || step === "step_count" || step === "step_difficulty" || step === "step_types"}
              style={{
                flex: 1, border: "none", outline: "none", background: "transparent",
                fontWeight: "600", fontSize: "0.95rem", color: "#1B396A",
                resize: "none", fontFamily: "inherit", padding: "6px 0",
                minHeight: "24px", maxHeight: "140px", overflowY: "auto",
              }}
            />

            {/* ADJUNTAR ARCHIVO */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.ppt,.pptx,.xlsx,.csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
              id="exam-chat-file"
            />
            <label
              htmlFor="exam-chat-file"
              title="Adjuntar documento o presentación de referencia (PDF, Word, PowerPoint, Excel, JPG, PNG)"
              style={{
                flexShrink: 0, cursor: "pointer",
                color: selectedFile ? "#1B396A" : "#94a3b8",
                marginBottom: "6px", display: "flex", padding: "4px",
              }}
            >
              <Paperclip size={20} />
            </label>

            {/* BOTÓN ENVIAR */}
            <button
              type="button"
              onClick={step === "step_topic" ? handleSendTopic : handleSendFreeTurn}
              disabled={isGenerating || (!input.trim() && !selectedFile)}
              style={{
                flexShrink: 0, width: "36px", height: "36px", borderRadius: "10px",
                border: "none",
                backgroundColor: isGenerating || (!input.trim() && !selectedFile) ? "#e2e8f0" : "#1B396A",
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: isGenerating || (!input.trim() && !selectedFile) ? "default" : "pointer",
                marginBottom: "2px",
              }}
            >
              <Send size={16} />
            </button>
          </div>

          {/* CHIP DE ARCHIVO ADJUNTO */}
          {selectedFile && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              fontSize: "0.85rem", color: "#1B396A", fontWeight: "700",
              marginLeft: "12px",
            }}>
              <FileText size={14} /> {selectedFile.name}
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                title="Quitar archivo"
                style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", display: "flex" }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ENLACE SECUNDARIO PARA DISEÑAR SIN IA */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 6px" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              💡 Presiona Enter para enviar. Shift + Enter para salto de línea.
            </span>
            <button
              type="button"
              onClick={onGoToResult}
              style={{
                background: "none", border: "none", color: "#64748b",
                fontSize: "0.75rem", fontWeight: "700", cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              O bien, diseñar examen manualmente sin IA →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

