"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Sparkles, Paperclip, Save, Trash2, Calendar, Clock, 
  Layers, Play, Ban, CheckCircle2, Loader2, AlertCircle, 
  Calculator, Send, Trophy, Target, BookOpen, HelpCircle, 
  AlignLeft, ListOrdered, GripVertical
} from "lucide-react";

// --- COMPONENTE: ExpandingButton ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", disabled = false, small = false }: any) => {
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
    <button onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onClick={onClick} disabled={disabled} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: isHovered ? "8px" : "0px", backgroundColor: isHovered && !disabled ? style.hoverBg : style.bg, color: style.text, border: `1px solid ${style.border}`, borderRadius: "12px", padding: "0 14px", height: small ? "36px" : "44px", fontWeight: "600", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", whiteSpace: "nowrap" }}>
      {Icon && <Icon size={small ? 18 : 20} style={{ flexShrink: 0 }} />}
      <span style={{ maxWidth: isHovered ? "200px" : "0px", opacity: isHovered ? 1 : 0, transition: "0.3s" }}>{label}</span>
    </button>
  );
};

// --- DATOS DE EJEMPLO (PRESET) ---
const EXAMEN_COMPLETO_MOCK = [
  { id: 1, type: "opcion_multiple", content: "¿Cuál protocolo garantiza la entrega íntegra de datos?", options: ["UDP", "TCP", "ICMP", "HTTP"], answer: "TCP", points: 20, bloom: "Recordar" },
  { id: 2, type: "verdadero_falso", content: "Una clase abstracta puede ser instanciada directamente.", options: ["Verdadero", "Falso"], answer: "Falso", points: 15, bloom: "Comprender" },
  { id: 3, type: "abierta", content: "Explica la importancia de la Normalización en bases de datos relacionales.", options: [], points: 25, bloom: "Analizar" },
  { id: 4, type: "relacionar", content: "Relaciona los conceptos de seguridad informática:", options: ["SQL Injection - Web", "Phishing - Correo", "Brute Force - Passwords"], points: 20, bloom: "Aplicar" },
  { id: 5, type: "ordenamiento", content: "Ordena las fases del ciclo de vida del software:", options: ["1. Análisis", "2. Diseño", "3. Pruebas"], points: 20, bloom: "Crear" }
];

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
          <div style={{ display: "flex", gap: "10px", color: "#2563eb", marginBottom: "15px" }}><Sparkles /> <strong>Feedback de Gemini AI:</strong></div>
          <p style={{ color: "#1e293b", fontSize: "1rem" }}>"Excelente manejo de conceptos. En la pregunta abierta sobre <strong>Normalización</strong>, recuerda mencionar la 3ra Forma Normal para obtener puntaje máximo."</p>
        </div>
        <button onClick={onClose} style={{ marginTop: "30px", backgroundColor: "#1B396A", color: "white", border: "none", padding: "12px 30px", borderRadius: "12px", cursor: "pointer", fontWeight: "700" }}>Cerrar Vista Previa</button>
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "#F8FAFC", zIndex: 5000, display: "flex", flexDirection: "column" }}>
      <header style={{ backgroundColor: "white", padding: "20px 40px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
        <h2 style={{ color: "#1B396A", margin: 0 }}>Simulación: Examen de Ingeniería</h2>
        <button onClick={() => setDone(true)} style={{ backgroundColor: "#1B396A", color: "white", border: "none", padding: "10px 25px", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}>Finalizar</button>
      </header>
      <main style={{ flex: 1, padding: "40px", display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: "700px", width: "100%" }}>
          <div style={{ backgroundColor: "white", padding: "40px", borderRadius: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <p style={{ color: "#94a3b8", fontWeight: "800", fontSize: "0.8rem" }}>PREGUNTA {idx + 1} DE {questions.length} ({currentQ.type.replace('_',' ')})</p>
            <h2 style={{ color: "#1B396A", margin: "10px 0 30px" }}>{currentQ.content}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {currentQ.type === 'abierta' ? (
                <textarea placeholder="Escribe tu respuesta analítica..." style={{ width: "100%", height: "150px", padding: "15px", borderRadius: "12px", border: "2px solid #f1f5f9", outline: "none" }} />
              ) : (
                currentQ.options.map((o: any, i: number) => (
                  <button key={i} style={{ textAlign: "left", padding: "15px 20px", borderRadius: "12px", border: "2px solid #f1f5f9", fontWeight: "600", color: "#64748b", backgroundColor: "white" }}>{o}</button>
                ))
              )}
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
  const router = useRouter();
  const [questions, setQuestions] = useState<any[]>(EXAMEN_COMPLETO_MOCK); // Cargamos el Mock por defecto
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const sum = questions.reduce((acc, q) => acc + (parseFloat(q.points) || 0), 0);
    setTotal(Number(sum.toFixed(2)));
  }, [questions]);

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#F8FAFC", overflow: "hidden" }}>
      
      {/* CENTRO: BANDEJA DE REACTIVOS */}
      <div style={{ flex: 1, padding: "30px 40px", overflowY: "auto" }}>
        
        {/* BARRA IA */}
        <div style={{ backgroundColor: "white", padding: "12px 20px", borderRadius: "18px", display: "flex", gap: "15px", border: "1px solid #e2e8f0", marginBottom: "30px", alignItems: "center" }}>
          <Sparkles color="#2563eb" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Gemini: Genera más reactivos..." style={{ flex: 1, border: "none", outline: "none", fontWeight: "500" }} />
          <ExpandingButton icon={Sparkles} label="Generar" variant="ai" />
        </div>

        {/* CONTADOR DE PUNTOS */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: total === 100 ? "#f0fdf4" : "#fff1f2", padding: "15px 25px", borderRadius: "15px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", marginBottom: "30px", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b" }}>PUNTAJE ACUMULADO:</span>
            <h2 style={{ margin: 0, color: total === 100 ? "#16a34a" : "#dc2626" }}>{total} / 100 pts</h2>
          </div>
          <ExpandingButton icon={Calculator} label="Equilibrar Puntos" onClick={() => setQuestions(questions.map(q => ({ ...q, points: (100 / questions.length).toFixed(1) })))} variant="secondary" small />
        </div>

        {/* LISTA DE CARDS (STYLE ACTIVIDADES) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", paddingBottom: "100px" }}>
          {questions.map((q, idx) => (
            <div key={q.id} style={{ backgroundColor: "white", padding: "20px", borderRadius: "20px", border: "1px solid #e2e8f0", transition: "0.2s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                   <div style={{ backgroundColor: "#1B396A", color: "white", width: "28px", height: "28px", borderRadius: "6px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "0.75rem", fontWeight: "800" }}>{idx + 1}</div>
                   <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase" }}>{q.type.replace('_',' ')}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#f8fafc", padding: "5px 12px", borderRadius: "10px" }}>
                   <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#64748b" }}>VALOR:</span>
                   <input type="number" value={q.points} onChange={(e) => setQuestions(questions.map(item => item.id === q.id ? { ...item, points: e.target.value } : item))} style={{ width: "50px", border: "none", background: "transparent", fontWeight: "800", color: "#1B396A", textAlign: "center", outline: "none" }} />
                </div>
              </div>
              
              <textarea value={q.content} onChange={(e) => setQuestions(questions.map(item => item.id === q.id ? { ...item, content: e.target.value } : item))} style={{ width: "100%", border: "none", outline: "none", fontSize: "1.1rem", fontWeight: "600", color: "#1B396A", resize: "none", fontFamily: "inherit" }} />
              
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "15px", gap: "10px" }}>
                <ExpandingButton icon={Trash2} label="Eliminar" onClick={() => setQuestions(questions.filter(i => i.id !== q.id))} variant="danger" small />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DERECHA: CONFIGURACIÓN */}
      <div style={{ width: "360px", backgroundColor: "white", borderLeft: "1px solid #e2e8f0", padding: "30px", display: "flex", flexDirection: "column" }}>
        <h3 style={{ color: "#1B396A", marginBottom: "25px", display: "flex", alignItems: "center", gap: "10px" }}><Layers size={20} /> Propiedades</h3>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b" }}>TÍTULO</label>
            <input placeholder="Examen Unidad 1..." style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginTop: "5px" }} />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#64748b" }}>FECHA PROGRAMADA</label>
            <input type="date" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginTop: "5px" }} />
          </div>
        </div>

        <div style={{ marginTop: "30px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <ExpandingButton icon={Play} label="Modo Simulación" onClick={() => setIsSimulating(true)} variant="secondary" />
          <div style={{ display: "flex", gap: "10px" }}>
            <ExpandingButton icon={Ban} label="Cancelar" onClick={() => router.back()} variant="cancel" />
            <ExpandingButton icon={Save} label="Publicar" onClick={() => {}} disabled={total !== 100} />
          </div>
          {total !== 100 && <p style={{ color: "#dc2626", fontSize: "0.7rem", textAlign: "center", fontWeight: "700" }}>* La suma debe ser 100 para publicar.</p>}
        </div>
      </div>

      {/* MODAL DE SIMULACIÓN */}
      {isSimulating && <SimulacionModal questions={questions} onClose={() => setIsSimulating(false)} />}
    </div>
  );
}