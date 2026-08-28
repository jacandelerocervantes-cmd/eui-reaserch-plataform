"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { TYPE_LABELS } from "../../_components/constants";
import type { EditQuestion } from "../../_components/questionMapping";

export default function SimulacionModal({ questions, onClose }: { questions: EditQuestion[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const currentQ = questions[idx];

  if (done) return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "#F8FAFC", zIndex: 5000, display: "flex", justifyContent: "center", alignItems: "center", padding: "40px" }}>
      <div style={{ maxWidth: "600px", textAlign: "center" }}>
        <Trophy size={60} color="#1B396A" style={{ margin: "0 auto 20px" }} />
        <h1 style={{ color: "#1B396A" }}>¡Simulación Completa!</h1>
        <p style={{ color: "#64748b" }}>Para una vista previa fiel con restricciones anti-copia, usa &quot;Simular Vista Alumno&quot; desde la lista de evaluaciones una vez guardado.</p>
        <button onClick={onClose} style={{ marginTop: "30px", backgroundColor: "#1B396A", color: "white", border: "none", padding: "12px 30px", borderRadius: "12px", cursor: "pointer", fontWeight: "700" }}>Cerrar Vista Previa</button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "#F8FAFC", zIndex: 5000, display: "flex", flexDirection: "column" }}>
      <header style={{ backgroundColor: "white", padding: "20px 40px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ color: "#1B396A", margin: 0 }}>Vista Previa Estudiante</h2>
        <button onClick={() => setDone(true)} style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "10px 25px", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}>Finalizar</button>
      </header>
      <main style={{ flex: 1, padding: "40px", display: "flex", justifyContent: "center", userSelect: "none" }} onCopy={(e) => e.preventDefault()}>
        <div style={{ maxWidth: "700px", width: "100%" }}>
          <div style={{ backgroundColor: "white", padding: "40px", borderRadius: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <p style={{ color: "#94a3b8", fontWeight: "800", fontSize: "0.8rem" }}>REACTIVO {idx + 1} DE {questions.length} · {TYPE_LABELS[currentQ?.type] ?? currentQ?.type}</p>
            <h2 style={{ color: "#1B396A", margin: "10px 0 30px" }}>{currentQ?.content}</h2>

            {currentQ?.type === 'matching' ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {currentQ.left?.map((l: string, i: number) => (
                    <div key={i} style={{ padding: "14px 18px", borderRadius: "10px", border: "2px solid #f1f5f9", fontWeight: "700", color: "#1B396A" }}>{i + 1}. {l}</div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {currentQ.right?.map((r: string, i: number) => (
                    <div key={i} style={{ padding: "14px 18px", borderRadius: "10px", border: "2px solid #f1f5f9", color: "#64748b" }}>{String.fromCharCode(65 + i)}. {r}</div>
                  ))}
                </div>
              </div>
            ) : currentQ?.type === 'open' ? (
              <textarea disabled placeholder="(El alumno escribirá su respuesta aquí)" style={{ width: "100%", height: "150px", padding: "16px", borderRadius: "12px", border: "2px solid #f1f5f9", resize: "none", fontFamily: "inherit" }} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {(currentQ?.options ?? (currentQ?.type === 'true_false' ? ["Verdadero", "Falso"] : [])).map((o, i: number) => (
                  <button key={i} style={{ textAlign: "left", padding: "15px 20px", borderRadius: "12px", border: "2px solid #f1f5f9", fontWeight: "600", color: "#64748b", backgroundColor: "white" }}>{o}</button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
            <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "700", color: idx === 0 ? "#cbd5e1" : "#1B396A" }}>Anterior</button>
            <button disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "700", color: idx === questions.length - 1 ? "#cbd5e1" : "#1B396A" }}>Siguiente</button>
          </div>
        </div>
      </main>
    </div>
  );
}
