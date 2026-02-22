"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { UsersRound, TrendingUp, Calendar, Clock, BookOpen, ChevronRight, Activity, Target } from "lucide-react";

// --- COMPONENTE DE TARJETA DE ESTADÍSTICA ---
const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
  <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)", display: "flex", alignItems: "flex-start", gap: "16px", transition: "transform 0.2s" }} onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-4px)"} onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}>
    <div style={{ backgroundColor: `${color}15`, padding: "16px", borderRadius: "16px", color: color }}>
      <Icon size={28} />
    </div>
    <div>
      <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</p>
      <h3 style={{ margin: "0 0 4px 0", color: "#1e293b", fontSize: "1.8rem", fontWeight: "800" }}>{value}</h3>
      <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.8rem", fontWeight: "500" }}>{subtitle}</p>
    </div>
  </div>
);

export default function TablonMateria() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<any>(null);
  const [stats, setStats] = useState({ totalStudents: 0, avgAttendance: 0, globalAverage: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (courseId) fetchDashboardData();
  }, [courseId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Datos de la materia
      const { data: courseData } = await supabase.from("courses").select("*").eq("id", courseId).single();
      if (courseData) setCourse(courseData);

      // 2. Total de alumnos
      const { count: studentCount } = await supabase.from("enrollments").select("*", { count: 'exact', head: true }).eq("course_id", courseId);
      
      // 3. Asistencia Promedio
      const { data: attData } = await supabase.from("attendance").select("status").eq("course_id", courseId);
      let avgAtt = 0;
      if (attData && attData.length > 0) {
        const totalPresent = attData.reduce((acc, curr) => acc + curr.status, 0);
        avgAtt = (totalPresent / attData.length) * 100;
      }

      // 4. Promedio General
      const { data: gradesData } = await supabase.from("grades").select("score, activities!inner(course_units!inner(course_id))").eq("activities.course_units.course_id", courseId);
      let globalAvg = 0;
      if (gradesData && gradesData.length > 0) {
        const totalScore = gradesData.reduce((acc, curr) => acc + Number(curr.score), 0);
        globalAvg = totalScore / gradesData.length;
      }

      setStats({
        totalStudents: studentCount || 0,
        avgAttendance: avgAtt,
        globalAverage: globalAvg
      });

    } catch (error) {
      console.error("Error cargando dashboard", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: "40px", color: "#64748b", textAlign: "center" }}>Cargando panel de control...</div>;
  if (!course) return <div style={{ padding: "40px", color: "#ef4444", textAlign: "center" }}>No se encontró la materia.</div>;

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1, maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "30px" }}>
      
      {/* --- HEADER --- */}
      <div style={{ backgroundColor: "#1B396A", borderRadius: "24px", padding: "40px", color: "white", position: "relative", overflow: "hidden", boxShadow: "0 10px 25px -5px rgba(27,57,106,0.3)" }}>
        <div style={{ position: "absolute", top: "-50%", right: "-5%", width: "400px", height: "400px", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "50%", zIndex: 0 }} />
        
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-block", backgroundColor: "rgba(255,255,255,0.2)", padding: "6px 12px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "700", letterSpacing: "0.05em", marginBottom: "16px", backdropFilter: "blur(4px)" }}>
            {course.clave || "MATERIA ACTIVA"}
          </div>
          <h1 style={{ margin: "0 0 12px 0", fontSize: "2.5rem", fontWeight: "800", lineHeight: "1.2", maxWidth: "800px" }}>
            {course.name}
          </h1>
          <div style={{ display: "flex", gap: "20px", color: "rgba(255,255,255,0.8)", fontSize: "0.95rem", fontWeight: "500" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Calendar size={16} /> Semestre en curso</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Clock size={16} /> {course.schedule || "Horario no definido"}</span>
          </div>
        </div>
      </div>

      {/* --- MÉTRICAS PRINCIPALES --- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        <StatCard title="Alumnos Inscritos" value={stats.totalStudents} subtitle="En lista oficial" icon={UsersRound} color="#3b82f6" />
        <StatCard title="Asistencia Promedio" value={`${stats.avgAttendance.toFixed(0)}%`} subtitle="Global del grupo" icon={Activity} color="#10b981" />
        <StatCard title="Promedio General" value={stats.globalAverage.toFixed(1)} subtitle="Rendimiento académico" icon={TrendingUp} color="#f59e0b" />
      </div>

      {/* --- PRÓXIMAS ACTIVIDADES (MOCKUP PARA EL FUTURO) --- */}
      <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.2rem", fontWeight: "800" }}>Próximas Actividades</h3>
          <button onClick={() => router.push(`/panel/materias/${courseId}/actividades`)} style={{ background: "none", border: "none", color: "#3b82f6", fontWeight: "600", fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            Ver todas <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Elemento de ejemplo 1 */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
            <div style={{ backgroundColor: "#e0e7ff", padding: "12px", borderRadius: "12px", color: "#3b82f6" }}><BookOpen size={20} /></div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: "0 0 4px 0", color: "#1e293b", fontSize: "1rem", fontWeight: "700" }}>Práctica 1: Creación del Módulo</h4>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Unidad 1 • Vence en 2 días</p>
            </div>
            <div style={{ color: "#f59e0b", fontWeight: "700", fontSize: "0.9rem", backgroundColor: "#fef3c7", padding: "6px 12px", borderRadius: "20px" }}>Pendiente</div>
          </div>

          {/* Elemento de ejemplo 2 */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
            <div style={{ backgroundColor: "#dcfce7", padding: "12px", borderRadius: "12px", color: "#10b981" }}><Target size={20} /></div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: "0 0 4px 0", color: "#1e293b", fontSize: "1rem", fontWeight: "700" }}>Examen Teórico Parcial</h4>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Unidad 1 • Realizado ayer</p>
            </div>
            <div style={{ color: "#10b981", fontWeight: "700", fontSize: "0.9rem", backgroundColor: "#d1fae5", padding: "6px 12px", borderRadius: "20px" }}>Para calificar</div>
          </div>
          
          <div style={{ textAlign: "center", marginTop: "12px", padding: "10px", color: "#94a3b8", fontSize: "0.85rem", fontStyle: "italic" }}>
            Este módulo se conectará automáticamente con la sección de Actividades.
          </div>
        </div>
      </div>

    </div>
  );
}