"use client";

import { useParams, useRouter } from "next/navigation";
import {
  Clock, ChevronLeft, ChevronRight, Send,
  AlertTriangle, Trophy, Sparkles, Loader2,
  Target, BookOpen, ShieldAlert
} from "lucide-react";
import { useSimulacionExamen, type SimQuestion } from "./_hooks/useSimulacionExamen";

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Opción Múltiple",
  true_false: "Verdadero/Falso",
  open: "Abierta",
  matching: "Relación de Columnas",
  short_answer: "Respuesta Corta",
  fill_blank: "Completar Espacios",
  ordering: "Ordenar/Secuenciar",
  multi_select: "Selección Múltiple",
};

// --- COMPONENTE DE SIMULACIÓN COMPLETO ---
export default function SimulacionExamenPage() {
  const params = useParams();
  const router = useRouter();
  const { examId } = params;

  const s = useSimulacionExamen(examId);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  if (s.loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={48} color="#1B396A" />
    </div>
  );

  if (s.loadError) return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#ef4444" }}>
      <p style={{ fontWeight: "700" }}>{s.loadError}</p>
    </div>
  );

  const currentQ = s.questions[s.currentIdx] || { content: "Finalizado", options: [], points: 0 };

  // Reutilizable tanto en "una por una" como en "todas juntas".
  const renderAnswerArea = (q: SimQuestion, qIdx: number) => {
    if (q.type === 'multi_select') {
      const selected: string[] = Array.isArray(s.answers[qIdx]) ? s.answers[qIdx] : [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {(q.options ?? []).map((opt: string, i: number) => {
            const isSel = selected.includes(opt);
            return (
              <button key={i}
                onClick={() => s.setAnswers({ ...s.answers, [qIdx]: isSel ? selected.filter(x => x !== opt) : [...selected, opt] })}
                style={{ textAlign: "left", padding: "22px 28px", borderRadius: "18px", border: "2px solid", borderColor: isSel ? "#1B396A" : "#f1f5f9", backgroundColor: isSel ? "#f0f4ff" : "white", color: isSel ? "#1B396A" : "#475569", fontWeight: "700", fontSize: "1.1rem", cursor: "pointer" }}
              >{opt}</button>
            );
          })}
        </div>
      );
    }
    if (q.type === 'ordering') {
      const order: string[] = Array.isArray(s.answers[qIdx]) ? s.answers[qIdx] : (q.options ?? []);
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {order.map((item: string, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderRadius: "14px", border: "2px solid #f1f5f9" }}>
              <span style={{ fontWeight: "900", color: "#94a3b8" }}>{i + 1}.</span>
              <span style={{ flex: 1, fontWeight: "700", color: "#1B396A" }}>{item}</span>
              <button disabled={i === 0} onClick={() => { const next = [...order]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; s.setAnswers({ ...s.answers, [qIdx]: next }); }} style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#cbd5e1" : "#64748b" }}>▲</button>
              <button disabled={i === order.length - 1} onClick={() => { const next = [...order]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; s.setAnswers({ ...s.answers, [qIdx]: next }); }} style={{ border: "none", background: "none", cursor: i === order.length - 1 ? "default" : "pointer", color: i === order.length - 1 ? "#cbd5e1" : "#64748b" }}>▼</button>
            </div>
          ))}
        </div>
      );
    }
    if (q.type === 'short_answer') {
      return (
        <input
          value={(s.answers[qIdx] as string) || ""}
          onChange={(e) => s.setAnswers({ ...s.answers, [qIdx]: e.target.value })}
          placeholder="Escribe tu respuesta aquí..."
          style={{ width: "100%", borderRadius: "20px", border: "2px solid #f1f5f9", padding: "20px", fontSize: "1.1rem", outline: "none", fontFamily: "inherit" }}
        />
      );
    }
    if (q.type === 'fill_blank') {
      const blanksCount = q.options?.length || (q.content.match(/___/g) || []).length || 1;
      const given: string[] = Array.isArray(s.answers[qIdx]) ? s.answers[qIdx] : [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Array.from({ length: blanksCount }).map((_, i) => (
            <input key={i} value={given[i] ?? ""} placeholder={`Espacio ${i + 1}...`}
              onChange={(e) => { const next = [...given]; next[i] = e.target.value; s.setAnswers({ ...s.answers, [qIdx]: next }); }}
              style={{ width: "100%", borderRadius: "20px", border: "2px solid #f1f5f9", padding: "20px", fontSize: "1.1rem", outline: "none", fontFamily: "inherit" }} />
          ))}
        </div>
      );
    }
    if (q.type === 'matching') {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {q.left?.map((l: string, i: number) => (
              <div key={i} style={{ padding: "16px 20px", borderRadius: "14px", border: "2px solid #f1f5f9", fontWeight: "700", color: "#1B396A" }}>{i + 1}. {l}</div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {q.right?.map((r: string, i: number) => (
              <select
                key={i}
                value={s.answers[qIdx]?.[i] ?? ""}
                onChange={(e) => s.setAnswers({ ...s.answers, [qIdx]: { ...(s.answers[qIdx] ?? {}), [i]: e.target.value } })}
                style={{ padding: "16px 20px", borderRadius: "14px", border: "2px solid #f1f5f9", color: "#475569", fontWeight: "600" }}
              >
                <option value="">{String.fromCharCode(65 + i)}. {r}</option>
              </select>
            ))}
          </div>
        </div>
      );
    }
    if (q.type === 'open') {
      return (
        <textarea
          value={(s.answers[qIdx] as string) || ""}
          onChange={(e) => s.setAnswers({...s.answers, [qIdx]: e.target.value})}
          placeholder="Escribe tu respuesta aquí..."
          style={{ width: "100%", height: "200px", borderRadius: "20px", border: "2px solid #f1f5f9", padding: "20px", fontSize: "1.1rem", outline: "none", fontFamily: "inherit" }}
        />
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {(q.type === 'true_false' ? ["Verdadero", "Falso"] : (q.options ?? [])).map((opt: string, i: number) => (
          <button
            key={i}
            onClick={() => s.setAnswers({...s.answers, [qIdx]: opt})}
            style={{
              textAlign: "left", padding: "22px 28px", borderRadius: "18px", border: "2px solid",
              borderColor: s.answers[qIdx] === opt ? "#1B396A" : "#f1f5f9",
              backgroundColor: s.answers[qIdx] === opt ? "#f0f4ff" : "white",
              color: s.answers[qIdx] === opt ? "#1B396A" : "#475569",
              fontWeight: "700", fontSize: "1.1rem", transition: "0.2s", cursor: "pointer"
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  };

  // --- VISTA DE RESULTADOS (POST-SIMULACIÓN) ---
  if (s.isFinished) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", padding: "60px 20px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ backgroundColor: "#f0fdf4", color: "#16a34a", width: "100px", height: "100px", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto 30px", boxShadow: "0 10px 20px rgba(22, 163, 74, 0.1)" }}>
            <Trophy size={50} />
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", marginBottom: "10px" }}>Simulación Completada</h1>
          <p style={{ color: "#64748b", fontSize: "1.2rem", marginBottom: "20px" }}>Análisis generado por Certeza AIA para el docente.</p>

          {s.copyAttempts > 0 && (
            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "16px", padding: "16px 20px", marginBottom: "30px", display: "inline-flex", alignItems: "center", gap: "10px", color: "#991b1b", fontWeight: "700" }}>
              <ShieldAlert size={20} /> {s.copyAttempts} intento(s) de copiar/pegar bloqueado(s) durante esta simulación
            </div>
          )}

          <div style={{ textAlign: "left", backgroundColor: "white", padding: "40px", borderRadius: "32px", border: "1px solid #bfdbfe", boxShadow: "0 20px 40px rgba(37, 99, 235, 0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#2563eb", marginBottom: "25px" }}>
              <Sparkles size={28} />
              <h3 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "900" }}>Plan de Refuerzo Inteligente</h3>
            </div>

            {s.isAnalyzing ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <Loader2 className="animate-spin" size={30} color="#2563eb" />
                <p style={{ marginTop: "15px", color: "#64748b", fontWeight: "600" }}>Gemini está analizando las brechas de aprendizaje...</p>
              </div>
            ) : (
              <>
                <p style={{ color: "#1e293b", lineHeight: "1.7", backgroundColor: "#f0f7ff", padding: "25px", borderRadius: "18px", borderLeft: "6px solid #2563eb", fontSize: "1.1rem" }}>
                  {s.aiResult?.plan || "No se pudo generar el plan de refuerzo en este momento."}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "30px" }}>
                  <div style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <Target size={24} color="#10b981" />
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase" }}>Fortaleza</span>
                      <div style={{ fontWeight: "800", color: "#1B396A" }}>{s.aiResult?.fortaleza || "No disponible"}</div>
                    </div>
                  </div>
                  <div style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <BookOpen size={24} color="#f59e0b" />
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase" }}>A Reforzar</span>
                      <div style={{ fontWeight: "800", color: "#1B396A" }}>{s.aiResult?.repaso || "No disponible"}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <button onClick={() => router.back()} style={{ marginTop: "50px", backgroundColor: "#1B396A", color: "white", border: "none", padding: "18px 50px", borderRadius: "16px", fontWeight: "800", cursor: "pointer", fontSize: "1.1rem", transition: "0.3s" }}>
            Finalizar Previsualización
          </button>
        </div>
      </div>
    );
  }

  // --- VISTA DE EXAMEN ACTIVO ---
  return (
    <div
      style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#F8FAFC", userSelect: "none" }}
      onCopy={(e) => { e.preventDefault(); s.flagCheatAttempt(); }}
      onCut={(e) => { e.preventDefault(); s.flagCheatAttempt(); }}
      onPaste={(e) => { e.preventDefault(); s.flagCheatAttempt(); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {s.showCheatWarning && (
        <div style={{ position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", backgroundColor: "#ef4444", color: "white", padding: "12px 24px", borderRadius: "100px", fontWeight: "800", boxShadow: "0 10px 20px rgba(239,68,68,0.3)", zIndex: 2000, display: "flex", alignItems: "center", gap: "10px" }}>
          <ShieldAlert size={18} /> Copiar/pegar está bloqueado en este examen
        </div>
      )}

      <header style={{ backgroundColor: "white", padding: "18px 40px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <div style={{ backgroundColor: "#1B396A", color: "white", padding: "10px 14px", borderRadius: "10px", fontWeight: "900", fontSize: "0.9rem" }}>EUI</div>
          <h2 style={{ color: "#1B396A", margin: 0, fontSize: "1.2rem", fontWeight: "800" }}>Modo Simulación: Vista del Alumno</h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
          <div style={{ backgroundColor: "#f1f5f9", padding: "10px 20px", borderRadius: "12px", color: s.timeLeft < 300 ? "#ef4444" : "#1B396A", fontWeight: "900", display: "flex", alignItems: "center", gap: "10px", transition: "0.3s" }}>
            <Clock size={20} /> {formatTime(s.timeLeft)}
          </div>
          <button onClick={s.handleFinish} style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
            Enviar Examen <Send size={18} />
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: "60px 20px", display: "flex", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: "850px" }}>

          {!s.showAllQuestions && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "40px" }}>
              {s.questions.map((_, i: number) => (
                <div key={i} style={{ flex: 1, height: "8px", borderRadius: "10px", backgroundColor: i === s.currentIdx ? "#1B396A" : i < s.currentIdx ? "#94a3b8" : "#e2e8f0", transition: "0.4s" }} />
              ))}
            </div>
          )}

          {s.showAllQuestions ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {s.questions.map((q, idx: number) => (
                <div key={q.id} style={{ backgroundColor: "white", padding: "40px", borderRadius: "32px", border: "1px solid #e2e8f0", boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px", alignItems: "center" }}>
                    <span style={{ color: "#94a3b8", fontWeight: "900", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reactivo {idx + 1} de {s.questions.length} · {TYPE_LABELS[q.type] ?? q.type}</span>
                    <div style={{ backgroundColor: "#f8fafc", padding: "6px 14px", borderRadius: "10px", color: "#1B396A", fontWeight: "900", fontSize: "0.85rem" }}>VALOR: {q.points} PTS</div>
                  </div>
                  <h2 style={{ color: "#1B396A", marginBottom: "30px", lineHeight: "1.5", fontSize: "1.5rem", fontWeight: "800" }}>{q.content}</h2>
                  {renderAnswerArea(q, idx)}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={{ backgroundColor: "white", padding: "50px", borderRadius: "32px", border: "1px solid #e2e8f0", boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px", alignItems: "center" }}>
                   <span style={{ color: "#94a3b8", fontWeight: "900", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reactivo {s.currentIdx + 1} de {s.questions.length} · {TYPE_LABELS[currentQ.type] ?? currentQ.type}</span>
                   <div style={{ backgroundColor: "#f8fafc", padding: "6px 14px", borderRadius: "10px", color: "#1B396A", fontWeight: "900", fontSize: "0.85rem" }}>VALOR: {currentQ.points} PTS</div>
                </div>

                <h2 style={{ color: "#1B396A", marginBottom: "50px", lineHeight: "1.5", fontSize: "1.8rem", fontWeight: "800" }}>{currentQ.content}</h2>

                {renderAnswerArea(currentQ, s.currentIdx)}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px" }}>
                <button disabled={s.currentIdx === 0} onClick={() => s.setCurrentIdx(prev => prev - 1)} style={{ background: "none", border: "none", color: s.currentIdx === 0 ? "#cbd5e1" : "#1B396A", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "1rem" }}>
                  <ChevronLeft size={24} /> Anterior
                </button>
                <button disabled={s.currentIdx === s.questions.length - 1} onClick={() => s.setCurrentIdx(prev => prev + 1)} style={{ background: "none", border: "none", color: s.currentIdx === s.questions.length - 1 ? "#cbd5e1" : "#1B396A", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "1rem" }}>
                  Siguiente <ChevronRight size={24} />
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      <footer style={{ padding: "18px", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem", borderTop: "1px solid #e2e8f0", backgroundColor: "white", fontWeight: "700" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
          <AlertTriangle size={18} color="#f59e0b" /> MODO SIMULACIÓN: las respuestas son temporales y no afectan la base de datos real. El bloqueo de copiar/pegar es el mismo que verá el alumno.
        </div>
      </footer>
    </div>
  );
}
