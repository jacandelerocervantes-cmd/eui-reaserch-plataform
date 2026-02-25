"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; 
import { 
  Sparkles, Save, Trash2, Calendar, 
  Layers, Play, Ban, Loader2, AlertCircle, 
  Calculator, Send, Trophy, BookOpen, 
  ArrowLeft, ChevronRight
} from "lucide-react";

// --- COMPONENTE: ExpandingButton (Tu ADN Visual) ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", disabled = false, small = false, loading = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", border: "transparent" };
      case "secondary": return { bg: "white", hoverBg: "#f8fafc", text: "#1B396A", border: "#cbd5e1" };
      case "ai": return { bg: "#f0f7ff", hoverBg: "#e0efff", text: "#2563eb", border: "#bfdbfe" };
      case "danger": return { bg: "#fee2e2", hoverBg: "#ef4444", text: isHovered ? "white" : "#ef4444", border: "transparent" };
      case "cancel": return { bg: "white", hoverBg: "#fee2e2", text: isHovered ? "#ef4444" : "#64748b", border: isHovered ? "#ef4444" : "#cbd5e1" };
      default: return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", border: "#cbd5e1" };
    }
  };
  const style = getStyles();
  return (
    <button 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)} 
      onClick={onClick} 
      disabled={disabled || loading} 
      style={{ 
        display: "flex", alignItems: "center", justifyContent: "center", 
        gap: (isHovered || loading) ? "8px" : "0px", 
        backgroundColor: (isHovered || loading) && !disabled ? style.hoverBg : style.bg, 
        color: style.text, border: `1px solid ${style.border}`, 
        borderRadius: "12px", padding: "0 14px", height: small ? "36px" : "44px", 
        fontWeight: "600", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
        overflow: "hidden", whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer" 
      }}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : (Icon && <Icon size={small ? 18 : 20} style={{ flexShrink: 0 }} />)}
      <span style={{ maxWidth: (isHovered || loading) ? "200px" : "0px", opacity: (isHovered || loading) ? 1 : 0, transition: "0.3s" }}>
        {loading ? "Procesando..." : label}
      </span>
    </button>
  );
};

// --- MODAL DE SIMULACIÓN ---
const SimulacionModal = ({ questions, onClose }: any) => {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const currentQ = questions[idx];

  if (done) return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "#F8FAFC", zIndex: 5000, display: "flex", justifyContent: "center", alignItems: "center", padding: "40px" }}>
      <div style={{ maxWidth: "600px", textAlign: "center" }}>
        <Trophy size={60} color="#1B396A" style={{ margin: "0 auto 20px" }} />
        <h1 style={{ color: "#1B396A" }}>¡Simulación Completa!</h1>
        <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "20px", border: "1px solid #bfdbfe", textAlign: "left" }}>
          <div style={{ display: "flex", gap: "10px", color: "#2563eb", marginBottom: "15px" }}><Sparkles /> <strong>Certeza AIA:</strong></div>
          <p style={{ color: "#1e293b", fontSize: "1rem" }}>"Evaluación equilibrada. Se recomienda revisar el tiempo límite asignado."</p>
        </div>
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
      <main style={{ flex: 1, padding: "40px", display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: "700px", width: "100%" }}>
          <div style={{ backgroundColor: "white", padding: "40px", borderRadius: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <p style={{ color: "#94a3b8", fontWeight: "800", fontSize: "0.8rem" }}>REACTIVO {idx + 1} DE {questions.length}</p>
            <h2 style={{ color: "#1B396A", margin: "10px 0 30px" }}>{currentQ?.content}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {currentQ?.options?.map((o: any, i: number) => (
                <button key={i} style={{ textAlign: "left", padding: "15px 20px", borderRadius: "12px", border: "2px solid #f1f5f9", fontWeight: "600", color: "#64748b", backgroundColor: "white" }}>{o}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px" }}>
            <button disabled={idx === 0} onClick={() => setIdx(idx - 1)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "700", color: idx === 0 ? "#cbd5e1" : "#1B396A" }}>Anterior</button>
            <button disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "700", color: idx === questions.length - 1 ? "#cbd5e1" : "#1B396A" }}>Siguiente</button>
          </div>
        </div>
      </main>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function ExamenWorkspace() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id;

  // ESTADOS
  const [questions, setQuestions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [deployment, setDeployment] = useState("interno"); // "interno" | "google_forms"
  const [examConfig, setExamConfig] = useState({ title: "", date: "" });

  // Lógica de Puntaje: $$Total = \sum_{i=1}^{n} Reactivo_i$$
  useEffect(() => {
    const sum = questions.reduce((acc, q) => acc + (parseFloat(q.points) || 0), 0);
    setTotal(Number(sum.toFixed(1)));
  }, [questions]);

  // FUNCIÓN: Generador Interactivo IA
  const handleGenerateAI = async () => {
    if (!search) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-exam-ia', {
        body: { prompt: search, currentCount: questions.length }
      });
      if (error) throw error;
      
      // La IA puede devolver nuevos o modificar. Por ahora añadimos.
      setQuestions([...questions, ...data.questions]);
      setSearch(""); 
    } catch (err: any) {
      alert("Certeza AIA: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (deployment === "google_forms") {
        const { data, error } = await supabase.functions.invoke('publish-exam', {
          body: {
            action: 'crearFormularioEvaluacion',
            payload: {
              title: examConfig.title,
              questions: questions,
              unitName: "Unidad 1" 
            }
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Error al publicar en Forms");

        alert("¡Examen publicado exitosamente en Google Forms!");
        router.back();
      } else {
        alert("Guardando configuración interna en Supabase...");
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#F8FAFC", overflow: "hidden" }}>
      
      {/* PANEL CENTRAL: REACTIVOS */}
      <div style={{ flex: 1, padding: "30px 40px", overflowY: "auto" }}>
        
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#64748b", fontWeight: "700", cursor: "pointer", marginBottom: "20px" }}>
          <ArrowLeft size={18} /> Volver a Evaluaciones
        </button>

        {/* BARRA DE IA INTERACTIVA */}
        <div style={{ backgroundColor: "white", padding: "12px 20px", borderRadius: "18px", display: "flex", gap: "15px", border: "1px solid #e2e8f0", marginBottom: "30px", alignItems: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.03)" }}>
          <Sparkles color="#2563eb" size={20} />
          <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Gemini: 'Genera 5 preguntas sobre redes' o 'Cambia la pregunta 2'..." 
            style={{ flex: 1, border: "none", outline: "none", fontWeight: "600", fontSize: "1rem", color: "#1B396A" }} 
          />
          <ExpandingButton 
            icon={Sparkles} label="Generar" variant="ai" 
            onClick={handleGenerateAI} loading={isGenerating} 
          />
        </div>

        {/* INDICADOR DE PUNTAJE DINÁMICO */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: total === 100 ? "#f0fdf4" : "#fff1f2", padding: "15px 25px", borderRadius: "15px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", marginBottom: "30px", alignItems: "center", transition: "0.4s" }}>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b" }}>VALOR TOTAL ACUMULADO:</span>
            <h2 style={{ margin: 0, color: total === 100 ? "#16a34a" : "#dc2626", fontWeight: "900" }}>{total} / 100 pts</h2>
          </div>
          <ExpandingButton 
            icon={Calculator} label="Equilibrar Puntos" variant="secondary" small 
            onClick={() => setQuestions(questions.map(q => ({ ...q, points: (100 / questions.length).toFixed(1) })))} 
            disabled={questions.length === 0}
          />
        </div>

        {/* LISTA DE REACTIVOS (STYLE PREMIUM) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", paddingBottom: "100px" }}>
          {questions.map((q, idx) => (
            <div key={idx} style={{ backgroundColor: "white", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                   <div style={{ backgroundColor: "#1B396A", color: "white", width: "32px", height: "32px", borderRadius: "8px", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "900" }}>{idx + 1}</div>
                   <span style={{ fontSize: "0.75rem", fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{q.type?.replace('_',' ')}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#f8fafc", padding: "6px 14px", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
                   <span style={{ fontSize: "0.7rem", fontWeight: "900", color: "#64748b" }}>PUNTOS:</span>
                   <input 
                    type="number" value={q.points} 
                    onChange={(e) => setQuestions(questions.map((item, i) => i === idx ? { ...item, points: e.target.value } : item))} 
                    style={{ width: "45px", border: "none", background: "transparent", fontWeight: "900", color: "#1B396A", textAlign: "center", outline: "none", fontSize: "1rem" }} 
                   />
                </div>
              </div>
              <textarea 
                value={q.content} 
                onChange={(e) => setQuestions(questions.map((item, i) => i === idx ? { ...item, content: e.target.value } : item))} 
                style={{ width: "100%", border: "none", outline: "none", fontSize: "1.15rem", fontWeight: "700", color: "#1B396A", resize: "none", fontFamily: "inherit", lineHeight: "1.5" }} 
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <ExpandingButton icon={Trash2} label="Eliminar" onClick={() => setQuestions(questions.filter((_, i) => i !== idx))} variant="danger" small />
              </div>
            </div>
          ))}
          {questions.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 20px", color: "#94a3b8", backgroundColor: "white", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
              <BookOpen size={48} style={{ margin: "0 auto 16px", opacity: 0.2 }} />
              <p style={{ fontWeight: "600" }}>Tu examen está vacío. <br/> Pídele a Certeza AIA que genere los primeros reactivos.</p>
            </div>
          )}
        </div>
      </div>

      {/* PANEL DERECHO: CONFIGURACIÓN */}
      <div style={{ width: "380px", backgroundColor: "white", borderLeft: "1px solid #e2e8f0", padding: "35px", display: "flex", flexDirection: "column" }}>
        <h3 style={{ color: "#1B396A", marginBottom: "30px", display: "flex", alignItems: "center", gap: "12px", fontWeight: "950", fontSize: "1.3rem" }}>
          <Layers size={22} /> Propiedades
        </h3>
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "28px" }}>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Título de la Evaluación</label>
            <input 
              value={examConfig.title} onChange={(e) => setExamConfig({...examConfig, title: e.target.value})}
              placeholder="Ej: Examen Unidad 1: Redes..." 
              style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #cbd5e1", outline: "none", fontSize: "1rem", color: "#1B396A", fontWeight: "600" }} 
            />
          </div>

          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "900", color: "#64748b", display: "block", marginBottom: "10px", textTransform: "uppercase" }}>Método de Aplicación</label>
            <div style={{ display: "flex", gap: "6px", backgroundColor: "#f1f5f9", padding: "5px", borderRadius: "14px" }}>
              <button 
                onClick={() => setDeployment("interno")}
                style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", fontSize: "0.75rem", fontWeight: "900", cursor: "pointer", backgroundColor: deployment === "interno" ? "white" : "transparent", transition: "0.3s", boxShadow: deployment === "interno" ? "0 4px 6px rgba(0,0,0,0.05)" : "none", color: deployment === "interno" ? "#1B396A" : "#64748b" }}
              >INTERNO</button>
              <button 
                onClick={() => setDeployment("google_forms")}
                style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", fontSize: "0.75rem", fontWeight: "900", cursor: "pointer", backgroundColor: deployment === "google_forms" ? "white" : "transparent", transition: "0.3s", boxShadow: deployment === "google_forms" ? "0 4px 6px rgba(0,0,0,0.05)" : "none", color: deployment === "google_forms" ? "#1B396A" : "#64748b" }}
              >GOOGLE FORMS</button>
            </div>
          </div>
        </div>

        {/* ACCIONES FINALES */}
        <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <ExpandingButton icon={Play} label="Simular Vista Alumno" onClick={() => setIsSimulating(true)} variant="secondary" disabled={questions.length === 0} />
          <div style={{ display: "flex", gap: "10px" }}>
            <ExpandingButton icon={Ban} label="Cancelar" onClick={() => router.back()} variant="cancel" />
            <ExpandingButton 
              icon={deployment === "google_forms" ? Send : Save} 
              label={isPublishing ? "Publicando..." : (deployment === "google_forms" ? "Enviar a Forms" : "Publicar")} 
              onClick={handlePublish} 
              disabled={total !== 100 || !examConfig.title || isPublishing} 
              loading={isPublishing}
            />
          </div>
          {total !== 100 && questions.length > 0 && (
            <div style={{ color: "#dc2626", fontSize: "0.75rem", textAlign: "center", fontWeight: "900", marginTop: "8px", backgroundColor: "#fef2f2", padding: "10px", borderRadius: "10px", border: "1px solid #fee2e2" }}>
              <AlertCircle size={14} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
              Faltan {Math.abs(100 - total).toFixed(1)} pts para el total.
            </div>
          )}
        </div>
      </div>

      {isSimulating && <SimulacionModal questions={questions} onClose={() => setIsSimulating(false)} />}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}