"use client";

import React, { useState, useEffect, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  BookOpen, PlusCircle, Target, X, Save, Edit3, AlertTriangle, 
  CheckCircle2, Trash2, ArrowLeft, Lock, Unlock, FileSpreadsheet, 
  Wand2, GraduationCap, Search, ChevronRight, User, AlertCircle, 
  Download, Filter, ChevronDown, ChevronUp 
} from "lucide-react";

type Unit = { id: string; name: string; unit_number: number; is_closed: boolean; };
type Activity = { id: string; unit_id: string; name: string; weight_percentage: number; };

// --- COMPONENTE DEL BOTÓN PREMIUM (Fusionado con tu versión small/dinámica) ---
const ExpandingButton = ({ icon: Icon, label, onClick, variant = "primary", type = "button", disabled = false, isActive = false, small = false }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getStyles = () => {
    if (disabled) return { bg: "#f1f5f9", hoverBg: "#f1f5f9", text: "#94a3b8", hoverText: "#94a3b8", border: "#e2e8f0" };
    switch (variant) {
      case "primary": return { bg: "#1B396A", hoverBg: "#152c54", text: "white", hoverText: "white", border: "transparent" };
      case "success": return { bg: isActive ? "#10b981" : "#10b981", hoverBg: "#059669", text: "white", hoverText: "white", border: "transparent" };
      case "warning": return { bg: isActive ? "#f59e0b" : "white", hoverBg: "#f59e0b", text: isActive ? "white" : "#f59e0b", hoverText: "white", border: isActive ? "#f59e0b" : "#cbd5e1" };
      case "danger":  return { bg: "#fee2e2", hoverBg: "#ef4444", text: isHovered || isActive ? "white" : "#ef4444", hoverText: "white", border: "transparent" };
      case "cancel":  return { bg: "white", hoverBg: "#fee2e2", text: "#64748b", hoverText: "#ef4444", border: isHovered ? "#ef4444" : "#cbd5e1" };
      case "secondary": return { bg: "white", hoverBg: "#f8fafc", text: "#1B396A", hoverText: "#1B396A", border: "#cbd5e1" };
      case "magic": return { bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white", hoverText: "white", border: "transparent" }; 
      default:        return { bg: "white", hoverBg: "#f8fafc", text: "#64748b", hoverText: "#1B396A", border: "#cbd5e1" };
    }
  };

  const style = getStyles();
  const showExpanded = isHovered || isActive;

  return (
    <button
      type={type} onClick={onClick} disabled={disabled} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} title={label}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: showExpanded && !disabled ? "8px" : "0px",
        backgroundColor: (isHovered || isActive) && !disabled ? style.hoverBg : style.bg, color: (isHovered || isActive) && !disabled ? style.hoverText : style.text, 
        border: `1px solid ${style.border}`, borderRadius: "10px", padding: "0 12px", height: small ? "36px" : "40px", fontWeight: "700", fontSize: "0.9rem", cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", whiteSpace: "nowrap",
        boxShadow: (isHovered || isActive) && !disabled && variant !== 'cancel' && variant !== 'default' ? "0 4px 6px rgba(0,0,0,0.15)" : "none"
      }}
    >
      {Icon && <Icon size={small ? 16 : 18} style={{ flexShrink: 0 }} />}
      <span style={{ maxWidth: showExpanded && !disabled ? "200px" : "0px", opacity: showExpanded && !disabled ? 1 : 0, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", display: "inline-block" }}>
        {label}
      </span>
    </button>
  );
};

export default function ConfiguracionCalificaciones() {
  const params = useParams();
  const courseId = params?.id as string;

  // ESTADOS GLOBALES
  const [currentView, setCurrentView] = useState<'units' | 'capture' | 'final' | 'sabana'>('units');
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  
  // NUEVO ESTADO: Controlar qué tarjetas están colapsadas (por defecto todas abiertas: false)
  const [collapsedUnits, setCollapsedUnits] = useState<{ [key: string]: boolean }>({});

  // Estados para Modales
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [activeUnitId, setActiveUnitId] = useState("");
  const [newActivity, setNewActivity] = useState({ name: "", weight: "" });

  // LÓGICA DINÁMICA DE CRITERIOS DE UNIDAD
  const [unitCriteria, setUnitCriteria] = useState([
    { id: 1, name: "Asistencia", weight: 10 },
    { id: 2, name: "Actividades", weight: 50 },
    { id: 3, name: "Evaluación", weight: 40 }
  ]);
  const totalWeight = unitCriteria.reduce((sum, c) => sum + Number(c.weight), 0);
  const isWeightValid = totalWeight === 100 && unitCriteria.length > 0;

  const handleAddUnitCriterion = () => setUnitCriteria([...unitCriteria, { id: Date.now(), name: "", weight: 0 }]);
  const handleRemoveUnitCriterion = (id: number) => setUnitCriteria(unitCriteria.filter(c => c.id !== id));
  const handleUpdateUnitCriterion = (id: number, field: string, value: any) => setUnitCriteria(unitCriteria.map(c => c.id === id ? { ...c, [field]: value } : c));

  // Estados de Captura y Sabana
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [grades, setGrades] = useState<any>({}); 
  const [isSaving, setIsSaving] = useState(false);
  const [allGrades, setAllGrades] = useState<any[]>([]); 
  const [lockedUnits, setLockedUnits] = useState<{ [key: string]: boolean }>({});

  // 1. AÑADIMOS ESTO PARA EVITAR EL HYDRATION ERROR
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Le dice a React que ya estamos en el navegador
  }, []);

  useEffect(() => { if (courseId) fetchData(); }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: unitsData } = await supabase.from("course_units").select("*").eq("course_id", courseId).order("unit_number", { ascending: true });
      if (unitsData) setUnits(unitsData);

      const { data: actsData } = await supabase.from("activities").select("*, course_units!inner(course_id)").eq("course_units.course_id", courseId);
      if (actsData) setActivities(actsData);

      const { data: stData } = await supabase.from("students").select("*").eq("course_id", courseId).order("apellido_paterno", { ascending: true });
      if (stData) setStudents(stData);

    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const getUnitTotalWeight = (unitId: string) => activities.filter(a => a.unit_id === unitId).reduce((sum, act) => sum + act.weight_percentage, 0);

  const openNewUnitModal = () => {
    setNewUnitName("");
    setUnitCriteria([
      { id: Date.now(), name: "Asistencia", weight: 10 },
      { id: Date.now() + 1, name: "Actividades", weight: 50 },
      { id: Date.now() + 2, name: "Evaluación", weight: 40 }
    ]);
    setShowUnitModal(true);
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !isWeightValid) return;
    try {
      const nextNumber = units.length + 1;
      const { data: unit, error } = await supabase.from("course_units").insert([{ course_id: courseId, name: newUnitName.trim(), unit_number: nextNumber }]).select().single();
      if (error) throw error;

      if (unit && unitCriteria.length > 0) {
        const autoActs = unitCriteria.filter(c => c.name.trim() !== "").map(c => ({
          unit_id: unit.id,
          name: c.name.trim(),
          weight_percentage: Number(c.weight)
        }));
        if (autoActs.length > 0) await supabase.from("activities").insert(autoActs);
      }
      setShowUnitModal(false);
      fetchData();
    } catch (error) { alert("Error creando unidad"); }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.name.trim() || !newActivity.weight) return;
    try {
      const { error } = await supabase.from("activities").insert([{ unit_id: activeUnitId, name: newActivity.name.trim(), weight_percentage: parseInt(newActivity.weight) }]);
      if (error) throw error;
      setNewActivity({ name: "", weight: "" });
      setShowActivityModal(false);
      fetchData();
    } catch (error) { alert("Error agregando criterio"); }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("¿Eliminar este criterio? Se borrarán las calificaciones asociadas.")) return;
    try {
      await supabase.from("activities").delete().eq("id", id);
      fetchData();
    } catch (error) { console.error(error); }
  };

  // --- LÓGICA DE CAPTURA ---
  const handleOpenCapture = async (unit: Unit) => {
    setSelectedUnit(unit);
    setCurrentView('capture');
    
    const unitActIds = activities.filter(a => a.unit_id === unit.id).map(a => a.id);
    const { data: gr } = await supabase.from("grades").select("*").in("activity_id", unitActIds);
    
    const gradesMap: any = {};
    gr?.forEach((g: any) => { gradesMap[`${g.student_id}_${g.activity_id}`] = g.score; });
    setGrades(gradesMap);
  };

  const handleSaveGrades = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(grades).map(([key, score]) => {
        const [student_id, activity_id] = key.split("_");
        return { student_id, activity_id, score: Number(score) };
      });
      if (updates.length > 0) {
        const { error } = await supabase.from("grades").upsert(updates, { onConflict: "student_id, activity_id" });
        if (error) throw error;
      }
      alert("Calificaciones guardadas exitosamente.");
    } catch (error) { alert("Error al guardar las calificaciones."); } finally { setIsSaving(false); }
  };

  const handleMagicAttendance = async () => {
    if (selectedUnit?.is_closed) return;
    const assistCriterio = activities.find(a => a.unit_id === selectedUnit?.id && a.name.toLowerCase().includes("asist"));
    if (!assistCriterio) return alert("Para usar la magia, necesitas un criterio que contenga la palabra 'Asistencia'.");

    alert("Calculando asistencia global desde el inicio del curso...");
    const { data: att } = await supabase.from("attendance").select("*").eq("course_id", courseId);
    if (!att || att.length === 0) return alert("No hay pases de lista registrados en esta materia.");

    const studentAtt: any = {};
    const totalSessions: any = {};
    
    att.forEach(r => {
      studentAtt[r.student_id] = (studentAtt[r.student_id] || 0) + r.status;
      totalSessions[r.student_id] = (totalSessions[r.student_id] || 0) + 1;
    });

    const newGrades = { ...grades };
    students.forEach(s => {
      if (totalSessions[s.id]) {
        const pct = (studentAtt[s.id] / totalSessions[s.id]) * 100;
        newGrades[`${s.id}_${assistCriterio.id}`] = pct.toFixed(0);
      } else {
        newGrades[`${s.id}_${assistCriterio.id}`] = 0; 
      }
    });

    setGrades(newGrades);
    alert("✨ Asistencia sincronizada. Recuerda darle a 'Guardar Todo'.");
  };

  const handleToggleCloseUnit = async (targetUnit?: Unit) => {
    const unitToToggle = targetUnit || selectedUnit;
    if (!unitToToggle) return;
    const newStatus = !unitToToggle.is_closed;
    const confirmMsg = newStatus 
      ? `¿Estás seguro de cerrar ${unitToToggle.name}? Ya no podrás editar las calificaciones.` 
      : `¿Deseas reabrir ${unitToToggle.name} para edición?`;
    
    if (!confirm(confirmMsg)) return;

    const { error } = await supabase.from("course_units").update({ is_closed: newStatus }).eq("id", unitToToggle.id);
    if (!error) {
      if (!targetUnit) setSelectedUnit({ ...unitToToggle, is_closed: newStatus });
      setUnits(units.map(u => u.id === unitToToggle.id ? { ...u, is_closed: newStatus } : u));
    }
  };

  const handleOpenFinalGrades = async () => {
    setCurrentView('final');
    setLoading(true);
    const unitIds = units.map(u => u.id);
    const actIds = activities.filter(a => unitIds.includes(a.unit_id)).map(a => a.id);
    const { data: gr } = await supabase.from("grades").select("*").in("activity_id", actIds);
    setAllGrades(gr || []);
    setLoading(false);
  };

  const handleExportToSheets = () => {
    let csvContent = "\uFEFF"; 
    const headers = ["Matricula", "Alumno"];
    units.forEach(u => headers.push(`U${u.unit_number}: ${u.name}`));
    headers.push("PROMEDIO FINAL", "ESTATUS");
    csvContent += headers.join(",") + "\n";

    students.forEach(s => {
      let row = [`"${s.matricula}"`, `"${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}"`];
      let sumOfAverages = 0;
      let unitsCount = units.length;

      units.forEach(u => {
        let uAvg = 0;
        activities.filter(a => a.unit_id === u.id).forEach(act => {
          const scoreStr = grades[`${s.id}_${act.id}`];
          const score = scoreStr !== undefined ? Number(scoreStr) : (allGrades.find(g => g.student_id === s.id && g.activity_id === act.id)?.score || 0);
          uAvg += (score * (act.weight_percentage / 100));
        });
        sumOfAverages += uAvg;
        row.push(uAvg.toFixed(1));
      });

      const finalAvg = unitsCount > 0 ? (sumOfAverages / unitsCount) : 0;
      const status = finalAvg >= 70 ? "APROBADO" : "REPROBADO";
      row.push(finalAvg.toFixed(1), `"${status}"`);
      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Acta_Final_GoogleSheets.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- NUEVA LÓGICA DE SÁBANA ---
  const handleOpenSabana = async () => {
    setCurrentView('sabana');
    setLoading(true);
    const unitIds = units.map(u => u.id);
    const actIds = activities.filter(a => unitIds.includes(a.unit_id)).map(a => a.id);
    const { data: gr } = await supabase.from("grades").select("*").in("activity_id", actIds);
    
    const gradesMap: any = {};
    gr?.forEach((g: any) => { gradesMap[`${g.student_id}_${g.activity_id}`] = g.score; });
    setGrades(gradesMap);
    
    // Sincronizar bloqueos locales con estado de BD
    const initialLocks: any = {};
    units.forEach(u => initialLocks[u.id] = u.is_closed);
    setLockedUnits(initialLocks);
    
    setLoading(false);
  };

  const toggleLockSabana = async (unit: Unit) => {
    const isLocking = !lockedUnits[unit.id];
    if (isLocking) {
      if(!confirm(`¿Seguro que deseas cerrar la Unidad ${unit.unit_number}? Ya no se podrán editar calificaciones.`)) return;
    }
    // Actualizamos en BD para mantener sincronía
    await handleToggleCloseUnit(unit);
    setLockedUnits(prev => ({ ...prev, [unit.id]: isLocking }));
  };

  const inputStyle = (locked: boolean) => ({
    width: "55px", padding: "8px", borderRadius: "8px",
    border: locked ? "none" : "1px solid #cbd5e1",
    backgroundColor: locked ? "transparent" : "white",
    textAlign: "center" as const, fontWeight: "700",
    color: locked ? "#94a3b8" : "#1B396A",
    outline: "none", cursor: locked ? "not-allowed" : "text"
  });

  // 2. DETENEMOS EL RENDER HASTA QUE ESTÉ MONTADO
  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: currentView === 'sabana' ? "100%" : "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "30px", position: "relative" }}>
      
      {/* ================= VISTA 1: TARJETAS DE UNIDADES ================= */}
      {currentView === 'units' && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0" }}>Configuración de Evaluación</h1>
              <p style={{ color: "#64748b", margin: 0, fontWeight: "500", display: "flex", alignItems: "center", gap: "8px" }}>
                <Target size={18} /> Diseña las rúbricas y criterios por unidad
              </p>
            </div>
            
            <div style={{ display: "flex", gap: "12px" }}>
              <ExpandingButton icon={PlusCircle} label="Nueva Unidad" onClick={openNewUnitModal} variant="secondary" />
              <ExpandingButton icon={FileSpreadsheet} label="Sábana de Calificaciones" onClick={handleOpenSabana} variant="success" disabled={units.length === 0} />
              <ExpandingButton icon={GraduationCap} label="Ver Promedios Finales" onClick={handleOpenFinalGrades} variant="primary" disabled={units.length === 0} />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Cargando rúbricas...</div>
          ) : units.length === 0 ? (
            <div style={{ backgroundColor: "white", padding: "60px 20px", borderRadius: "16px", border: "1px dashed #cbd5e1", textAlign: "center" }}>
              <BookOpen size={48} color="#cbd5e1" style={{ marginBottom: "16px" }} />
              <h3 style={{ color: "#1B396A", margin: "0 0 8px 0", fontSize: "1.2rem" }}>Aún no hay unidades</h3>
              <p style={{ color: "#64748b", margin: "0 0 20px 0", fontSize: "0.95rem" }}>Comienza creando tu Unidad 1 para asignar criterios y porcentajes.</p>
              <div style={{ display: "flex", justifyContent: "center" }}><ExpandingButton icon={PlusCircle} label="Crear Primera Unidad" onClick={openNewUnitModal} variant="primary" /></div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px", alignItems: "start" }}>
              {units.map((unit) => {
                const unitActs = activities.filter(a => a.unit_id === unit.id);
                const totalWeight = getUnitTotalWeight(unit.id);
                const isPerfect = totalWeight === 100;
                const isOver = totalWeight > 100;
                const isCollapsed = collapsedUnits[unit.id]; // Estado actual de la tarjeta

                return (
                  <div 
                    key={unit.id} 
                    style={{ 
                      backgroundColor: "white", 
                      borderRadius: "16px", 
                      border: `1px solid ${unit.is_closed ? "#cbd5e1" : "#e2e8f0"}`, 
                      overflow: "hidden", 
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", 
                      opacity: unit.is_closed ? 0.85 : 1,
                      display: "flex",
                      flexDirection: "column",
                      transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease"
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.transform = "translateY(-6px)";
                      e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(0,0,0,0.1)"; 
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.05)";
                    }}
                  >
                    
                    {/* ENCABEZADO CLICABLE PARA COLAPSAR/EXPANDIR */}
                    <div 
                      onClick={() => setCollapsedUnits(prev => ({...prev, [unit.id]: !prev[unit.id]}))}
                      style={{ 
                        cursor: "pointer", 
                        padding: "20px", 
                        backgroundColor: unit.is_closed ? "#f1f5f9" : "#f8fafc", 
                        borderBottom: isCollapsed ? "none" : "1px solid #e2e8f0", 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        transition: "background-color 0.2s"
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = unit.is_closed ? "#e2e8f0" : "#f1f5f9"}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = unit.is_closed ? "#f1f5f9" : "#f8fafc"}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ color: "#94a3b8", display: "flex", alignItems: "center" }}>
                          {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                        </div>
                        <div>
                          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                            {unit.is_closed && <Lock size={12} />} Unidad {unit.unit_number} {unit.is_closed && "(Cerrada)"}
                          </span>
                          <h3 style={{ margin: "4px 0 0 0", color: "#1B396A", fontSize: "1.2rem" }}>{unit.name}</h3>
                        </div>
                      </div>
                      
                      {!unit.is_closed && (
                        <div style={{ padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px", backgroundColor: isPerfect ? "#ecfdf5" : isOver ? "#fef2f2" : "#fffbeb", color: isPerfect ? "#10b981" : isOver ? "#ef4444" : "#f59e0b" }}>
                          {isPerfect ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {totalWeight}%
                        </div>
                      )}
                    </div>

                    {/* CUERPO Y FOOTER (SE OCULTAN SI ESTÁ COLAPSADO) */}
                    {!isCollapsed && (
                      <>
                        <div 
                          className="custom-scrollbar"
                          style={{ 
                            padding: "20px", 
                            display: "flex", 
                            flexDirection: "column", 
                            gap: "10px",
                            maxHeight: "260px",
                            overflowY: "auto"
                          }}
                        >
                          {unitActs.length === 0 ? <p style={{ color: "#94a3b8", fontSize: "0.9rem", textAlign: "center" }}>No hay criterios.</p> : 
                            unitActs.map(act => (
                              <div key={act.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #f1f5f9", flexShrink: 0 }}>
                                <div>
                                  <div style={{ color: "#1B396A", fontWeight: "600", fontSize: "0.9rem" }}>{act.name}</div>
                                  <div style={{ color: "#10b981", fontWeight: "700", fontSize: "0.8rem", marginTop: "2px" }}>Valor: {act.weight_percentage}%</div>
                                </div>
                                {!unit.is_closed && (
                                  <button onClick={() => handleDeleteActivity(act.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "6px", borderRadius: "6px", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#fee2e2"} onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            ))
                          }
                        </div>

                        <div style={{ padding: "16px 20px", borderTop: "1px solid #e2e8f0", backgroundColor: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          {!unit.is_closed ? (
                            <>
                              <ExpandingButton icon={PlusCircle} label="Añadir Criterio" variant="secondary" disabled={isPerfect || isOver} onClick={() => { setActiveUnitId(unit.id); setShowActivityModal(true); }} />
                              <ExpandingButton icon={Edit3} label="Calificar" variant="primary" disabled={unitActs.length === 0} onClick={() => handleOpenCapture(unit)} />
                            </>
                          ) : (
                            <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                              <ExpandingButton icon={BookOpen} label="Ver Calificaciones" variant="secondary" onClick={() => handleOpenCapture(unit)} />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================= VISTA 2: CAPTURA EXCEL ================= */}
      {currentView === 'capture' && selectedUnit && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <button onClick={() => setCurrentView('units')} style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: 0, marginBottom: "8px" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B396A"} onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}>
                <ArrowLeft size={16} /> Volver a Unidades
              </button>
              <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                {selectedUnit.is_closed && <Lock size={24} color="#f59e0b" />} Captura: {selectedUnit.name}
              </h1>
            </div>
            
            <div style={{ display: "flex", gap: "12px" }}>
              {!selectedUnit.is_closed && (
                <>
                  <ExpandingButton icon={Wand2} label="Magia: Asistencia" onClick={handleMagicAttendance} variant="magic" />
                  <ExpandingButton icon={Save} label={isSaving ? "Guardando..." : "Guardar"} onClick={handleSaveGrades} variant="success" disabled={isSaving} />
                </>
              )}
              <ExpandingButton icon={selectedUnit.is_closed ? Unlock : Lock} label={selectedUnit.is_closed ? "Reabrir Unidad" : "Cerrar Unidad"} onClick={() => handleToggleCloseUnit(selectedUnit)} variant={selectedUnit.is_closed ? "secondary" : "warning"} />
            </div>
          </div>

          {selectedUnit.is_closed && (
            <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", color: "#b45309", padding: "12px 16px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px", fontWeight: "600" }}>
              <Lock size={20} /> Esta unidad está cerrada. Las calificaciones son de solo lectura.
            </div>
          )}

          <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "left", position: "sticky", left: 0, backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", zIndex: 10 }}>Alumno</th>
                  {activities.filter(a => a.unit_id === selectedUnit.id).map(act => (
                    <th key={act.id} style={{ padding: "16px 12px", textAlign: "center", color: "#64748b", fontSize: "0.85rem", borderRight: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: "700", color: "#1B396A" }}>{act.name}</div>
                      <div style={{ color: "#10b981", fontSize: "0.75rem" }}>Vale {act.weight_percentage}%</div>
                    </th>
                  ))}
                  <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "center", backgroundColor: "#f8fafc" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  let promedioUnidad = 0;
                  const nombreCompleto = `${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim();

                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 16px", position: "sticky", left: 0, backgroundColor: "white", borderRight: "1px solid #e2e8f0", zIndex: 5 }}>
                        <div style={{ color: "#1e293b", fontWeight: "600", fontSize: "0.9rem" }}>{nombreCompleto}</div>
                        <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{s.matricula}</div>
                      </td>
                      
                      {activities.filter(a => a.unit_id === selectedUnit.id).map(act => {
                        const score = grades[`${s.id}_${act.id}`] || 0;
                        promedioUnidad += (Number(score) * (act.weight_percentage / 100));
                        return (
                          <td key={act.id} style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #f1f5f9", backgroundColor: selectedUnit.is_closed ? "#f8fafc" : "white" }}>
                            <input 
                              type="number" min="0" max="100" 
                              value={grades[`${s.id}_${act.id}`] || ""}
                              onChange={(e) => setGrades({...grades, [`${s.id}_${act.id}`]: e.target.value})}
                              disabled={selectedUnit.is_closed}
                              style={inputStyle(selectedUnit.is_closed)}
                            />
                          </td>
                        );
                      })}
                      
                      <td style={{ padding: "12px", textAlign: "center", fontWeight: "800", fontSize: "1.1rem", color: promedioUnidad >= 70 ? "#10b981" : "#ef4444", backgroundColor: "#f8fafc" }}>
                        {promedioUnidad.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= VISTA 3: ACTA SEMESTRAL ================= */}
      {currentView === 'final' && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <button onClick={() => setCurrentView('units')} style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: 0, marginBottom: "8px" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B396A"} onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}>
                <ArrowLeft size={16} /> Volver a Unidades
              </button>
              <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "800", margin: "0 0 8px 0" }}>Acta Final Semestral</h1>
              <p style={{ color: "#64748b", margin: 0, fontWeight: "500", display: "flex", alignItems: "center", gap: "8px" }}>
                Resumen de promedios por unidad
              </p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <ExpandingButton icon={FileSpreadsheet} label="Exportar a Sheets" onClick={handleExportToSheets} variant="success" />
            </div>
          </div>

          <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "left", borderRight: "1px solid #e2e8f0", position: "sticky", left: 0, zIndex: 10, backgroundColor: "#f8fafc" }}>Alumno</th>
                  {units.map(u => (
                    <th key={u.id} style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "0.85rem", borderRight: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: "700", color: "#1B396A" }}>U{u.unit_number}</div>
                      <div style={{ fontSize: "0.7rem" }}>{u.name}</div>
                    </th>
                  ))}
                  <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "center", borderRight: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>Promedio Final</th>
                  <th style={{ padding: "16px", color: "#1B396A", fontSize: "0.85rem", textAlign: "center", backgroundColor: "#f8fafc" }}>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={units.length + 3} style={{ textAlign: "center", padding: "40px" }}>Calculando acta final...</td></tr> : 
                  students.map(s => {
                    let sumAverages = 0;
                    const nombreCompleto = `${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim();

                    return (
                      <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 16px", borderRight: "1px solid #e2e8f0", position: "sticky", left: 0, backgroundColor: "white", zIndex: 5 }}>
                          <div style={{ color: "#1e293b", fontWeight: "600", fontSize: "0.9rem" }}>{nombreCompleto}</div>
                          <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontFamily: "monospace" }}>{s.matricula}</div>
                        </td>
                        
                        {units.map(u => {
                          let uAvg = 0;
                          activities.filter(a => a.unit_id === u.id).forEach(act => {
                            const gradeRec = allGrades.find(g => g.student_id === s.id && g.activity_id === act.id);
                            uAvg += ((gradeRec?.score || 0) * (act.weight_percentage / 100));
                          });
                          sumAverages += uAvg;
                          return (
                            <td key={u.id} style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #f1f5f9", fontWeight: "600", color: uAvg >= 70 ? "#1e293b" : "#ef4444" }}>
                              {uAvg.toFixed(1)}
                            </td>
                          );
                        })}
                        
                        {(() => {
                          const finalAvg = units.length > 0 ? (sumAverages / units.length) : 0;
                          const isApproved = finalAvg >= 70;
                          return (
                            <>
                              <td style={{ padding: "12px", textAlign: "center", fontWeight: "800", fontSize: "1.1rem", borderRight: "1px solid #e2e8f0", color: isApproved ? "#10b981" : "#ef4444", backgroundColor: "#f8fafc" }}>
                                {finalAvg.toFixed(1)}
                              </td>
                              <td style={{ padding: "12px", textAlign: "center", backgroundColor: "#f8fafc" }}>
                                <span style={{ padding: "4px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "700", backgroundColor: isApproved ? "#ecfdf5" : "#fef2f2", color: isApproved ? "#10b981" : "#ef4444" }}>
                                  {isApproved ? "APROBADO" : "REPROBADO"}
                                </span>
                              </td>
                            </>
                          );
                        })()}
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= VISTA 4: SÁBANA DE CALIFICACIONES ================= */}
      {currentView === 'sabana' && (
        <div style={{ backgroundColor: "#F8FAFC", borderRadius: "20px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "30px" }}>
            <div>
              <button onClick={() => setCurrentView('units')} style={{ background: "none", border: "none", color: "#64748b", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: 0, marginBottom: "8px" }} onMouseOver={(e) => e.currentTarget.style.color = "#1B396A"} onMouseOut={(e) => e.currentTarget.style.color = "#64748b"}>
                <ArrowLeft size={16} /> Volver a Unidades
              </button>
              <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "900", margin: 0 }}>Sábana de Calificaciones</h1>
              <p style={{ color: "#64748b", margin: "5px 0 0" }}>Suma automática de criterios y exportación de actas.</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <ExpandingButton icon={Save} label={isSaving ? "Guardando..." : "Guardar Cambios"} onClick={handleSaveGrades} variant="primary" disabled={isSaving} />
              <ExpandingButton icon={FileSpreadsheet} label="Exportar a Sheets" onClick={handleExportToSheets} variant="success" />
            </div>
          </div>

          <div style={{ backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
              <thead>
                <tr style={{ backgroundColor: "#1B396A", color: "white" }}>
                  <th style={{ padding: "20px 25px", textAlign: "left", position: "sticky", left: 0, backgroundColor: "#1B396A", zIndex: 10, borderRight: "1px solid #2a4a7d" }} rowSpan={2}>ALUMNO / MATRÍCULA</th>
                  
                  {/* HEADERS DINÁMICOS UNIDADES */}
                  {units.map((u) => {
                    const unitActs = activities.filter(a => a.unit_id === u.id);
                    return (
                      <th key={u.id} style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #2a4a7d" }} colSpan={unitActs.length + 1}>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}>
                          UNIDAD {u.unit_number} 
                          <button onClick={() => toggleLockSabana(u)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", display: "flex" }} title={lockedUnits[u.id] ? "Desbloquear Unidad" : "Cerrar Unidad"}>
                            {lockedUnits[u.id] ? <Lock size={16} color="#f87171"/> : <Unlock size={16} />}
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ padding: "20px 25px", textAlign: "center", borderLeft: "1px solid #2a4a7d" }} rowSpan={2}>PROMEDIO FINAL</th>
                </tr>
                
                {/* SUBHEADERS ACTIVIDADES Y SUMA */}
                <tr style={{ backgroundColor: "#F1F5F9", color: "#64748b", fontSize: "0.75rem", fontWeight: "900" }}>
                  {units.map((u) => {
                    const unitActs = activities.filter(a => a.unit_id === u.id);
                    return (
                      <Fragment key={u.id}>
                        {unitActs.map(act => (
                          <th key={act.id} style={{ padding: "12px", textAlign: "center", borderLeft: "1px solid #e2e8f0" }}>
                            {act.name.substring(0, 5).toUpperCase()}. <span style={{ color: "#10b981", marginLeft: "4px" }}>{act.weight_percentage}%</span>
                          </th>
                        ))}
                        <th style={{ padding: "12px", textAlign: "center", backgroundColor: "#E2E8F0", color: "#1B396A" }}>SUMA</th>
                      </Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={100} style={{ textAlign: "center", padding: "40px" }}>Cargando Sábana...</td></tr> : 
                 students.map((s) => {
                  let finalSum = 0;
                  let unitsCount = units.length;

                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "15px 25px", position: "sticky", left: 0, backgroundColor: "white", zIndex: 5, borderRight: "1px solid #e2e8f0" }}>
                        <div style={{ color: "#1B396A", fontWeight: "700", fontSize: "0.95rem" }}>{`${s.apellido_paterno} ${s.apellido_materno || ""} ${s.nombres}`.trim()}</div>
                        <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: "600", fontFamily: "monospace" }}>{s.matricula}</div>
                      </td>
                      
                      {/* CELDAS DE ACTIVIDADES POR UNIDAD */}
                      {units.map((u) => {
                        const unitActs = activities.filter(a => a.unit_id === u.id);
                        let uSum = 0;
                        
                        return (
                          <Fragment key={u.id}>
                            {unitActs.map(act => {
                              const score = grades[`${s.id}_${act.id}`] || 0;
                              uSum += (Number(score) * (act.weight_percentage / 100));
                              return (
                                <td key={act.id} style={{ padding: "10px", textAlign: "center", borderLeft: "1px solid #f1f5f9" }}>
                                  <input 
                                    type="number" min="0" max="100"
                                    disabled={lockedUnits[u.id]} 
                                    value={grades[`${s.id}_${act.id}`] || ""}
                                    onChange={(e) => setGrades({...grades, [`${s.id}_${act.id}`]: e.target.value})}
                                    style={inputStyle(lockedUnits[u.id])} 
                                  />
                                </td>
                              );
                            })}
                            {/* CELDA DE SUMA POR UNIDAD */}
                            <td style={{ padding: "10px", textAlign: "center", backgroundColor: "#F8FAFC", fontWeight: "900", color: "#1B396A", borderRight: "1px solid #e2e8f0" }}>
                              {(() => { finalSum += uSum; return uSum.toFixed(1); })()}
                            </td>
                          </Fragment>
                        );
                      })}

                      {/* CELDA DE PROMEDIO FINAL */}
                      <td style={{ padding: "15px 25px", textAlign: "center", fontWeight: "900", color: "#2563eb", fontSize: "1.1rem" }}>
                        {(unitsCount > 0 ? (finalSum / unitsCount) : 0).toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODALES (Originales) ================= */}
      {showUnitModal && currentView === 'units' && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(8px)" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", width: "100%", maxWidth: "550px", padding: "32px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h2 style={{ color: "#1B396A", margin: 0, fontSize: "1.4rem", fontWeight: "800" }}>Nueva Unidad</h2>
              <button onClick={() => setShowUnitModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={24} /></button>
            </div>
            <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>Define el nombre de la unidad y los criterios generales con los que evaluarás (ej. Proyecto 100%, o Asistencia 10% y Tareas 90%).</p>
            
            <form onSubmit={handleAddUnit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={{ display: "block", color: "#64748b", fontSize: "0.85rem", fontWeight: "700", marginBottom: "8px" }}>Nombre del Tema / Unidad</label>
                <input required autoFocus type="text" placeholder="Ej. Fundamentos de Redes" value={newUnitName} onChange={e => setNewUnitName(e.target.value)} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "1rem", backgroundColor: "#f8fafc" }} />
              </div>
              
              <div style={{ backgroundColor: "#f8fafc", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Criterios de Evaluación</p>
                  <div style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "700", backgroundColor: isWeightValid ? "#dcfce7" : "#fee2e2", color: isWeightValid ? "#166534" : "#991b1b", display: "flex", alignItems: "center", gap: "4px" }}>
                    {isWeightValid ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} Total: {totalWeight}%
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {unitCriteria.map((c) => (
                    <div key={c.id} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input type="text" required placeholder="Ej. Proyecto Final" value={c.name} onChange={e => handleUpdateUnitCriterion(c.id, "name", e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", fontSize: "0.9rem" }} />
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <input type="number" required min="1" max="100" value={c.weight} onChange={e => handleUpdateUnitCriterion(c.id, "weight", e.target.value)} style={{ width: "70px", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", textAlign: "center", outline: "none", fontSize: "0.9rem", fontWeight: "bold", color: "#1B396A" }} />
                        <span style={{ fontWeight: "bold", color: "#64748b" }}>%</span>
                      </div>
                      <button type="button" onClick={() => handleRemoveUnitCriterion(c.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "8px", transition: "all 0.2s" }} title="Eliminar Criterio">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={handleAddUnitCriterion} style={{ marginTop: "10px", padding: "10px", backgroundColor: "white", color: "#1B396A", border: "1px dashed #cbd5e1", borderRadius: "8px", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.backgroundColor = "#f1f5f9"} onMouseOut={e => e.currentTarget.style.backgroundColor = "white"}>
                  <PlusCircle size={16} /> Agregar otro criterio
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <ExpandingButton icon={X} label="Cancelar" onClick={() => setShowUnitModal(false)} variant="cancel" />
                <ExpandingButton icon={Save} label="Guardar Unidad" type="submit" disabled={!isWeightValid || !newUnitName.trim()} variant="primary" />
              </div>
            </form>
          </div>
        </div>
      )}

      {showActivityModal && currentView === 'units' && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(8px)" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", width: "100%", maxWidth: "400px", padding: "32px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <h2 style={{ color: "#1B396A", margin: "0 0 24px 0", fontSize: "1.4rem", fontWeight: "800" }}>Añadir Criterio Adicional</h2>
            <form onSubmit={handleAddActivity} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={{ display: "block", color: "#64748b", fontSize: "0.85rem", fontWeight: "700", marginBottom: "8px" }}>Nombre del Criterio</label>
                <input required autoFocus type="text" placeholder="Ej. Puntos Extra" value={newActivity.name} onChange={(e) => setNewActivity({...newActivity, name: e.target.value})} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "1rem", backgroundColor: "#f8fafc" }} />
              </div>
              <div>
                <label style={{ display: "block", color: "#64748b", fontSize: "0.85rem", fontWeight: "700", marginBottom: "8px" }}>Peso en la Unidad (%)</label>
                <input required type="number" min="1" max="100" placeholder="Ej. 10" value={newActivity.weight} onChange={(e) => setNewActivity({...newActivity, weight: e.target.value})} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0", outline: "none", fontSize: "1rem", backgroundColor: "#f8fafc" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "10px" }}>
                <ExpandingButton icon={X} label="Cancelar" onClick={() => setShowActivityModal(false)} variant="cancel" />
                <ExpandingButton icon={Save} label="Confirmar" type="submit" variant="primary" />
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}