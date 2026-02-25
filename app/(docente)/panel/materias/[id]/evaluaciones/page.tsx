"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // Asegúrate de tener configurado tu cliente
import { 
  Plus, Calendar, ChevronDown, FileText, 
  Settings, Play, Loader2, AlertCircle 
} from "lucide-react";

// --- TU COMPONENTE PREMIUM (Mantenido) ---
const ExamHoverCard = ({ exam, courseId }: { exam: any, courseId: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0",
        boxShadow: isHovered ? "0 20px 25px -5px rgba(0,0,0,0.1)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", 
        display: "flex", flexDirection: "column", position: "relative"
      }}
    >
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
          <span style={{ 
            fontSize: "0.7rem", fontWeight: "800", 
            color: exam.status === 'activo' ? '#2563eb' : '#16a34a', 
            backgroundColor: exam.status === 'activo' ? '#eff6ff' : '#f0fdf4', 
            padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase" 
          }}>
            {exam.status}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>
            <Calendar size={12} /> {new Date(exam.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.15rem", fontWeight: "800", lineHeight: "1.3", paddingRight: "10px" }}>{exam.title}</h3>
          <ChevronDown size={20} color={isHovered ? "#1B396A" : "#cbd5e1"} style={{ transition: "transform 0.4s", transform: isHovered ? "rotate(180deg)" : "rotate(0)" }} />
        </div>
      </div>

      <div style={{ 
        maxHeight: isHovered ? "300px" : "0px", opacity: isHovered ? 1 : 0, 
        padding: isHovered ? "0 20px 20px 20px" : "0 20px", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", margin: "4px 0 12px 0" }} />
        <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: "1.5", margin: "0 0 16px 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {exam.description || "Sin descripción disponible."}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1B396A", fontWeight: "800", fontSize: "0.85rem", marginBottom: "16px" }}>
          <FileText size={16} color="#94a3b8" /> {exam.questions_count} Preguntas • {exam.duration} min
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/${exam.id}/resultados`)} style={{ flex: 1, backgroundColor: "#1B396A", color: "white", padding: "10px", borderRadius: "10px", fontWeight: "700", fontSize: "0.9rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", border: "none", cursor: "pointer" }}>
            Resultados
          </button>
          <button onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/${exam.id}/configuracion`)} style={{ padding: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "10px", cursor: "pointer" }}>
            <Settings size={18}/>
          </button>
          <button onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/${exam.id}/simulacion`)} style={{ padding: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "10px", cursor: "pointer" }}>
            <Play size={18}/>
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ListaEvaluacionesPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;
  
  const [units, setUnits] = useState<any[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (courseId) fetchRealData();
  }, [courseId]);

  const fetchRealData = async () => {
    setLoading(true);
    try {
      // 1. Obtener Unidades de la materia
      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .eq('course_id', courseId)
        .order('unit_number', { ascending: true });

      // 2. Obtener Evaluaciones de la materia
      const { data: examsData } = await supabase
        .from('evaluations')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (unitsData) setUnits(unitsData);
      if (examsData) setEvaluaciones(examsData);
    } catch (error) {
      console.error("Error cargando evaluaciones:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ height: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 className="animate-spin" size={40} color="#1B396A" />
    </div>
  );

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Evaluaciones</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Generación y control de exámenes por IA</p>
        </div>
        <button onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/nuevo`)} style={{ backgroundColor: "#1B396A", color: "white", padding: "12px 20px", borderRadius: "12px", fontWeight: "700", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
          <Plus size={18} /> Crear Examen
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "40px", marginTop: "10px" }}>
        {units.length > 0 ? units.map(unit => {
          const unitExams = evaluaciones.filter(e => e.unit_id === unit.id);
          // Si una unidad no tiene exámenes, podrías decidir no mostrarla o mostrar un mensaje
          return (
            <div key={unit.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
                <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>U{unit.unit_number}</span>
                <h2 style={{ fontSize: "1.4rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{unit.name}</h2>
              </div>
              
              {unitExams.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
                  {unitExams.map(exam => <ExamHoverCard key={exam.id} exam={exam} courseId={courseId} />)}
                </div>
              ) : (
                <p style={{ color: "#94a3b8", fontSize: "0.9rem", fontStyle: "italic" }}>No hay evaluaciones programadas para esta unidad.</p>
              )}
            </div>
          );
        }) : (
          <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#f8fafc", borderRadius: "24px", border: "2px dashed #e2e8f0" }}>
             <AlertCircle size={40} color="#cbd5e1" style={{ marginBottom: "16px" }} />
             <h3 style={{ color: "#1B396A", margin: 0 }}>No se encontraron unidades</h3>
             <p style={{ color: "#64748b" }}>Carga las unidades en la configuración de la materia para empezar.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}