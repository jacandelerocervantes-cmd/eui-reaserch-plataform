"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Save, X, Wand2, Lock, Plus, Trash2, ShieldCheck, AlertCircle, Loader2,
  User, Users, FileUp, Cloud, FileText, Table, Presentation
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

// --- COMPONENTE SELECTOR DE OPCIONES ---
const OptionCard = ({ icon: Icon, label, selected, onClick, disabled }: any) => (
  <div 
    onClick={() => !disabled && onClick()}
    style={{
      flex: 1, padding: "16px", borderRadius: "12px", cursor: disabled ? "not-allowed" : "pointer",
      border: `2px solid ${selected ? "#1B396A" : "#e2e8f0"}`,
      backgroundColor: selected ? "#f8fafc" : (disabled ? "#f1f5f9" : "white"),
      display: "flex", alignItems: "center", gap: "12px", transition: "all 0.2s",
      color: selected ? "#1B396A" : "#64748b", fontWeight: selected ? "800" : "600",
      opacity: disabled ? 0.6 : 1
    }}
  >
    <Icon size={20} color={selected ? "#2563eb" : "#94a3b8"} />
    <span>{label}</span>
  </div>
);

export default function EditarActividadPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;
  const assignmentId = params?.assignmentId as string; 

  const [units, setUnits] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- ESTADOS PARA EL CANDADO DE ASISTENCIA ---
  const [requireAttendance, setRequireAttendance] = useState(false);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");

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
  const isDeadlinePassed = formData.soft_deadline ? new Date() > new Date(formData.soft_deadline) : false;
  
  const totalRubricWeight = rubrics.reduce((sum, r) => sum + Number(r.weight), 0);
  const isRubricValid = totalRubricWeight === 100;

  useEffect(() => { 
    if (courseId && assignmentId) fetchData(); 
  }, [courseId, assignmentId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Obtener Unidades
      const { data: unitsData } = await supabase.from("course_units").select("id, unit_number, name").eq("course_id", courseId).order("unit_number", { ascending: true });
      if (unitsData) setUnits(unitsData);

      // 2. Obtener Criterios
      if (unitsData && unitsData.length > 0) {
        const unitIds = unitsData.map(u => u.id);
        const { data: actsData } = await supabase.from("activities").select("id, unit_id, name").in("unit_id", unitIds);
        if (actsData) setCriteria(actsData);
      }

      // 3. Obtener Sesiones Pasadas
      const { data: sesiones } = await supabase.from('sesiones_insitu').select('id, fecha_creacion, tipo').eq('materia_id', courseId).order('fecha_creacion', { ascending: false });
      if (sesiones) setPastSessions(sesiones);
      
      // 4. Obtener la Actividad a Editar
      const { data: assignmentData, error } = await supabase.from("assignments").select("*").eq("id", assignmentId).single();
      if (error) throw error;

      if (assignmentData) {
        setFormData({
          title: assignmentData.title,
          description: assignmentData.description || "",
          unit_id: assignmentData.unit_id,
          criteria_id: assignmentData.activity_id || "", 
          format: assignmentData.format || "individual",
          submission_type: assignmentData.submission_type || "file",
          soft_deadline: assignmentData.soft_deadline ? new Date(assignmentData.soft_deadline).toISOString().slice(0, 16) : "",
          hard_deadline: assignmentData.hard_deadline ? new Date(assignmentData.hard_deadline).toISOString().slice(0, 16) : "",
          late_penalty_percent: assignmentData.late_penalty_percent || 0,
        });

        if (assignmentData.requiere_sesion_id) {
          setRequireAttendance(true);
          setSelectedSessionId(assignmentData.requiere_sesion_id);
        }

        if (assignmentData.rubric_json) {
          setRubrics(typeof assignmentData.rubric_json === 'string' ? JSON.parse(assignmentData.rubric_json) : assignmentData.rubric_json);
        }
      }
    } catch (error) {
      console.error("Error cargando la actividad:", error);
      alert("Error al cargar los datos de la actividad.");
    } finally {
      setIsLoading(false);
    }
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

  const handleGenerateAI = async () => {
    if (isDeadlinePassed || !formData.title || !formData.description) return alert("Falta título o descripción.");
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-rubric-ia', { body: { title: formData.title, description: formData.description } });
      if (error || !data.success) throw new Error(data?.error || "Error al generar la rúbrica");

      const aiRubrics = data.rubrics.map((r: any) => ({
        id: r.id || Date.now() + Math.random(), name: r.name, description: r.description, weight: r.weight
      }));
      setRubrics(aiRubrics);
    } catch (error: any) {
      alert(`Error IA: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRubricValid && !isDeadlinePassed) return alert("La rúbrica debe sumar 100%.");
    if (requireAttendance && !selectedSessionId) return alert("Selecciona la clase vinculada.");
    
    setIsSaving(true);
    try {
      const payload = { 
        unit_id: formData.unit_id,
        activity_id: formData.criteria_id || null, 
        title: formData.title,
        description: formData.description,
        format: formData.format,
        submission_type: formData.submission_type,
        soft_deadline: formData.soft_deadline,
        hard_deadline: formData.hard_deadline || null,
        late_penalty_percent: formData.late_penalty_percent,
        rubric_json: rubrics, 
        requiere_sesion_id: requireAttendance ? selectedSessionId : null 
      };

      const { error } = await supabase.from("assignments").update(payload).eq("id", assignmentId);
      
      if (error) throw error;
      
      alert("Cambios guardados correctamente");
      router.push(`/panel/materias/${courseId}/actividades`);
    } catch (error: any) {
      alert(`Error al actualizar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCriteria = criteria.filter(c => {
    if (c.unit_id !== formData.unit_id) return false;
    const nameLower = c.name.toLowerCase();
    return !nameLower.includes("asist") && !nameLower.includes("evaluaci"); 
  });

  if (isLoading) return <div style={{ padding: "100px", textAlign: "center", color: "#1B396A" }}><Loader2 className="animate-spin" size={40} /></div>;

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "900", margin: "0", letterSpacing: "-0.02em" }}>Editar Actividad</h1>
          {isDeadlinePassed && <p style={{ color: "#ef4444", fontSize: "0.95rem", fontWeight: "700", marginTop: "8px", margin: 0 }}>Solo lectura: La fecha límite ha pasado.</p>}
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <ExpandingButton icon={X} label="Cancelar" onClick={() => router.back()} variant="cancel" disabled={isSaving} />
          <ExpandingButton 
            icon={isSaving ? Loader2 : Save} 
            label={isSaving ? "Guardando..." : "Guardar Cambios"} 
            onClick={handleSave} 
            variant="primary" 
            disabled={(!isRubricValid && !isDeadlinePassed) || !formData.title || !formData.soft_deadline || isSaving} 
          />
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
                {units.map(u => <option key={u.id} value={u.id}>Unidad {u.unit_number}: {u.name}</option>)}
              </select>
              <select required value={formData.criteria_id} onChange={e => setFormData({...formData, criteria_id: e.target.value})} style={{ padding: "16px", borderRadius: "12px", border: "2px solid #e2e8f0", outline: "none", fontSize: "1rem", color: "#334155", backgroundColor: "white", cursor: "pointer" }}>
                <option value="">Selecciona Criterio</option>
                {filteredCriteria.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* NUEVO BLOQUE: FORMATO Y MODALIDAD */}
          <div style={{ opacity: isDeadlinePassed ? 0.7 : 1, pointerEvents: isDeadlinePassed ? 'none' : 'auto', backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
            <h3 style={{ margin: "0 0 20px 0", color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Modalidad y Entorno de Entrega</h3>
            
            <div style={{ marginBottom: "20px" }}>
              <p style={{ fontSize: "0.85rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "10px" }}>Modalidad de Trabajo</p>
              <div style={{ display: "flex", gap: "12px" }}>
                <OptionCard icon={User} label="Individual" selected={formData.format === 'individual'} onClick={() => setFormData({...formData, format: 'individual'})} disabled={isDeadlinePassed} />
                <OptionCard icon={Users} label="Por Equipos" selected={formData.format === 'equipo'} onClick={() => setFormData({...formData, format: 'equipo'})} disabled={isDeadlinePassed} />
              </div>
            </div>

            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "10px" }}>Tipo de Entrega</p>
              <div style={{ display: "flex", gap: "12px", marginBottom: formData.submission_type !== 'file' ? "12px" : "0" }}>
                <OptionCard icon={FileUp} label="Subida de Archivo" selected={formData.submission_type === 'file'} onClick={() => setFormData({...formData, submission_type: 'file'})} disabled={isDeadlinePassed} />
                <OptionCard icon={Cloud} label="Google Workspace" selected={formData.submission_type !== 'file'} onClick={() => setFormData({...formData, submission_type: 'doc'})} disabled={isDeadlinePassed} />
              </div>
              
              {/* Sub-selector de Workspace */}
              {formData.submission_type !== 'file' && (
                <div style={{ display: "flex", gap: "12px", animation: "fadeIn 0.3s ease-out", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                  <OptionCard icon={FileText} label="Doc" selected={formData.submission_type === 'doc'} onClick={() => setFormData({...formData, submission_type: 'doc'})} disabled={isDeadlinePassed} />
                  <OptionCard icon={Table} label="Sheet" selected={formData.submission_type === 'sheet'} onClick={() => setFormData({...formData, submission_type: 'sheet'})} disabled={isDeadlinePassed} />
                  <OptionCard icon={Presentation} label="Slide" selected={formData.submission_type === 'slide'} onClick={() => setFormData({...formData, submission_type: 'slide'})} disabled={isDeadlinePassed} />
                </div>
              )}
            </div>
          </div>

          {/* 🔒 BLOQUE DE CANDADO DE ASISTENCIA */}
          <div style={{ opacity: isDeadlinePassed ? 0.7 : 1, pointerEvents: isDeadlinePassed ? 'none' : 'auto', backgroundColor: requireAttendance ? "#f0fdf4" : "white", padding: "32px", borderRadius: "24px", border: `1px solid ${requireAttendance ? '#bbf7d0' : '#e2e8f0'}`, transition: "all 0.3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: requireAttendance ? "20px" : "0" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", color: requireAttendance ? "#166534" : "#1B396A", fontSize: "1.2rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                  {requireAttendance ? <ShieldCheck size={24} /> : <Lock size={20} />}
                  Candado de Asistencia In-Situ
                </h3>
                <p style={{ margin: 0, fontSize: "0.9rem", color: requireAttendance ? "#15803d" : "#64748b", fontWeight: "500", maxWidth: "80%" }}>
                  Si se activa, solo los alumnos que validaron su ubicación presencialmente podrán entregar.
                </p>
              </div>
              <label style={{ display: "flex", alignItems: "center", cursor: isDeadlinePassed ? "not-allowed" : "pointer" }}>
                <div style={{ position: "relative" }}>
                  <input disabled={isDeadlinePassed} type="checkbox" checked={requireAttendance} onChange={(e) => { setRequireAttendance(e.target.checked); if(!e.target.checked) setSelectedSessionId(""); }} style={{ opacity: 0, width: 0, height: 0 }} />
                  <div style={{ width: "50px", height: "26px", backgroundColor: requireAttendance ? "#10b981" : "#cbd5e1", borderRadius: "50px", transition: "background-color 0.3s" }}></div>
                  <div style={{ position: "absolute", top: "2px", left: requireAttendance ? "26px" : "2px", width: "22px", height: "22px", backgroundColor: "white", borderRadius: "50%", transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}></div>
                </div>
              </label>
            </div>

            {requireAttendance && (
              <div style={{ animation: "fadeIn 0.3s ease-out" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#15803d", fontSize: "0.85rem", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase" }}>
                  <AlertCircle size={14} /> Vincular a la clase de:
                </div>
                <select disabled={isDeadlinePassed} required={requireAttendance} value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)} style={{ width: "100%", padding: "16px", borderRadius: "12px", border: "2px solid #bbf7d0", outline: "none", fontSize: "1rem", color: "#166534", backgroundColor: "white", cursor: isDeadlinePassed ? "not-allowed" : "pointer", fontWeight: "600" }}>
                  <option value="">Selecciona una clase anterior registrada...</option>
                  {pastSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      Día: {new Date(s.fecha_creacion).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - ({s.tipo.replace('_', ' ').toUpperCase()})
                    </option>
                  ))}
                  {pastSessions.length === 0 && <option disabled>No hay sesiones In-Situ registradas aún.</option>}
                </select>
              </div>
            )}
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
                {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />} {isGenerating ? "Certeza AIA reprocesando..." : "Regenerar con IA"}
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