"use client";

import React from "react";
import { DollarSign, PieChart, ShieldCheck, Clock, ArrowUpRight, Plus } from "lucide-react";

export default function FinanciamientoInvestigacion() {
  const fondos = [
    { nombre: "Apoyo a la Investigación TecNM 2026", monto: "$120,000", ejercicio: "20%", status: "Activo", color: "#10b981" },
    { nombre: "Fondo Sectorial CONAHCYT", monto: "$450,000", ejercicio: "85%", status: "Por Cerrar", color: "#f59e0b" }
  ];

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0 }}>Gestión de Fondos</h1>
          <p style={{ color: "#64748b" }}>Control presupuestal y comprobación de gastos de investigación.</p>
        </div>
        <button style={{ backgroundColor: "#1B396A", color: "white", padding: "12px 24px", borderRadius: "14px", fontWeight: "800", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
          <Plus size={20} /> Solicitar Recurso
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {fondos.map((f, i) => (
          <div key={i} style={{ backgroundColor: "white", borderRadius: "28px", border: "1px solid #e2e8f0", padding: "32px", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ backgroundColor: `${f.color}15`, color: f.color, padding: "10px", borderRadius: "12px" }}>
                <ShieldCheck size={24} />
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: "800", color: f.color, backgroundColor: `${f.color}10`, padding: "4px 12px", borderRadius: "20px", height: "fit-content" }}>{f.status}</span>
            </div>
            <h3 style={{ margin: "0 0 8px 0", color: "#1B396A", fontSize: "1.1rem", fontWeight: "800" }}>{f.nombre}</h3>
            <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#1B396A", marginBottom: "20px" }}>{f.monto}</div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: "700", color: "#64748b" }}>
                <span>Presupuesto Ejercido</span>
                <span>{f.ejercicio}</span>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: f.ejercicio, height: "100%", backgroundColor: f.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}