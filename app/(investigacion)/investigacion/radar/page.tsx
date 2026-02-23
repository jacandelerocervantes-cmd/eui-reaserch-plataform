"use client";

import React from "react";
import { Globe, TrendingUp, Award, Share2, Zap } from "lucide-react";

export default function RadarAcademico() {
  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "32px" }}>
        <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0 }}>Radar Académico</h1>
        <p style={{ color: "#64748b" }}>Análisis de impacto global y tendencias en tu área de investigación.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "32px" }}>
        <div style={{ backgroundColor: "#1B396A", borderRadius: "32px", padding: "40px", color: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "40px" }}>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Índice de Citación</h2>
            <TrendingUp color="#10b981" />
          </div>
          <div style={{ fontSize: "4rem", fontWeight: "900", marginBottom: "10px" }}>1,240</div>
          <p style={{ opacity: 0.7 }}>Citas totales detectadas en Google Scholar y Scopus este año.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#1B396A", fontSize: "1rem", display: "flex", gap: "8px" }}><Zap size={18} color="#f59e0b" /> Hot Topics</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {["Edge Computing", "IoT Security", "TinyML"].map(tag => (
                <span key={tag} style={{ backgroundColor: "#f8fafc", padding: "6px 12px", borderRadius: "8px", fontSize: "0.8rem", fontWeight: "700" }}>#{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}