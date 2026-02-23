"use client";

import React from "react";
import { Microscope, Box, Wrench, ShieldAlert } from "lucide-react";

export default function EquipamientoLab() {
  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "32px" }}>
        <h1 style={{ color: "#1B396A", fontSize: "2.2rem", fontWeight: "950", margin: 0 }}>Inventario Técnico</h1>
        <p style={{ color: "#64748b" }}>Control de activos, calibración y mantenimiento de equipo.</p>
      </header>

      <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#f8fafc" }}>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "16px", color: "#64748b", fontSize: "0.85rem" }}>EQUIPO</th>
              <th style={{ padding: "16px", color: "#64748b", fontSize: "0.85rem" }}>ESTADO</th>
              <th style={{ padding: "16px", color: "#64748b", fontSize: "0.85rem" }}>ÚLTIMA CALIBRACIÓN</th>
            </tr>
          </thead>
          <tbody>
            {[
              { n: "Osciloscopio Rigol 100MHz", s: "Disponible", d: "12 Ene 2026", c: "#10b981" },
              { n: "Impresora 3D Creality K1", s: "En Uso", d: "05 Feb 2026", c: "#f59e0b" },
              { n: "Analizador de Espectros", s: "Mantenimiento", d: "Pre-calibración", c: "#ef4444" }
            ].map((e, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "16px", fontWeight: "700", color: "#1B396A" }}>{e.n}</td>
                <td style={{ padding: "16px" }}>
                  <span style={{ backgroundColor: `${e.c}10`, color: e.c, padding: "4px 12px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "800" }}>{e.s}</span>
                </td>
                <td style={{ padding: "16px", fontSize: "0.85rem", color: "#64748b" }}>{e.d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}