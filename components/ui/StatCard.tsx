"use client";

import type { ElementType } from "react";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: ElementType;
  color: string;
}

export default function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div
      style={{
        backgroundColor: "white",
        padding: "24px",
        borderRadius: "24px",
        border: "1px solid #e2e8f0",
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: "20px",
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)",
      }}
    >
      <div
        style={{
          backgroundColor: `${color}15`,
          color: color,
          padding: "14px",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={24} />
      </div>
      <div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "#64748b",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#1B396A" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

