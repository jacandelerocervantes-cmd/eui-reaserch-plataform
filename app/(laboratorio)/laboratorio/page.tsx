"use client";

import React, { useState, useEffect } from "react";
import { FlaskConical, Activity, Database, Server, Sparkles } from "lucide-react";

export default function EstacionDeControl() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return null;

  return (
    <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto", textAlign: "center" }}>
      <div style={{ backgroundColor: "white", padding: "60px", borderRadius: "32px", border: "1px solid #e2e8f0" }}>
        <div style={{ backgroundColor: "#ecfdf5", color: "#10b981", width: "80px", height: "80px", borderRadius: "24px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <FlaskConical size={40} />
        </div>
        <h1 style={{ color: "#1B396A", fontSize: "2rem", fontWeight: "900" }}>Estación de Control de Laboratorio</h1>
        <p style={{ color: "#64748b", maxWidth: "500px", margin: "12px auto 24px" }}>
          Gestiona tus experimentos, bases de datos y equipos compartidos en tiempo real.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
          <button style={{ backgroundColor: "#1B396A", color: "white", padding: "12px 24px", borderRadius: "12px", border: "none", fontWeight: "700" }}>Nueva Bitácora</button>
          <button style={{ backgroundColor: "white", border: "1px solid #e2e8f0", color: "#1B396A", padding: "12px 24px", borderRadius: "12px", fontWeight: "700" }}>Ver Equipamiento</button>
        </div>
      </div>
    </div>
  );
}