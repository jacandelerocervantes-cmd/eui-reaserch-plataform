"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Clock, ChevronLeft, ChevronRight, Send, 
  AlertTriangle, Trophy, Sparkles, Loader2,
  Target, BookOpen, ArrowLeft
} from "lucide-react";

// --- COMPONENTE DE SIMULACIÓN COMPLETO ---
export default function SimulacionExamenPage() {
  const params = useParams();
  const router = useRouter();
  const { examId } = params;

  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<any>({});
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const [aiResult, setAiResult] = useState<any>(null);

  // 1. Cargar preguntas reales del examen
  useEffect(() => {
    async function loadExam() {
      setLoading(true);
      const { data, error } = await supabase
        .from('evaluations')
        .select('reactivos_json, title')
        .eq('id', examId)
        .single();
      
      if (data) setQuestions(data.reactivos_json || []);
      setLoading(false);
    }
    if (examId) loadExam();
  }, [examId]);

  // 2. Timer
  useEffect(() => {
    if (isFinished) return;
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isFinished]);

  // 3. Procesar resultados con la Edge Function
  const handleFinish = async () => {
    setIsFinished(true);
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-simulation', {
        body: { 
          questions, 
          answers, 
          studentName: "Estudiante de Prueba" 
        }
      });
      if (error) throw error;
      setAiResult(data);
    } catch (e) {
      console.error("Error en análisis IA:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={48} color="#1B396A" />
    </div>
  );

  const currentQ = questions[currentIdx] || { content: "Finalizado", options: [], points: 0 };

  // --- VISTA DE RESULTADOS (POST-SIMULACIÓN) ---
  if (isFinished) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", padding: "60px 20px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ backgroundColor: "#f0fdf4", color: "#16a34a", width: "100px", height: "100px", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto 30px", boxShadow: "0 10px 20px rgba(22, 163, 74, 0.1)" }}>
            <Trophy size={50} />
          </div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", marginBottom: "10px" }}>Simulación Completada</h1>
          <p style={{ color: "#64748b", fontSize: "1.2rem", marginBottom: "50px" }}>Análisis generado por Certeza AIA para el docente.</p>

          <div style={{ textAlign: "left", backgroundColor: "white", padding: "40px", borderRadius: "32px", border: "1px solid #bfdbfe", boxShadow: "0 20px 40px rgba(37, 99, 235, 0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#2563eb", marginBottom: "25px" }}>
              <Sparkles size={28} />
              <h3 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "900" }}>Plan de Refuerzo Inteligente</h3>
            </div>
            
            {isAnalyzing ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <Loader2 className="animate-spin" size={30} color="#2563eb" />
                <p style={{ marginTop: "15px", color: "#64748b", fontWeight: "600" }}>Gemini está analizando las brechas de aprendizaje...</p>
              </div>
            ) : (
              <>
                <p style={{ color: "#1e293b", lineHeight: "1.7", backgroundColor: "#f0f7ff", padding: "25px", borderRadius: "18px", borderLeft: "6px solid #2563eb", fontSize: "1.1rem" }}>
                  {aiResult?.plan || "No se pudo generar el plan de refuerzo en este momento."}
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "30px" }}>
                  <div style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <Target size={24} color="#10b981" />
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase" }}>Fortaleza</span>
                      <div style={{ fontWeight: "800", color: "#1B396A" }}>{aiResult?.fortaleza || "Detectando..."}</div>
                    </div>
                  </div>
                  <div style={{ padding: "20px", border: "1px solid #e2e8f0", borderRadius: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <BookOpen size={24} color="#f59e0b" />
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase" }}>A Reforzar</span>
                      <div style={{ fontWeight: "800", color: "#1B396A" }}>{aiResult?.repaso || "Detectando..."}</div>
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#F8FAFC" }}>
      
      <header style={{ backgroundColor: "white", padding: "18px 40px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <div style={{ backgroundColor: "#1B396A", color: "white", padding: "10px 14px", borderRadius: "10px", fontWeight: "900", fontSize: "0.9rem" }}>EUI</div>
          <h2 style={{ color: "#1B396A", margin: 0, fontSize: "1.2rem", fontWeight: "800" }}>Modo Simulación: Vista del Alumno</h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
          <div style={{ backgroundColor: "#f1f5f9", padding: "10px 20px", borderRadius: "12px", color: timeLeft < 300 ? "#ef4444" : "#1B396A", fontWeight: "900", display: "flex", alignItems: "center", gap: "10px", transition: "0.3s" }}>
            <Clock size={20} /> {formatTime(timeLeft)}
          </div>
          <button onClick={handleFinish} style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
            Enviar Examen <Send size={18} />
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: "60px 20px", display: "flex", justifyContent: "center", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: "850px" }}>
          
          <div style={{ display: "flex", gap: "10px", marginBottom: "40px" }}>
            {questions.map((_: any, i: number) => (
              <div key={i} style={{ flex: 1, height: "8px", borderRadius: "10px", backgroundColor: i === currentIdx ? "#1B396A" : i < currentIdx ? "#94a3b8" : "#e2e8f0", transition: "0.4s" }} />
            ))}
          </div>

          <div style={{ backgroundColor: "white", padding: "50px", borderRadius: "32px", border: "1px solid #e2e8f0", boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px", alignItems: "center" }}>
               <span style={{ color: "#94a3b8", fontWeight: "900", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reactivo {currentIdx + 1} de {questions.length}</span>
               <div style={{ backgroundColor: "#f8fafc", padding: "6px 14px", borderRadius: "10px", color: "#1B396A", fontWeight: "900", fontSize: "0.85rem" }}>VALOR: {currentQ.points} PTS</div>
            </div>
            
            <h2 style={{ color: "#1B396A", marginBottom: "50px", lineHeight: "1.5", fontSize: "1.8rem", fontWeight: "800" }}>{currentQ.content}</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {currentQ.options?.map((opt: string, i: number) => (
                <button 
                  key={i} 
                  onClick={() => setAnswers({...answers, [currentIdx]: opt})}
                  style={{ 
                    textAlign: "left", padding: "22px 28px", borderRadius: "18px", border: "2px solid", 
                    borderColor: answers[currentIdx] === opt ? "#1B396A" : "#f1f5f9",
                    backgroundColor: answers[currentIdx] === opt ? "#f0f4ff" : "white",
                    color: answers[currentIdx] === opt ? "#1B396A" : "#475569",
                    fontWeight: "700", fontSize: "1.1rem", transition: "0.2s", cursor: "pointer"
                  }}
                >
                  {opt}
                </button>
              ))}
              {currentQ.type === 'abierta' && (
                <textarea 
                  value={answers[currentIdx] || ""} 
                  onChange={(e) => setAnswers({...answers, [currentIdx]: e.target.value})}
                  placeholder="Escribe tu respuesta aquí..."
                  style={{ width: "100%", height: "200px", borderRadius: "20px", border: "2px solid #f1f5f9", padding: "20px", fontSize: "1.1rem", outline: "none", fontFamily: "inherit" }}
                />
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px" }}>
            <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(prev => prev - 1)} style={{ background: "none", border: "none", color: currentIdx === 0 ? "#cbd5e1" : "#1B396A", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "1rem" }}>
              <ChevronLeft size={24} /> Anterior
            </button>
            <button disabled={currentIdx === questions.length - 1} onClick={() => setCurrentIdx(prev => prev + 1)} style={{ background: "none", border: "none", color: currentIdx === questions.length - 1 ? "#cbd5e1" : "#1B396A", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "1rem" }}>
              Siguiente <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </main>

      <footer style={{ padding: "18px", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem", borderTop: "1px solid #e2e8f0", backgroundColor: "white", fontWeight: "700" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
          <AlertTriangle size={18} color="#f59e0b" /> MODO SIMULACIÓN: Las respuestas y el análisis son temporales y no afectan la base de datos real.
        </div>
      </footer>
    </div>
  );
}