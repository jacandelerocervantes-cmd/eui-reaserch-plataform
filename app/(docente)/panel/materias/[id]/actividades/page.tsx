"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FileText, Plus, Search, Calendar, Users, ArrowRight, Pencil, ChevronDown } from "lucide-react";

// --- SUB-COMPONENTE: TARJETA DE ACTIVIDAD EXPANSIBLE ---
const ActivityHoverCard = ({ act, courseId }: { act: any, courseId: string }) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white", borderRadius: "20px", border: "1px solid #e2e8f0",
        boxShadow: isHovered ? "0 20px 25px -5px rgba(0,0,0,0.1)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", 
        display: "flex", flexDirection: "column", position: "relative"
      }}
    >
      {/* HEADER: Siempre visible (Compacto) */}
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: "800", color: "#2563eb", backgroundColor: "#eff6ff", padding: "4px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
            {act.status}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "0.8rem", fontWeight: "600" }}>
            <Calendar size={12} /> {act.dueDate}
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.15rem", fontWeight: "800", lineHeight: "1.3", paddingRight: "10px" }}>{act.title}</h3>
          <ChevronDown size={20} color={isHovered ? "#1B396A" : "#cbd5e1"} style={{ transition: "transform 0.4s", transform: isHovered ? "rotate(180deg)" : "rotate(0)" }} />
        </div>
      </div>

      {/* BODY: Se revela al pasar el mouse */}
      <div style={{ 
        maxHeight: isHovered ? "300px" : "0px", 
        opacity: isHovered ? 1 : 0, 
        padding: isHovered ? "0 20px 20px 20px" : "0 20px",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", margin: "4px 0 12px 0" }} />
        
        {/* Descripción truncada a 3 líneas */}
        <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: "1.5", margin: "0 0 16px 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {act.description}
        </p>
        
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#1B396A", fontWeight: "800", fontSize: "0.85rem", marginBottom: "16px" }}>
          <Users size={16} color="#94a3b8" /> {act.submissions} / {act.totalStudents} Entregadas
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => router.push(`/panel/materias/${courseId}/actividades/${act.id}`)} style={{ flex: 1, backgroundColor: "#1B396A", color: "white", padding: "10px", borderRadius: "10px", fontWeight: "700", fontSize: "0.9rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            Evaluar <ArrowRight size={16} />
          </button>
          <button onClick={() => router.push(`/panel/materias/${courseId}/actividades/${act.id}/editar`)} style={{ padding: "10px 14px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: "10px", cursor: "pointer" }}>
            <Pencil size={18}/>
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ListaActividadesPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;
  
  const [searchTerm, setSearchTerm] = useState("");
  const [actividades, setActividades] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Mock de datos AGRUPADOS POR UNIDAD
    setUnits([
      { id: "u1", unit_number: 1, name: "Fundamentos de Redes" },
      { id: "u2", unit_number: 2, name: "Capa de Red y Enrutamiento" }
    ]);

    setActividades([
      { id: "act-1", unit_id: "u1", title: "Investigación: Modelos OSI", description: "Análisis comparativo de las capas del modelo OSI vs TCP/IP. Asegúrate de incluir diagramas y citas en formato APA. El documento debe tener al menos 5 cuartillas y conclusiones propias.", dueDate: "15 Mar, 2026", status: "activa", submissions: 15, totalStudents: 40 },
      { id: "act-2", unit_id: "u1", title: "Cuestionario: Subnetting", description: "Resolución de problemas de división de subredes IPv4.", dueDate: "20 Mar, 2026", status: "borrador", submissions: 0, totalStudents: 40 },
      { id: "act-3", unit_id: "u2", title: "Práctica: Configuración Router", description: "Capturas de pantalla de la topología en Cisco Packet Tracer.", dueDate: "10 Abr, 2026", status: "activa", submissions: 2, totalStudents: 40 },
    ]);
  }, [courseId]);

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      
      {/* HEADER PRINCIPAL */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Actividades</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Evaluación continua agrupada por unidades</p>
        </div>
        <button onClick={() => router.push(`/panel/materias/${courseId}/actividades/nueva`)} style={{ backgroundColor: "#1B396A", color: "white", padding: "12px 20px", borderRadius: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
          <Plus size={18} /> Nueva Actividad
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div style={{ position: "relative", width: "100%", maxWidth: "500px" }}>
        <Search size={18} color="#94a3b8" style={{ position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)" }} />
        <input 
          type="text" placeholder="Buscar actividad..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: "100%", padding: "14px 16px 14px 52px", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "1rem", outline: "none" }}
        />
      </div>

      {/* ================= CONTENEDOR AGRUPADO POR UNIDADES ================= */}
      <div style={{ display: "flex", flexDirection: "column", gap: "40px", marginTop: "10px" }}>
        {units.map(unit => {
          const unitActs = actividades.filter(a => a.unit_id === unit.id);
          if (unitActs.length === 0) return null;

          return (
            <div key={unit.id}>
              {/* Título de la Unidad */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
                <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>
                  U{unit.unit_number}
                </span>
                <h2 style={{ fontSize: "1.4rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{unit.name}</h2>
              </div>
              
              {/* Grid de Tarjetas Expansibles */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
                {unitActs.map(act => (
                  <ActivityHoverCard key={act.id} act={act} courseId={courseId} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}