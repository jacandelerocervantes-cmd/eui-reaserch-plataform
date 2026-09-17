"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Paperclip, FileText, X, Send, Loader2 } from "lucide-react";

type ChatMessage = { role: "assistant" | "user"; text: string };

const DEFAULT_INITIAL_MESSAGE: ChatMessage =
  { role: "assistant", text: "Cuéntame de qué trata la actividad (o adjunta un archivo con instrucciones/rúbrica existente) y te propongo las instrucciones para el alumno y la rúbrica. Después puedes pedirme ajustes: \"hazla más estricta\", \"agrega un criterio de trabajo en equipo\", \"aclara que debe ser en equipos de 3\", etc." };

const SEEDED_INITIAL_MESSAGE: ChatMessage =
  { role: "assistant", text: "Partí de la actividad duplicada — ya tienes las instrucciones y la rúbrica precargadas abajo. Dime qué quieres ajustar (\"hazla más estricta\", \"cambia el título a...\") o guárdala tal cual." };

// Asistente de redacción de rúbrica por chat — reemplaza el botón de un solo
// turno "Autogenerar con IA". Cada mensaje del docente es un turno que llama
// a generate-rubric-ia vía onSendMessage (implementado en useNuevaActividad),
// que ya sabe ajustar la rúbrica existente en vez de regenerarla desde cero.
export default function ActivityChatAssistant({
  onSendMessage, isGenerating, rubricSourceFile, setRubricSourceFile, seeded,
}: {
  onSendMessage: (message: string) => Promise<string>;
  isGenerating: boolean;
  rubricSourceFile: File | null;
  setRubricSourceFile: (f: File | null) => void;
  seeded?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([seeded ? SEEDED_INITIAL_MESSAGE : DEFAULT_INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && !rubricSourceFile) return;
    const userText = trimmed || `Analiza el archivo adjunto (${rubricSourceFile?.name}) y genera la rúbrica.`;
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setInput("");
    try {
      const reply = await onSendMessage(userText);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: `No pude generar la rúbrica: ${err instanceof Error ? err.message : String(err)}` }]);
    }
  };

  return (
    <div style={{ backgroundColor: "white", borderRadius: "18px", border: "1px solid #e2e8f0", marginBottom: "20px", boxShadow: "0 4px 10px rgba(0,0,0,0.03)", overflow: "hidden" }}>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "320px", overflowY: "auto" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "12px 16px", borderRadius: "16px", fontSize: "0.9rem", lineHeight: 1.5, fontWeight: 600,
              backgroundColor: m.role === "user" ? "#1B396A" : "#f8fafc",
              color: m.role === "user" ? "white" : "#334155",
              border: m.role === "assistant" ? "1px solid #e2e8f0" : "none",
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "12px 16px", borderRadius: "16px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "0.9rem", fontWeight: 600 }}>
              <Loader2 className="animate-spin" size={16} /> Pensando la rúbrica...
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <div style={{ borderTop: "1px solid #f1f5f9", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <Sparkles color="#1B396A" size={18} style={{ marginBottom: "9px", flexShrink: 0 }} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Describe la actividad o pide un ajuste a la rúbrica..."
            rows={1}
            disabled={isGenerating}
            style={{ flex: 1, border: "none", outline: "none", fontWeight: "600", fontSize: "0.95rem", color: "#1B396A", resize: "none", fontFamily: "inherit", padding: "8px 0", minHeight: "24px", maxHeight: "160px", overflowY: "auto" }}
          />
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.ppt,.pptx,.xlsx,.csv"
            onChange={(e) => setRubricSourceFile(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
            id="activity-chat-file"
          />
          <label htmlFor="activity-chat-file" title="Adjuntar documento o presentación existente (PDF, Word, PowerPoint, Excel)" style={{ flexShrink: 0, cursor: "pointer", color: rubricSourceFile ? "#1B396A" : "#94a3b8", marginBottom: "6px", display: "flex" }}>
            <Paperclip size={18} />
          </label>
          <button
            type="button"
            onClick={handleSend}
            disabled={isGenerating || (!input.trim() && !rubricSourceFile)}
            style={{
              flexShrink: 0, width: "36px", height: "36px", borderRadius: "10px", border: "none",
              backgroundColor: isGenerating || (!input.trim() && !rubricSourceFile) ? "#e2e8f0" : "#1B396A",
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: isGenerating || (!input.trim() && !rubricSourceFile) ? "default" : "pointer",
            }}
          >
            <Send size={16} />
          </button>
        </div>
        {rubricSourceFile && (
          <div style={{ marginLeft: "28px", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "#1B396A", fontWeight: "700" }}>
            <FileText size={14} /> {rubricSourceFile.name}
            <button type="button" onClick={() => setRubricSourceFile(null)} title="Quitar archivo" style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", display: "flex" }}><X size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
