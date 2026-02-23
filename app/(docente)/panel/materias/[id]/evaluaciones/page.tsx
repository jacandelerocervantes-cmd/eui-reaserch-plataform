"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Search, Calendar, ChevronDown, CheckCircle2, Clock, FileText, Settings, Play } from "lucide-react";

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
          <span style={{ fontSize: "0.7rem", fontWeight: "800", color: exam.status === 'activo' ? '#2563eb' : '#16a34a', backgroundColor: exam.status === 'activo' ? '#eff6ff' : '#f0fdf4', padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
            {exam.status}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>
            <Calendar size={12} /> {exam.date}
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
          {exam.description}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1B396A", fontWeight: "800", fontSize: "0.85rem", marginBottom: "16px" }}>
          <FileText size={16} color="#94a3b8" /> {exam.questionsCount} Preguntas • {exam.duration} min
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/${exam.id}/resultados`)} style={{ flex: 1, backgroundColor: "#1B396A", color: "white", padding: "10px", borderRadius: "10px", fontWeight: "700", fontSize: "0.9rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}>
            Resultados
          </button>
          <button onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/${exam.id}`)} style={{ padding: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "10px" }} title="Configurar Examen">
            <Settings size={18}/>
          </button>
          <button onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/simulacion`)} style={{ padding: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "10px" }} title="Simular vista de alumno">
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
  const [searchTerm, setSearchTerm] = useState("");
  const [units, setUnits] = useState<any[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setUnits([{ id: "u1", unit_number: 1, name: "Fundamentos de Redes" }, { id: "u2", unit_number: 2, name: "Capa de Red y Enrutamiento" }]);
    setEvaluaciones([
      { id: "ev-1", unit_id: "u1", title: "Examen Teórico: OSI", description: "Evaluación de opción múltiple sobre las 7 capas.", date: "20 Mar, 2026", status: "completado", questionsCount: 20, duration: 45 },
      { id: "ev-2", unit_id: "u2", title: "Examen Práctico: Subnetting", description: "Resolución de casos de estudio de IP.", date: "15 Abr, 2026", status: "activo", questionsCount: 10, duration: 60 },
    ]);
  }, [courseId]);

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Evaluaciones</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Generación y control de exámenes por IA</p>
        </div>
        <button onClick={() => router.push(`/panel/materias/${courseId}/evaluaciones/nuevo`)} style={{ backgroundColor: "#1B396A", color: "white", padding: "12px 20px", borderRadius: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
          <Plus size={18} /> Crear Examen
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "40px", marginTop: "10px" }}>
        {units.map(unit => {
          const unitExams = evaluaciones.filter(e => e.unit_id === unit.id);
          if (unitExams.length === 0) return null;
          return (
            <div key={unit.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
                <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>U{unit.unit_number}</span>
                <h2 style={{ fontSize: "1.4rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{unit.name}</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
                {unitExams.map(exam => <ExamHoverCard key={exam.id} exam={exam} courseId={courseId} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}