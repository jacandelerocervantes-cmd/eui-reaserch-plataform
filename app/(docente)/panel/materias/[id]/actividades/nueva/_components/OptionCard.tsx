"use client";

import type { ElementType } from "react";

export default function OptionCard({ icon: Icon, label, selected, onClick }: {
  icon: ElementType; label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={{
        flex: 1,
        padding: "16px",
        borderRadius: "12px",
        cursor: "pointer",
        border: `2px solid ${selected ? "#1B396A" : "#e2e8f0"}`,
        backgroundColor: selected ? "#f0f7ff" : "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "12px",
        transition: "all 0.2s ease-in-out",
        color: selected ? "#1B396A" : "#64748b",
        fontWeight: selected ? "800" : "600",
        fontSize: "0.95rem",
        outline: "none",
        userSelect: "none",
        boxShadow: selected ? "0 2px 4px rgba(27,57,106,0.08)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.borderColor = "#cbd5e1";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.borderColor = "#e2e8f0";
      }}
    >
      <Icon size={20} color={selected ? "#1B396A" : "#94a3b8"} />
      <span>{label}</span>
    </button>
  );
}
