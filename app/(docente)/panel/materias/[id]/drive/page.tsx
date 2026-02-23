"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { UploadCloud, Search, FileText, Video, FileArchive, ChevronDown, Download, Eye, Sparkles } from "lucide-react";

const FileHoverCard = ({ file }: { file: any }) => {
  const [isHovered, setIsHovered] = useState(false);

  const getIcon = (tipo: string) => {
    switch(tipo) {
      case 'pdf': return <FileText size={28} color="#ef4444" />;
      case 'video': return <Video size={28} color="#8b5cf6" />;
      default: return <FileArchive size={28} color="#3b82f6" />;
    }
  };

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
      <div style={{ padding: "20px", display: "flex", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "12px" }}>
          {getIcon(file.tipo)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ margin: "0 0 6px 0", color: "#1B396A", fontSize: "1rem", fontWeight: "800", lineHeight: "1.3", wordBreak: "break-word" }}>{file.nombre}</h3>
            <ChevronDown size={20} color={isHovered ? "#1B396A" : "#cbd5e1"} style={{ transition: "transform 0.4s", transform: isHovered ? "rotate(180deg)" : "rotate(0)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: "600" }}>{file.size}</span>
            {file.ai && <span style={{ backgroundColor: "#f3f0ff", color: "#7c3aed", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "6px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}><Sparkles size={10}/> IA</span>}
          </div>
        </div>
      </div>

      <div style={{ 
        maxHeight: isHovered ? "200px" : "0px", opacity: isHovered ? 1 : 0, 
        padding: isHovered ? "0 20px 20px 20px" : "0 20px", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ height: "1px", backgroundColor: "#f1f5f9", margin: "4px 0 16px 0" }} />
        <div style={{ display: "flex", gap: "10px" }}>
          <button style={{ flex: 1, backgroundColor: "#f8fafc", color: "#1B396A", padding: "10px", borderRadius: "10px", fontWeight: "700", fontSize: "0.9rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", border: "1px solid #e2e8f0" }}>
            <Eye size={16} /> Ver
          </button>
          <button style={{ flex: 1, backgroundColor: "#f8fafc", color: "#1B396A", padding: "10px", borderRadius: "10px", fontWeight: "700", fontSize: "0.9rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", border: "1px solid #e2e8f0" }}>
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

  useEffect(() => {
    setIsMounted(true);
    setUnits([{ id: "u1", unit_number: 1, name: "Fundamentos de Redes" }, { id: "u2", unit_number: 2, name: "Capa de Red y Enrutamiento" }]);
    setArchivos([
      { id: 1, unit_id: "u1", nombre: 'Syllabus_2026.pdf', tipo: 'pdf', fecha: '12 Feb, 2026', size: '2.4 MB' },
      { id: 2, unit_id: "u1", nombre: 'Guía_Estudio_IA.pdf', tipo: 'pdf', fecha: 'Hoy', size: '1.1 MB', ai: true },
      { id: 3, unit_id: "u2", nombre: 'Video_Subnetting.mp4', tipo: 'video', fecha: 'Ayer', size: '45 MB', ai: true },
      { id: 4, unit_id: "u2", nombre: 'Presentacion_Unidad_2.pptx', tipo: 'doc', fecha: '10 Feb, 2026', size: '8.5 MB' },
    ]);
  }, []);

  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1300px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.8rem", fontWeight: "950", margin: 0, letterSpacing: "-0.02em" }}>Material Didáctico</h1>
          <p style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: "500", marginTop: "4px" }}>Drive inteligente por unidades</p>
        </div>
        <button style={{ backgroundColor: "#1B396A", color: "white", padding: "12px 20px", borderRadius: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
          <UploadCloud size={18} /> Subir Material
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "40px", marginTop: "10px" }}>
        {units.map(unit => {
          const unitFiles = archivos.filter(a => a.unit_id === unit.id);
          if (unitFiles.length === 0) return null;
          return (
            <div key={unit.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
                <span style={{ backgroundColor: "#1B396A", color: "white", padding: "4px 10px", borderRadius: "8px", fontWeight: "900", fontSize: "0.9rem" }}>U{unit.unit_number}</span>
                <h2 style={{ fontSize: "1.4rem", color: "#1e293b", margin: 0, fontWeight: "800" }}>{unit.name}</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px", alignItems: "start" }}>
                {unitFiles.map(file => <FileHoverCard key={file.id} file={file} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}