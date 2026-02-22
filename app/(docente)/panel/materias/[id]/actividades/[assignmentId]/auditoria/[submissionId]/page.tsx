"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Wand2, CheckCircle2, MessageSquare, Save, 
  ChevronLeft, ChevronRight, Loader2
} from "lucide-react";

// --- COMPONENTE PREMIUM: BOTÓN EXPANDIBLE (ADN UNIFICADO) ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", disabled = false, defaultExpanded = false, loading = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Colores basados en tus diseños
  const bg = variant === "primary" ? "#152c54" : variant === "success" ? "#10b981" : "white";
  const color = variant === "default" ? "#64748b" : "white";

  // El botón se expande si está el mouse encima O si lo forzamos por prop
  const expanded = isHovered || defaultExpanded;

  return (
    <button
      onClick={onClick} 
      disabled={disabled || loading} 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", 
        gap: expanded && !loading ? "10px" : "0px",
        backgroundColor: bg, 
        color: color, 
        border: "1px solid transparent", 
        borderRadius: "14px", 
        padding: expanded && !loading ? "0 20px" : "0", 
        height: "52px", 
        fontWeight: "900", 
        fontSize: "1rem", 
        cursor: (disabled || loading) ? "not-allowed" : "pointer",
        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)", 
        overflow: "hidden", 
        whiteSpace: "nowrap", 
        boxShadow: "0 8px 15px rgba(0,0,0,0.1)", 
        minWidth: "52px",
        opacity: (disabled || loading) ? 0.7 : 1
      }}
    >
      {loading ? (
        <Loader2 size={22} className="animate-spin" />
      ) : (
        Icon && <Icon size={22} style={{ flexShrink: 0 }} />
      )}
      
      <span style={{ 
        maxWidth: expanded && !loading ? "200px" : "0px", 
        opacity: expanded && !loading ? 1 : 0, 
        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)", 
        display: "inline-block" 
      }}>
        {label}
      </span>
    </button>
  );
};

export default function AuditoriaIndividualPage() {
  const [scores, setScores] = useState<any>({ "Contenido": 85, "Análisis": 90, "Formato": 100 });
  const [feedback, setFeedback] = useState("El alumno demuestra un dominio técnico sobresaliente.");
  const [isSaving, setIsSaving] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Lógica técnica de Certeza AIA:
  // $$NotaFinal = \sum_{i=1}^{n} (Reactivo_i \times Peso_i)$$
  const total = useMemo(() => {
    const values = Object.values(scores) as number[];
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [scores]);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setToast("💾 Cambios guardados.");
      setTimeout(() => setToast(null), 2000);
    }, 1000);
  };

  const handlePublish = () => {
    setIsPublished(true);
    setToast("🎓 Calificación publicada.");
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "white", position: "relative" }}>
      
      {/* NOTIFICACIÓN TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: "110px", right: "40px", backgroundColor: "#152c54", color: "white", padding: "12px 24px", borderRadius: "12px", fontWeight: "800", boxShadow: "0 10px 20px rgba(0,0,0,0.2)", zIndex: 1000, animation: "fadeIn 0.3s ease" }}>
          {toast}
        </div>
      )}

      {/* HEADER DE TRABAJO */}
      <div style={{ height: "80px", padding: "0 30px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ textAlign: "left" }}>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "950", color: "#1B396A", letterSpacing: "-0.02em" }}>García López, María</h2>
          <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>Auditoría en Tiempo Real</span>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "6px", marginRight: "10px" }}>
             <button style={{ width: "48px", height: "48px", borderRadius: "14px", border: "1px solid #cbd5e1", background: "white", cursor: "pointer", color: "#64748b" }}><ChevronLeft size={22}/></button>
             <button style={{ width: "48px", height: "48px", borderRadius: "14px", border: "1px solid #cbd5e1", background: "white", cursor: "pointer", color: "#64748b" }}><ChevronRight size={22}/></button>
          </div>
          
          {/* BOTÓN PUBLICAR: SOLO ICONO INICIALMENTE */}
          <ExpandingButton 
            icon={CheckCircle2} 
            label={isPublished ? "Publicado" : "Publicar"} 
            onClick={handlePublish} 
            variant="success" 
            disabled={isPublished}
            defaultExpanded={false}
          />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* Lado Izquierdo: Documento */}
        <div style={{ flex: 1, backgroundColor: "#525659", padding: "50px", overflowY: "auto", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: "850px", minHeight: "1100px", backgroundColor: "white", boxShadow: "0 30px 60px rgba(0,0,0,0.5)", padding: "80px" }}>
             <h1 style={{ textAlign: "center", fontSize: "2rem", fontWeight: "1000", color: "#1B396A", borderBottom: "4px solid #1B396A", paddingBottom: "25px", marginBottom: "50px" }}>REPORTE TÉCNICO</h1>
             <p style={{ lineHeight: "2", fontSize: "1.15rem", color: "#1e293b" }}>[ Evidencia del alumno ]</p>
          </div>
        </div>

        {/* Lado Derecho: Controles IA */}
        <div style={{ width: "450px", borderLeft: "1px solid #e2e8f0", display: "flex", flexDirection: "column", backgroundColor: "#fdfdfd" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "35px" }}>
            <div style={{ backgroundColor: "#f5f3ff", padding: "20px", borderRadius: "20px", marginBottom: "40px", display: "flex", gap: "15px", border: "1px solid #ddd6fe", alignItems: "center" }}>
              <div style={{ backgroundColor: "#8b5cf6", padding: "10px", borderRadius: "12px", color: "white" }}><Wand2 size={26} /></div>
              <span style={{ fontWeight: "900", color: "#6b21a8", fontSize: "1.05rem" }}>Certeza AIA Sugiere:</span>
            </div>

            {Object.keys(scores).map(key => (
              <div key={key} style={{ marginBottom: "35px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", fontWeight: "800", color: "#1B396A" }}>
                  <span>{key}</span>
                  <input 
                    type="number" value={scores[key]} 
                    onChange={(e) => setScores({...scores, [key]: parseInt(e.target.value) || 0})}
                    style={{ backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", padding: "4px 8px", borderRadius: "8px", fontSize: "1.1rem", fontWeight: "900", color: "#1B396A", width: "60px", textAlign: "center", outline: "none" }}
                  />
                </div>
                <input type="range" min="0" max="100" value={scores[key]} onChange={(e) => setScores({...scores, [key]: parseInt(e.target.value)})} style={{ width: "100%", accentColor: "#1B396A", height: "8px", cursor: "pointer" }} />
              </div>
            ))}

            <div style={{ marginTop: "45px" }}>
              <div style={{ fontWeight: "900", color: "#1B396A", fontSize: "1.1rem", marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}><MessageSquare size={22} /> Retroalimentación</div>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} style={{ width: "100%", height: "200px", padding: "20px", borderRadius: "24px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1rem", resize: "none" }} />
            </div>
          </div>

          {/* FOOTER: Calificación y Botón Guardar */}
          <div style={{ padding: "35px", borderTop: "2px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Nota Calculada</div>
                <div style={{ fontSize: "3.2rem", fontWeight: "1000", color: "#1B396A", lineHeight: 1 }}>{total.toFixed(1)}</div>
              </div>
              
              {/* BOTÓN GUARDAR: SOLO ICONO INICIALMENTE, SE EXPANDE AL HOVER */}
              <ExpandingButton 
                icon={Save} 
                label="Guardar" 
                onClick={handleSave} 
                variant="primary" 
                defaultExpanded={false} 
                loading={isSaving}
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}