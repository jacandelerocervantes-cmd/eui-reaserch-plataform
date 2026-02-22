"use client";

import { useState, useEffect } from "react";
import { 
  Clock, ChevronLeft, ChevronRight, Send, 
  AlertTriangle, Trophy, Sparkles, X, 
  CheckCircle2, Target, BookOpen
} from "lucide-react";

// --- COMPONENTE DE SIMULACIÓN (COMO MODAL / OVERLAY) ---
export default function SimulacionModal({ questions, onClose }: any) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<any>({});
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutos

  const currentQ = questions[currentIdx] || { content: "Sin contenido", options: [], points: 0 };

  // Timer Placeholder
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (isFinished) {
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "#F8FAFC", zIndex: 5000, overflowY: "auto", padding: "40px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ backgroundColor: "#f0fdf4", color: "#16a34a", width: "80px", height: "80px", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto 20px" }}>
            <Trophy size={40} />
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.5rem", fontWeight: "800" }}>¡Examen Enviado!</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem" }}>Has completado la simulación de la Unidad.</p>

          {/* --- PLACEHOLDER DE RETROALIMENTACIÓN DE GEMINI --- */}
          <div style={{ marginTop: "40px", textAlign: "left", backgroundColor: "white", padding: "30px", borderRadius: "24px", border: "1px solid #bfdbfe", boxShadow: "0 10px 25px rgba(37, 99, 235, 0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#2563eb", marginBottom: "20px" }}>
              <Sparkles size={24} />
              <h3 style={{ margin: 0 }}>Plan de Refuerzo Inteligente (AI Placeholder)</h3>
            </div>
            
            <p style={{ color: "#1e293b", lineHeight: "1.6", backgroundColor: "#f0f7ff", padding: "20px", borderRadius: "15px", borderLeft: "4px solid #2563eb" }}>
              "Hola Juan, basándome en tus respuestas, dominas los conceptos teóricos pero tuviste dificultades en la aplicación práctica de <strong>Normalización</strong>. Te sugiero repasar los videos de la Unidad 2 y realizar los ejercicios complementarios de la página 45."
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginTop: "20px" }}>
              <div style={{ padding: "15px", border: "1px solid #e2e8f0", borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                <Target size={20} color="#10b981" />
                <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Fortaleza: <strong>SQL DDL</strong></span>
              </div>
              <div style={{ padding: "15px", border: "1px solid #e2e8f0", borderRadius: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                <BookOpen size={20} color="#f59e0b" />
                <span style={{ fontSize: "0.9rem", color: "#64748b" }}>Repasar: <strong>Claves Foráneas</strong></span>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose} 
            style={{ marginTop: "40px", backgroundColor: "#1B396A", color: "white", border: "none", padding: "15px 40px", borderRadius: "12px", fontWeight: "700", cursor: "pointer" }}
          >
            Regresar al Editor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "#F8FAFC", zIndex: 5000, display: "flex", flexDirection: "column" }}>
      
      {/* HEADER ALUMNO */}
      <header style={{ backgroundColor: "white", padding: "15px 40px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <div style={{ backgroundColor: "#1B396A", color: "white", padding: "8px 12px", borderRadius: "8px", fontWeight: "800", fontSize: "0.8rem" }}>TEC</div>
          <h2 style={{ color: "#1B396A", margin: 0, fontSize: "1.1rem" }}>Simulación: Vista del Alumno</h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ backgroundColor: "#f1f5f9", padding: "8px 15px", borderRadius: "10px", color: "#1B396A", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={18} /> {formatTime(timeLeft)}
          </div>
          <button 
            onClick={() => setIsFinished(true)}
            style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "10px 20px", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            Enviar Examen <Send size={16} />
          </button>
        </div>
      </header>

      {/* CUERPO DEL EXAMEN */}
      <main style={{ flex: 1, padding: "40px", display: "flex", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: "800px" }}>
          
          {/* BARRA DE PROGRESO */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "30px" }}>
            {questions.map((_: any, i: number) => (
              <div key={i} style={{ flex: 1, height: "6px", borderRadius: "10px", backgroundColor: i <= currentIdx ? "#1B396A" : "#e2e8f0", transition: "0.3s" }} />
            ))}
          </div>

          {/* CARD DE PREGUNTA */}
          <div style={{ backgroundColor: "white", padding: "40px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 25px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
               <span style={{ color: "#94a3b8", fontWeight: "800", fontSize: "0.8rem", textTransform: "uppercase" }}>Pregunta {currentIdx + 1} de {questions.length}</span>
               <span style={{ color: "#1B396A", fontWeight: "800", fontSize: "0.8rem" }}>VALOR: {currentQ.points} PTS</span>
            </div>
            
            <h2 style={{ color: "#1B396A", marginBottom: "40px", lineHeight: "1.4" }}>{currentQ.content}</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {currentQ.options?.map((opt: string, i: number) => (
                <button 
                  key={i} 
                  onClick={() => setAnswers({...answers, [currentQ.id]: opt})}
                  style={{ 
                    textAlign: "left", padding: "20px 25px", borderRadius: "15px", border: "2px solid", 
                    borderColor: answers[currentQ.id] === opt ? "#1B396A" : "#f1f5f9",
                    backgroundColor: answers[currentQ.id] === opt ? "#f0f4ff" : "white",
                    color: answers[currentQ.id] === opt ? "#1B396A" : "#64748b",
                    fontWeight: "600", transition: "0.2s", cursor: "pointer"
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* NAVEGACIÓN */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
            <button 
              disabled={currentIdx === 0} 
              onClick={() => setCurrentIdx(prev => prev - 1)}
              style={{ background: "none", border: "none", color: currentIdx === 0 ? "#cbd5e1" : "#1B396A", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <ChevronLeft /> Anterior
            </button>
            <button 
              disabled={currentIdx === questions.length - 1} 
              onClick={() => setCurrentIdx(prev => prev + 1)}
              style={{ background: "none", border: "none", color: currentIdx === questions.length - 1 ? "#cbd5e1" : "#1B396A", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
            >
              Siguiente <ChevronRight />
            </button>
          </div>
        </div>
      </main>

      {/* FOOTER ADVERTENCIA */}
      <footer style={{ padding: "15px", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", borderTop: "1px solid #e2e8f0", backgroundColor: "white" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={14} /> Estás en modo previsualización. Ninguna respuesta será guardada en la base de datos real.
        </div>
      </footer>
    </div>
  );
}