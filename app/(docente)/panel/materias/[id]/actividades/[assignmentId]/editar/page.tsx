"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Save, X, Wand2, Lock, Plus, Trash2 
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

export default function EditarActividadPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;
  const assignmentId = params?.assignmentId as string; // Obtenemos el ID de la actividad a editar

  const [units, setUnits] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  const [rubrics, setRubrics] = useState<any[]>([]);
  
  // --- LÓGICA DE BLOQUEO POR FECHA ---
  // Si la fecha actual superó el deadline, bloqueamos edición de la rúbrica
  const isDeadlinePassed = formData.soft_deadline ? new Date() > new Date(formData.soft_deadline) : false;
  
  // Validación de la rúbrica (debe sumar exactamente 100)
  const totalRubricWeight = rubrics.reduce((sum, r) => sum + Number(r.weight), 0);
  const isRubricValid = totalRubricWeight === 100;

  useEffect(() => { 
    if (courseId && assignmentId) fetchData(); 
  }, [courseId, assignmentId]);

  const fetchData = async () => {
    setIsLoading(true);
    
    // SIMULACRO DE DATOS PRECARGADOS PARA LA EDICIÓN
    // Aquí harías tus llamadas a Supabase.
    setUnits([{ id: "u1", unit_number: 1 }, { id: "u2", unit_number: 2 }]);
    setCriteria([
      { id: "c1", unit_id: "u1", name: "Criterio de Desempeño" },
      { id: "c2", unit_id: "u1", name: "Asistencia (No debe salir)" }, // Este se filtrará
      { id: "c3", unit_id: "u1", name: "Evaluación Escrita" }, // Este se filtrará
      { id: "c4", unit_id: "u1", name: "Criterio de Producto" }
    ]);
    
    // Simulamos la actividad que estamos editando
    setFormData({
      title: "Investigación: Modelos OSI",
      description: "Análisis comparativo de las capas del modelo OSI vs TCP/IP.",
      unit_id: "u1",
      criteria_id: "c4", // Seleccionado previamente
      format: "individual",
      submission_type: "file",
      soft_deadline: "2026-03-15T23:59", // Fecha en el futuro (Permitirá editar)
      hard_deadline: "",
      late_penalty_percent: 0,
    });

    // Simulamos rúbrica previa
    setRubrics([
      { id: 1, name: "Profundidad del Análisis", description: "Evaluación del desglose crítico...", weight: 50 },
      { id: 2, name: "Estructura", description: "Organización lógica de la entrega.", weight: 50 }
    ]);

    setIsLoading(false);
  };

  const handleAddRubricRow = () => {
    if (isDeadlinePassed) return;
    setRubrics([...rubrics, { id: Date.now(), name: "", description: "", weight: 0 }]);
  };

  const handleRemoveRubricRow = (id: number) => {
    if (isDeadlinePassed) return;
    if (rubrics.length > 1) setRubrics(rubrics.filter(r => r.id !== id));
  };

  const handleUpdateRubric = (id: number, field: string, value: any) => {
    if (isDeadlinePassed) return;
    setRubrics(rubrics.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleGenerateAI = () => {
    if (isDeadlinePassed || !formData.title) return;
    setIsGenerating(true);
    setTimeout(() => {
      setRubrics([
        { id: Date.now(), name: "Profundidad Técnica", description: "Evaluación precisa de conceptos.", weight: 40 },
        { id: Date.now() + 1, name: "Claridad Estructural", description: "Desarrollo lógico del tema.", weight: 40 },
        { id: Date.now() + 2, name: "Formato y Ortografía", description: "Cumplimiento de formato académico.", weight: 20 }
      ]);
      setIsGenerating(false);
    }, 1500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRubricValid && !isDeadlinePassed) return alert("La rúbrica debe sumar 100%.");
    
    alert("Cambios guardados correctamente");
    router.push(`/panel/materias/${courseId}/actividades`);
  };

  // --- FILTRO DE NEGOCIO ESTRICTO ---
  // Filtramos criterios que contengan "asist" o "evaluaci" (Exámenes y Asistencias no llevan IA)
  const filteredCriteria = criteria.filter(c => {
    if (c.unit_id !== formData.unit_id) return false;
    const nameLower = c.name.toLowerCase();
    return !nameLower.includes("asist") && !nameLower.includes("evaluaci"); 
  });

  if (isLoading) return <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Cargando actividad...</div>;

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "900", margin: "0", letterSpacing: "-0.02em" }}>Editar Actividad</h1>
          {isDeadlinePassed && <p style={{ color: "#ef4444", fontSize: "0.95rem", fontWeight: "700", marginTop: "8px", margin: 0 }}>Solo lectura: La fecha límite ha pasado.</p>}
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={X} label="Cancelar" onClick={() => router.back()} variant="cancel" />
          <ExpandingButton icon={Save} label="Guardar Cambios" onClick={handleSave} variant="primary" disabled={(!isRubricValid && !isDeadlinePassed) || !formData.title || !formData.soft_deadline} />
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "30px", alignItems: "start" }}>
        
        {/* COLUMNA IZQUIERDA: DATOS ACADÉMICOS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
             <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Información General</h3>
             <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <input disabled={isDeadlinePassed} required type="text" placeholder="Título de la actividad" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", backgroundColor: isDeadlinePassed ? "#f1f5f9" : "white", fontSize: "1.05rem", fontWeight: "600", color: "#334155", outline: "none", cursor: isDeadlinePassed ? "not-allowed" : "text" }} />
                <textarea disabled={isDeadlinePassed} rows={5} placeholder="Instrucciones detalladas" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", backgroundColor: isDeadlinePassed ? "#f1f5f9" : "white", fontSize: "1rem", color: "#334155", outline: "none", resize: "none", cursor: isDeadlinePassed ? "not-allowed" : "text" }} />
             </div>
          </div>
          
          <div style={{ opacity: isDeadlinePassed ? 0.7 : 1, pointerEvents: isDeadlinePassed ? 'none' : 'auto', backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Alineación Curricular</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <select required value={formData.unit_id} onChange={e => setFormData({...formData, unit_id: e.target.value, criteria_id: ""})} style={{ padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1rem", color: "#334155", backgroundColor: "white", cursor: "pointer" }}>
                <option value="">Selecciona Unidad</option>
                {units.map(u => <option key={u.id} value={u.id}>Unidad {u.unit_number}</option>)}
              </select>
              <select required value={formData.criteria_id} onChange={e => setFormData({...formData, criteria_id: e.target.value})} style={{ padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1rem", color: "#334155", backgroundColor: "white", cursor: "pointer" }}>
                <option value="">Selecciona Criterio</option>
                {filteredCriteria.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: MOTOR DE IA Y CRONOGRAMA */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
            <label style={{ display: "block", fontSize: "0.9rem", color: "#1B396A", fontWeight: "800", marginBottom: "12px", textTransform: "uppercase" }}>Fecha de Entrega (Deadline)</label>
            <input disabled={isDeadlinePassed} required type="datetime-local" value={formData.soft_deadline} onChange={e => setFormData({...formData, soft_deadline: e.target.value})} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1.05rem", fontWeight: "600", color: "#334155", backgroundColor: isDeadlinePassed ? "#f1f5f9" : "white", cursor: isDeadlinePassed ? "not-allowed" : "text" }} />
          </div>

          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)", opacity: isDeadlinePassed ? 0.9 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Rúbrica de IA</h3>
              <span style={{ fontSize: "0.85rem", fontWeight: "800", color: isRubricValid ? "#10b981" : "#ef4444", backgroundColor: isRubricValid ? "#dcfce7" : "#fee2e2", padding: "4px 10px", borderRadius: "8px" }}>
                {totalRubricWeight}%
              </span>
            </div>
            
            {isDeadlinePassed ? (
              <div style={{ backgroundColor: "#fffbeb", color: "#b45309", padding: "16px", borderRadius: "12px", marginBottom: "20px", fontSize: "0.9rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px" }}>
                <Lock size={18} /> Edición bloqueada (Fecha vencida)
              </div>
            ) : (
              <button type="button" onClick={handleGenerateAI} disabled={isGenerating || !formData.title} style={{ width: "100%", marginBottom: "24px", padding: "14px", backgroundColor: "#8b5cf6", color: "white", border: "none", borderRadius: "12px", fontWeight: "800", fontSize: "1rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", cursor: isGenerating || !formData.title ? "not-allowed" : "pointer", opacity: isGenerating || !formData.title ? 0.7 : 1, transition: "background 0.2s" }}
                onMouseEnter={(e) => { if (!isGenerating && formData.title) e.currentTarget.style.backgroundColor = "#7c3aed" }}
                onMouseLeave={(e) => { if (!isGenerating && formData.title) e.currentTarget.style.backgroundColor = "#8b5cf6" }}
              >
                <Wand2 size={18} /> {isGenerating ? "Certeza AIA reprocesando..." : "Regenerar con IA"}
              </button>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {rubrics.map((r) => (
                <div key={r.id} style={{ padding: "20px", backgroundColor: "#f8fafc", borderRadius: "16px", border: "1px solid #e2e8f0", position: "relative" }}>
                  <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                    <input disabled={isDeadlinePassed} type="text" placeholder="Nombre del criterio" value={r.name} onChange={e => handleUpdateRubric(r.id, "name", e.target.value)} style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: "700", outline: "none", color: "#1B396A", backgroundColor: isDeadlinePassed ? "#f1f5f9" : "white" }} />
                    <input disabled={isDeadlinePassed} type="number" placeholder="%" value={r.weight} onChange={e => handleUpdateRubric(r.id, "weight", e.target.value)} style={{ width: "80px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontWeight: "800", textAlign: "center", outline: "none", color: "#1B396A", backgroundColor: isDeadlinePassed ? "#f1f5f9" : "white" }} />
                  </div>
                  <textarea disabled={isDeadlinePassed} placeholder="Descripción de evaluación para la IA..." value={r.description} onChange={e => handleUpdateRubric(r.id, "description", e.target.value)} rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", outline: "none", resize: "none", color: "#334155", backgroundColor: isDeadlinePassed ? "#f1f5f9" : "white" }} />
                  
                  {!isDeadlinePassed && rubrics.length > 1 && (
                    <button type="button" onClick={() => handleRemoveRubricRow(r.id)} style={{ position: "absolute", top: "-10px", right: "-10px", backgroundColor: "#ef4444", color: "white", border: "none", width: "24px", height: "24px", borderRadius: "50%", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center" }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!isDeadlinePassed && (
              <button type="button" onClick={handleAddRubricRow} style={{ marginTop: "16px", width: "100%", padding: "12px", backgroundColor: "white", color: "#1B396A", border: "2px dashed #cbd5e1", borderRadius: "12px", fontWeight: "800", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <Plus size={18} /> Añadir Criterio
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}