"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Save, X, Wand2, Plus, Trash2 
} from "lucide-react";

// --- COMPONENTE PREMIUM: BOTÓN EXPANDIBLE ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", type = "button", disabled = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", text: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", hoverText: "white", border: "transparent" };
      case "magic": return { bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white", hoverText: "white", border: "transparent" };
      case "cancel":  return { bg: "white", hoverBg: "#fee2e2", text: "#64748b", hoverText: "#ef4444", border: isHovered ? "#ef4444" : "#cbd5e1" };
      default:        return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", hoverText: "#1B396A", border: "#cbd5e1" };
    }
  };
  const style = getStyles();

  return (
    <button
      type={type} onClick={onClick} disabled={disabled} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: isHovered && !disabled ? "10px" : "0px",
        backgroundColor: isHovered && !disabled ? style.hoverBg : style.bg, color: isHovered && !disabled ? style.hoverText : style.text, 
        border: `1px solid ${style.border}`, borderRadius: "10px", padding: "0 16px", height: "42px", fontWeight: "600", fontSize: "0.9rem", cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", whiteSpace: "nowrap",
        boxShadow: isHovered && !disabled && variant !== 'cancel' && variant !== 'default' ? "0 4px 6px rgba(0,0,0,0.15)" : "none"
      }}
    >
      {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
      <span style={{ maxWidth: isHovered && !disabled ? "200px" : "0px", opacity: isHovered && !disabled ? 1 : 0, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", display: "inline-block" }}>
        {label}
      </span>
    </button>
  );
};

export default function NuevaActividadPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [units, setUnits] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // ESTADO LIMPIO PARA NUEVA ACTIVIDAD
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    unit_id: "",
    criteria_id: "",
    format: "individual", 
    submission_type: "file", 
    soft_deadline: "",
    hard_deadline: "",
    late_penalty_percent: 0,
  });

  const [rubrics, setRubrics] = useState([{ id: Date.now(), name: "Contenido", description: "", weight: 100 }]);
  
  // Validación de la rúbrica (debe sumar exactamente 100)
  const totalRubricWeight = rubrics.reduce((sum, r) => sum + Number(r.weight), 0);
  const isRubricValid = totalRubricWeight === 100;

  useEffect(() => { 
    if (courseId) fetchData(); 
  }, [courseId]);

  const fetchData = async () => {
    // SIMULACRO DE CARGA INICIAL
    setUnits([{ id: "u1", unit_number: 1 }, { id: "u2", unit_number: 2 }]);
    setCriteria([
      { id: "c1", unit_id: "u1", name: "Criterio de Desempeño" },
      { id: "c2", unit_id: "u1", name: "Asistencia (No debe salir)" }, // Se filtrará
      { id: "c3", unit_id: "u1", name: "Evaluación Escrita" }, // Se filtrará
      { id: "c4", unit_id: "u1", name: "Criterio de Producto" }
    ]);
  };

  const handleAddRubricRow = () => {
    setRubrics([...rubrics, { id: Date.now(), name: "", description: "", weight: 0 }]);
  };

  const handleRemoveRubricRow = (id: number) => {
    if (rubrics.length > 1) setRubrics(rubrics.filter(r => r.id !== id));
  };

  const handleUpdateRubric = (id: number, field: string, value: any) => {
    setRubrics(rubrics.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleGenerateAI = () => {
    if (!formData.title) return;
    setIsGenerating(true);
    setTimeout(() => {
      setRubrics([
        { id: Date.now(), name: "Profundidad Técnica", description: "Evaluación precisa de conceptos y teorías aplicadas.", weight: 40 },
        { id: Date.now() + 1, name: "Claridad Estructural", description: "Desarrollo lógico del tema y coherencia.", weight: 40 },
        { id: Date.now() + 2, name: "Formato y Ortografía", description: "Cumplimiento estricto del formato académico.", weight: 20 }
      ]);
      setIsGenerating(false);
    }, 1500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRubricValid) return alert("La rúbrica de IA debe sumar exactamente 100%.");
    
    alert("Actividad creada y guardada correctamente.");
    router.push(`/panel/materias/${courseId}/actividades`);
  };

  // --- FILTRO DE NEGOCIO ESTRICTO ---
  // Ocultamos criterios que contengan "asist" o "evaluaci"
  const filteredCriteria = criteria.filter(c => {
    if (c.unit_id !== formData.unit_id) return false;
    const nameLower = c.name.toLowerCase();
    return !nameLower.includes("asist") && !nameLower.includes("evaluaci"); 
  });

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "900", margin: "0", letterSpacing: "-0.02em" }}>Nueva Actividad</h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem", fontWeight: "600", marginTop: "4px", margin: 0 }}>Configura los parámetros y la rúbrica de Certeza AIA</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={X} label="Cancelar" onClick={() => router.back()} variant="cancel" />
          <ExpandingButton icon={Save} label="Crear Actividad" onClick={handleSave} variant="primary" disabled={!isRubricValid || !formData.title || !formData.soft_deadline} />
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "30px", alignItems: "start" }}>
        
        {/* COLUMNA IZQUIERDA: DATOS ACADÉMICOS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
             <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Información General</h3>
             <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <input required type="text" placeholder="Título de la actividad" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "1.05rem", fontWeight: "600", color: "#334155", outline: "none", transition: "border 0.2s" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
                <textarea rows={5} placeholder="Instrucciones detalladas" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "1rem", color: "#334155", outline: "none", resize: "none", transition: "border 0.2s" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
             </div>
          </div>
          
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Alineación Curricular</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <select required value={formData.unit_id} onChange={e => setFormData({...formData, unit_id: e.target.value, criteria_id: ""})} style={{ padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1rem", color: "#334155", backgroundColor: "white", cursor: "pointer" }}>
                <option value="">Selecciona Unidad</option>
                {units.map(u => <option key={u.id} value={u.id}>Unidad {u.unit_number}</option>)}
              </select>
              <select required value={formData.criteria_id} onChange={e => setFormData({...formData, criteria_id: e.target.value})} style={{ padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1rem", color: "#334155", backgroundColor: "white", cursor: "pointer" }}>
                <option value="">Selecciona Criterio (Excluye asist/eval)</option>
                {filteredCriteria.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: MOTOR DE IA Y CRONOGRAMA */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
            <label style={{ display: "block", fontSize: "0.9rem", color: "#1B396A", fontWeight: "800", marginBottom: "12px", textTransform: "uppercase" }}>Fecha de Entrega (Deadline)</label>
            <input required type="datetime-local" value={formData.soft_deadline} onChange={e => setFormData({...formData, soft_deadline: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1.05rem", fontWeight: "600", color: "#334155", transition: "border 0.2s" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#e2e8f0"} />
          </div>

          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Rúbrica de IA</h3>
              <span style={{ fontSize: "0.85rem", fontWeight: "800", color: isRubricValid ? "#10b981" : "#ef4444", backgroundColor: isRubricValid ? "#dcfce7" : "#fee2e2", padding: "4px 10px", borderRadius: "8px" }}>
                {totalRubricWeight}%
              </span>
            </div>
            
            <button type="button" onClick={handleGenerateAI} disabled={isGenerating || !formData.title} style={{ width: "100%", marginBottom: "24px", padding: "14px", backgroundColor: "#8b5cf6", color: "white", border: "none", borderRadius: "12px", fontWeight: "800", fontSize: "1rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", cursor: isGenerating || !formData.title ? "not-allowed" : "pointer", opacity: isGenerating || !formData.title ? 0.7 : 1, transition: "background 0.2s" }}
              onMouseEnter={(e) => { if (!isGenerating && formData.title) e.currentTarget.style.backgroundColor = "#7c3aed" }}
              onMouseLeave={(e) => { if (!isGenerating && formData.title) e.currentTarget.style.backgroundColor = "#8b5cf6" }}
            >
              <Wand2 size={18} /> {isGenerating ? "Certeza AIA pensando..." : "Autogenerar con IA"}
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {rubrics.map((r) => (
                <div key={r.id} style={{ padding: "20px", backgroundColor: "#f8fafc", borderRadius: "16px", border: "1px solid #e2e8f0", position: "relative" }}>
                  <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                    <input type="text" placeholder="Nombre del criterio" value={r.name} onChange={e => handleUpdateRubric(r.id, "name", e.target.value)} style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: "700", outline: "none", color: "#1B396A" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#cbd5e1"} />
                    <input type="number" placeholder="%" value={r.weight} onChange={e => handleUpdateRubric(r.id, "weight", e.target.value)} style={{ width: "80px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: "800", textAlign: "center", outline: "none", color: "#1B396A" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#cbd5e1"} />
                  </div>
                  <textarea placeholder="Descripción de evaluación para la IA..." value={r.description} onChange={e => handleUpdateRubric(r.id, "description", e.target.value)} rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", outline: "none", resize: "none", color: "#334155" }} onFocus={(e) => e.target.style.borderColor = "#1B396A"} onBlur={(e) => e.target.style.borderColor = "#cbd5e1"} />
                  
                  {rubrics.length > 1 && (
                    <button type="button" onClick={() => handleRemoveRubricRow(r.id)} style={{ position: "absolute", top: "-10px", right: "-10px", backgroundColor: "#ef4444", color: "white", border: "none", width: "24px", height: "24px", borderRadius: "50%", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center" }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button type="button" onClick={handleAddRubricRow} style={{ marginTop: "16px", width: "100%", padding: "12px", backgroundColor: "white", color: "#1B396A", border: "2px dashed #cbd5e1", borderRadius: "12px", fontWeight: "800", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1B396A"; e.currentTarget.style.backgroundColor = "#f8fafc" }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.backgroundColor = "white" }}
            >
              <Plus size={18} /> Añadir Criterio
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}