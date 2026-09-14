"use client";

export const dynamic = 'force-dynamic';

import { Settings } from "lucide-react";

export default function ConfiguracionPage() {
  return (
    <div style={{ padding: "48px", maxWidth: "800px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
        <div style={{ backgroundColor: "#f1f5f9", padding: "12px", borderRadius: "14px" }}>
          <Settings size={28} color="#1B396A" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: "950", color: "#1B396A", letterSpacing: "-0.02em" }}>
            Configuración
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem", fontWeight: "600" }}>
            Ajustes del sistema y preferencias
          </p>
        </div>
      </div>

      <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "40px", textAlign: "center" }}>
        <Settings size={48} color="#cbd5e1" style={{ margin: "0 auto 16px" }} />
        <h2 style={{ color: "#94a3b8", fontWeight: "800", margin: "0 0 8px" }}>Próximamente</h2>
        <p style={{ color: "#cbd5e1", margin: 0, fontSize: "0.9rem" }}>
          Esta sección estará disponible en una próxima versión.
        </p>
      </div>
    </div>
  );
}
