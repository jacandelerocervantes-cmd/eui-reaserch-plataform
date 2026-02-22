"use client";

import { useRouter } from "next/navigation";
import FloatingActionButton from "../../../../components/ui/FloatingActionButton";

export default function MateriasPage() {
  const router = useRouter();

  return (
    <div style={{ padding: "40px", width: "100%", flex: 1 }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ 
          color: "#1B396A", 
          fontSize: "2.5rem", 
          fontWeight: "800",
          letterSpacing: "-0.025em" 
        }}>
          Mis Materias
        </h1>
        <div style={{ 
          width: "60px", 
          height: "4px", 
          backgroundColor: "#D4AF37", 
          marginTop: "8px",
          borderRadius: "2px" 
        }}></div>
      </header>

      {/* Espacio para la lista de materias */}
      <div style={{ 
        marginTop: "3rem",
        border: "2px dashed #cbd5e1", 
        borderRadius: "16px", 
        padding: "60px 20px", 
        textAlign: "center",
        color: "#64748b",
        backgroundColor: "rgba(255,255,255,0.5)"
      }}>
        <p style={{ fontSize: "1.1rem" }}>No hay materias registradas para este ciclo escolar.</p>
        <p style={{ fontSize: "0.9rem" }}>Usa el botón de la derecha para agregar una.</p>
      </div>

      {/* Botón Flotante con efecto espejo del sidebar */}
      <FloatingActionButton onClick={() => router.push('/panel/materias/nueva')} />
    </div>
  );
}