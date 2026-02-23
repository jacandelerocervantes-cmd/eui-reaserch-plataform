"use client";

import React from "react";
import { Activity, Thermometer, Droplets, Cpu, Radio } from "lucide-react";

export default function MonitoreoSensores() {
  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "32px" }}>
        <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0 }}>Flujo de Sensores</h1>
        <p style={{ color: "#64748b" }}>Telemetría en tiempo real de nodos distribuidos.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
        {[
          { label: "Nodo-Yucatán-01", val: "24.5°C", icon: <Thermometer />, color: "#3b82f6" },
          { label: "Nodo-Yucatán-02", val: "62%", icon: <Droplets />, color: "#10b981" },
          { label: "Servidor Edge", val: "18% Load", icon: <Cpu />, color: "#8b5cf6" }
        ].map((s, i) => (
          <div key={i} style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
            <div style={{ color: s.color, marginBottom: "16px" }}>{s.icon}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "900", color: "#1B396A" }}>{s.val}</div>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", fontWeight: "700", color: "#94a3b8" }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}