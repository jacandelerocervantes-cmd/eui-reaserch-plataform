"use client";

import type { ElementType } from "react";

export default function OptionCard({ icon: Icon, label, selected, onClick }: {
  icon: ElementType; label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, padding: "16px", borderRadius: "12px", cursor: "pointer",
        border: `2px solid ${selected ? "#1B396A" : "#e2e8f0"}`,
        backgroundColor: selected ? "#f8fafc" : "white",
        display: "flex", alignItems: "center", gap: "12px", transition: "all 0.2s",
        color: selected ? "#1B396A" : "#64748b", fontWeight: selected ? "800" : "600"
      }}
    >
      <Icon size={20} color={selected ? "#2563eb" : "#94a3b8"} />
      <span>{label}</span>
    </div>
  );
}
