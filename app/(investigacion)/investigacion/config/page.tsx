"use client";

import React from "react";
import { User, Globe, Bell, Lock, Share2, Save } from "lucide-react";

export default function ConfigInvestigacion() {
  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ marginBottom: "32px" }}>
        <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0 }}>Ajustes de Investigador</h1>
        <p style={{ color: "#64748b" }}>Gestiona tu visibilidad académica y preferencias del sistema.</p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Perfil Académico */}
        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
          <h3 style={{ color: "#1B396A", fontSize: "1rem", fontWeight: "800", marginBottom: "20px", display: "flex", gap: "8px" }}>
            <Globe size={18} color="#f59e0b" /> Identidad Digital
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#94a3b8" }}>ORCID ID</label>
              <input type="text" placeholder="0000-0002-XXXX-XXXX" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", marginTop: "4px" }} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: "800", color: "#94a3b8" }}>LÍNEAS DE INVESTIGACIÓN</label>
              <input type="text" placeholder="IA, IoT, Ciberseguridad" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", marginTop: "4px" }} />
            </div>
          </div>
        </section>

        {/* Notificaciones */}
        <section style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", padding: "24px" }}>
          <h3 style={{ color: "#1B396A", fontSize: "1rem", fontWeight: "800", marginBottom: "20px", display: "flex", gap: "8px" }}>
            <Bell size={18} color="#f59e0b" /> Notificaciones Académicas
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {["Alertas de nuevas citas", "Recordatorios de entrega de informes", "Convocatorias de Grants"].map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.9rem", color: "#475569", fontWeight: "600" }}>{item}</span>
                <div style={{ width: "40px", height: "20px", backgroundColor: "#1B396A", borderRadius: "20px", position: "relative" }}>
                   <div style={{ position: "absolute", right: "2px", top: "2px", width: "16px", height: "16px", backgroundColor: "white", borderRadius: "50%" }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <button style={{ backgroundColor: "#1B396A", color: "white", padding: "16px", borderRadius: "14px", fontWeight: "800", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <Save size={20} /> Guardar Configuración
        </button>
      </div>
    </div>
  );
}