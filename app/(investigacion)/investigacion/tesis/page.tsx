"use client";

import React from "react";
import { GraduationCap, FileText, Calendar, ChevronRight, UserCheck, AlertCircle } from "lucide-react";

export default function GestionTesistas() {
  const tesistas = [
    { nombre: "Ing. Andrea Méndez", proyecto: "Detección de Plagas vía Vision AI", progreso: 85, entrega: "15 Mar", status: "Revisión Final" },
    { nombre: "Lic. Kevin Soto", proyecto: "Blockchain en Cadenas de Suministro", progreso: 40, entrega: "20 May", status: "Marco Teórico" }
  ];

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "32px" }}>
        <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0 }}>Gestión de Tesistas</h1>
        <p style={{ color: "#64748b" }}>Seguimiento de protocolos y avances de investigación de posgrado.</p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {tesistas.map((t, i) => (
          <div key={i} style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
              <div style={{ backgroundColor: "#fffbeb", color: "#f59e0b", padding: "12px", borderRadius: "16px" }}><UserCheck /></div>
              <div>
                <h3 style={{ margin: 0, color: "#1B396A", fontSize: "1.1rem" }}>{t.nombre}</h3>
                <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#64748b" }}>{t.proyecto}</p>
                <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#f59e0b", textTransform: "uppercase" }}>{t.status}</span>
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: "200px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: "700", marginBottom: "8px" }}>
                <span>Progreso</span>
                <span>{t.progreso}%</span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "3px" }}>
                <div style={{ width: `${t.progreso}%`, height: "100%", backgroundColor: "#f59e0b" }} />
              </div>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "8px" }}>Próxima Revisión: {t.entrega}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}