"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Divide el texto en bloques de código ```lang\n...\n``` y texto normal.
function splitBlocks(text: string): { type: "code" | "text"; lang?: string; content: string }[] {
  const parts: { type: "code" | "text"; lang?: string; content: string }[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", lang: match[1] || "text", content: match[2].replace(/\n$/, "") });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }
  return parts;
}

function CodeBlock({ lang, content }: { lang?: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silencioso a propósito: falta de permisos de portapapeles no es un
      // error que valga la pena interrumpir al usuario; el código sigue
      // visible y seleccionable manualmente.
    }
  };
  return (
    <div style={{ position: "relative", backgroundColor: "#0f172a", borderRadius: "12px", margin: "10px 0", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: "1px solid #1e293b" }}>
        <span style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", fontFamily: "monospace" }}>{lang}</span>
        <button onClick={handleCopy} style={{ background: "none", border: "none", color: copied ? "#10b981" : "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", fontWeight: "700" }}>
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "14px", overflowX: "auto" }}>
        <code style={{ color: "#e2e8f0", fontSize: "0.82rem", fontFamily: "monospace", lineHeight: 1.6, whiteSpace: "pre" }}>{content}</code>
      </pre>
    </div>
  );
}

export default function MiniMarkdown({ text }: { text: string }) {
  const blocks = splitBlocks(text);
  return (
    <>
      {blocks.map((b, i) =>
        b.type === "code" ? (
          <CodeBlock key={i} lang={b.lang} content={b.content} />
        ) : (
          <p key={i} style={{ margin: "0 0 8px 0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{b.content.trim()}</p>
        )
      )}
    </>
  );
}
