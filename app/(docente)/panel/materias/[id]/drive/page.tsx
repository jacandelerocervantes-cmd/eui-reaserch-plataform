"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  UploadCloud, Search, FileText, Video, FileArchive, 
  ChevronDown, Download, Eye, Sparkles, EyeOff 
} from "lucide-react";

// --- TARJETA DE ARCHIVO INTELIGENTE ---
const FileHoverCard = ({ file, onToggleVisibility }: { file: any, onToggleVisibility: (id: string, currentStatus: boolean) => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    await onToggleVisibility(file.id, file.es_visible);
    setIsToggling(false);
  };

  const getIcon = (tipo: string) => {
    switch(tipo) {
      case 'pdf': return <FileText size={28} color={file.es_visible ? "#ef4444" : "#94a3b8"} />;
      case 'video': return <Video size={28} color={file.es_visible ? "#8b5cf6" : "#94a3b8"} />;
      default: return <FileArchive size={28} color={file.es_visible ? "#3b82f6" : "#94a3b8"} />;
    }
  };

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: "white", borderRadius: "20px", 
        border: file.es_visible ? "1px solid #e2e8f0" : "1px dashed #cbd5e1",
        boxShadow: isHovered && file.es_visible ? "0 20px 25px -5px rgba(0,0,0,0.1)" : "0 4px 6px -1px rgba(0,0,0,0.05)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", overflow: "hidden", 
        display: "flex", flexDirection: "column", position: "relative",
        opacity: file.es_visible ? 1 : 0.7 // Efecto fantasma si está oculto
      }}
    >
      <div style={{ padding: "20px", display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ backgroundColor: file.es_visible ? "#f8fafc" : "#f1f5f9", padding: "12px", borderRadius: "12px", transition: "all 0.3s" }}>
          {getIcon(file.tipo)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ margin: "0 0 6px 0", color: file.es_visible ? "#1B396A" : "#64748b", fontSize: "1rem", fontWeight: "800", lineHeight: "1.3", wordBreak: "break-word" }}>
              {file.nombre}
            </h3>
            <ChevronDown size={20} color={isHovered ? "#1B396A" : "#cbd5e1"} style={{ transition: "transform 0.4s", transform: isHovered ? "rotate(180deg)" : "rotate(0)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: "600" }}>{file.size}</span>
            {file.ai && (
              <span style={{ backgroundColor: "#f3f0ff", color: "#7c3aed", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "6px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                <Sparkles size={10}/> IA
              </span>
            )}
            {/* Etiqueta de Visibilidad */}
            {!file.es_visible && (
              <span style={{ backgroundColor: "#fee2e2", color: "#ef4444", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "6px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                <EyeOff size={10}/> Oculto
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Menú Desplegable Hover */}
      <div style={{ 
        maxHeight: isHovered ? "200px" : "0px", opacity: isHovered ? 1 : 0, 
        padding: isHovered ? "0 20px 20px 20px" : "0 20px", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", margin: "4px 0 16px 0" }} />
        <div style={{ display: "flex", gap: "10px" }}>
          
          {/* Botón de Visibilidad (La Bóveda) */}
          <button 
            onClick={handleToggle}
            disabled={isToggling}
            style={{ 
              flex: 1, 
              backgroundColor: file.es_visible ? "#fff1f2" : "#ecfdf5", 
              color: file.es_visible ? "#e11d48" : "#059669", 
              padding: "10px", borderRadius: "10px", fontWeight: "700", fontSize: "0.85rem", 
              display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", 
              border: `1px solid ${file.es_visible ? '#ffe4e6' : '#d1fae5'}`,
              cursor: isToggling ? "wait" : "pointer",
              transition: "all 0.2s"
            }}
          >
            {file.es_visible ? <EyeOff size={16} /> : <Eye size={16} />}
            {file.es_visible ? "Ocultar" : "Mostrar"}
          </button>

          <button style={{ flex: 1, backgroundColor: "#f8fafc", color: "#1B396A", padding: "10px", borderRadius: "10px", fontWeight: "700", fontSize: "0.85rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", border: "1px solid #e2e8f0" }}>
            <Download size={16} /> Bajar
          </button>
        </div>
      </div>
    </div>
  );
};

export default function DrivePage() {
  const params = useParams();
  const courseId = params?.id as string;
  const [units, setUnits] = useState<any[]>([]);
  const [archivos, setArchivos] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    fetchData();
  }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    // 1. Simulación de Unidades
    setUnits([
      { id: "u1", unit_number: 1, name: "Fundamentos de Redes" }, 
      { id: "u2", unit_number: 2, name: "Capa de Red y Enrutamiento" }
    ]);

    // 2. Fetch real de Supabase (Tabla materiales_boveda)
    // Para no romper tu diseño, simularemos los datos si la tabla está vacía,
    // pero te dejo la estructura exacta de cómo leería de Supabase.
    try {
      const { data, error } = await supabase
        .from('materiales_boveda')
        .select('*')
        .eq('materia_id', courseId);
      
      if (data && data.length > 0) {
        setArchivos(data);
      } else {
        // Mock data inicial basado en tu diseño + la variable es_visible
        setArchivos([
          { id: "1", unit_id: "u1", nombre: 'Syllabus_2026.pdf', tipo: 'pdf', fecha: '12 Feb, 2026', size: '2.4 MB', es_visible: true },
          { id: "2", unit_id: "u1", nombre: 'Guía_Estudio_IA.pdf', tipo: 'pdf', fecha: 'Hoy', size: '1.1 MB', ai: true, es_visible: false }, // Este está oculto
          { id: "3", unit_id: "u2", nombre: 'Video_Subnetting.mp4', tipo: 'video', fecha: 'Ayer', size: '45 MB', ai: true, es_visible: true },
          { id: "4", unit_id: "u2", nombre: 'Presentacion_Unidad_2.pptx', tipo: 'doc', fecha: '10 Feb, 2026', size: '8.5 MB', es_visible: true },
        ]);
      }
    } catch (err) {
      console.error("Error al cargar archivos");
    } finally {
      setLoading(false);
    }
  };

  // Función para cambiar la visibilidad en la Base de Datos
  const toggleVisibility = async (fileId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    // Actualizamos UI Optimistamente (Para que se sienta súper rápido)
    setArchivos(prev => prev.map(f => f.id === fileId ? { ...f, es_visible: newStatus } : f));

    // Actualizamos en Supabase
    try {
      const { error } = await supabase
        .from('materiales_boveda')
        .update({ es_visible: newStatus })
        .eq('id', fileId);
        
      if (error) throw error;
    } catch (err) {
      // Si falla, revertimos la UI
      alert("Error al actualizar la visibilidad en el servidor.");
      setArchivos(prev => prev.map(f => f.id === fileId ? { ...f, es_visible: currentStatus } : f));
    }
  };

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Material Didáctico</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Drive inteligente por unidades</p>
        </div>
        <button style={{ backgroundColor: "#1B396A", color: "white", padding: "12px 20px", borderRadius: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", border: "none", cursor: "pointer", transition: "transform 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>
          <UploadCloud size={18} /> Subir Material
        </button>
      </div>

      {loading ? (
         <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>Consultando bóveda segura...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "40px", marginTop: "10px" }}>
          {units.map(unit => {
            const unitFiles = archivos.filter(a => a.unit_id === unit.id);
            if (unitFiles.length === 0) return null;
            return (
              <div key={unit.id} style={{ animation: "fadeIn 0.5s ease-out" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
                  <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>U{unit.unit_number}</span>
                  <h2 style={{ fontSize: "1.4rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{unit.name}</h2>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px", alignItems: "start" }}>
                  {unitFiles.map(file => (
                    <FileHoverCard 
                      key={file.id} 
                      file={file} 
                      onToggleVisibility={toggleVisibility} 
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}