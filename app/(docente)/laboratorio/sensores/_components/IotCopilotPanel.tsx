"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import ExpandingButton from "@/components/ui/ExpandingButton";
import { supabase } from "@/lib/supabase";
import MiniMarkdown from "./MiniMarkdown";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Quiero medir temperatura y humedad de una incubadora, ¿qué sensor uso?",
  "Ayúdame a cablear un DHT22 a un ESP32 y sube la lectura a la plataforma",
  "Mi sensor de pH marca lecturas erráticas, ¿cómo lo depuro?",
  "Dame el código para postear temperatura desde una Raspberry Pi",
];

export default function IotCopilotPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("iot-copilot", {
        body: { messages: nextMessages },
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error ?? "El copiloto no pudo responder.");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      console.error("Error en IoT Copilot:", e);
      setError(e instanceof Error ? e.message : "No se pudo contactar al copiloto de IoT.");
      // La pregunta del docente ya quedó en el hilo — la dejamos ahí para que
      // no tenga que retipearla al reintentar, solo mostramos el error debajo.
    } finally {
      setSending(false);
    }
  };

  const retryLast = () => {
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    if (!lastUser) return;
    setError(null);
    setSending(true);
    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("iot-copilot", { body: { messages } });
        if (fnError) throw fnError;
        if (!data?.success) throw new Error(data?.error ?? "El copiloto no pudo responder.");
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      } catch (e) {
        console.error("Error en IoT Copilot (reintento):", e);
        setError(e instanceof Error ? e.message : "No se pudo contactar al copiloto de IoT.");
      } finally {
        setSending(false);
      }
    })();
  };

  return (
    <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ backgroundColor: "#ede9fe", color: "#7c3aed", padding: "10px", borderRadius: "12px" }}>
          <Bot size={20} />
        </div>
        <div>
          <h3 style={{ margin: 0, color: "#1B396A", fontWeight: "900", fontSize: "1.05rem" }}>Copiloto de IoT</h3>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.8rem" }}>Diseño, cableado, código y depuración de sensores — no solo lecturas</p>
        </div>
      </div>

      <div ref={scrollRef} style={{ maxHeight: "420px", minHeight: messages.length === 0 ? "auto" : "220px", overflowY: "auto", padding: "20px 24px" }}>
        {messages.length === 0 ? (
          <div>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 14px 0" }}>
              Pregúntame qué sensor conviene para lo que quieres medir, cómo cablearlo, o pídeme el código para que empiece a mandar lecturas reales a esta plataforma. Algunas ideas:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  style={{ textAlign: "left", padding: "10px 14px", borderRadius: "10px", border: "1px dashed #cbd5e1", backgroundColor: "#f8fafc", color: "#475569", fontSize: "0.85rem", cursor: "pointer" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "12px 16px",
                    borderRadius: "14px",
                    backgroundColor: m.role === "user" ? "#1B396A" : "#f8fafc",
                    color: m.role === "user" ? "white" : "#1e293b",
                    fontSize: "0.9rem",
                  }}
                >
                  {m.role === "assistant" ? <MiniMarkdown text={m.content} /> : <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</p>}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "12px 16px", borderRadius: "14px", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "0.85rem" }}>
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Diseñando la respuesta...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={{ margin: "0 24px 12px", backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontWeight: "600", fontSize: "0.82rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><AlertTriangle size={14} /> {error}</span>
          <ExpandingButton icon={RotateCcw} label="Reintentar" onClick={retryLast} small smallSize={28} radius={8} gap={4} padding="0 10px" fontWeight={700} fontSize="0.75rem" durationMs={300} colors={{ bg: "transparent", hoverBg: "#991b1b", text: "#991b1b", hoverText: "white", border: "#991b1b" }} />
        </div>
      )}

      <div style={{ padding: "16px 24px", borderTop: "1px solid #f1f5f9", display: "flex", gap: "10px", alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ej. quiero medir humedad del suelo con ESP32, ¿qué sensor y código uso?"
          rows={1}
          style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "0.9rem", outline: "none", resize: "none", fontFamily: "inherit", maxHeight: "120px" }}
        />
        <ExpandingButton
          icon={sending ? Loader2 : Send}
          label="Preguntar"
          onClick={() => send()}
          disabled={sending || !input.trim()}
          expanded
          size={44}
          radius={12}
          gap={8}
          padding="0 18px"
          fontWeight={700}
          durationMs={300}
          colors={{ bg: "#7c3aed", hoverBg: "#6d28d9", text: "white", hoverText: "white", border: "transparent" }}
        />
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
