"use client";

import React, { useState, useEffect } from "react";

const AnimatedNumber = ({ value }: { value: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const inc = value / (1000 / 16);
    const t = setInterval(() => {
      start += inc;
      if (start >= value) { setDisplay(value); clearInterval(t); }
      else setDisplay(Math.ceil(start));
    }, 16);
    return () => clearInterval(t);
  }, [value]);
  return <>{display.toLocaleString()}</>;
};

export const MetricCard = ({ label, value, icon: Icon, color, onClick }: {
  label: string; value: number; icon: React.ElementType; color: string; onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    style={{ backgroundColor: "white", padding: "24px", borderRadius: "24px", border: "1px solid #e2e8f0", flex: 1, display: "flex", alignItems: "center", gap: "20px", cursor: onClick ? "pointer" : "default", transition: "all 0.3s", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)", minWidth: 0 }}
    onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 10px 20px -5px ${color}20`; } }}
    onMouseLeave={e => { if (onClick) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.02)"; } }}
  >
    <div style={{ backgroundColor: `${color}15`, color, padding: "16px", borderRadius: "16px", flexShrink: 0 }}>
      <Icon size={28} />
    </div>
    <div>
      <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
      <p style={{ margin: "4px 0 0 0", fontSize: "1.8rem", fontWeight: "900", color: "#1B396A", lineHeight: 1 }}>
        <AnimatedNumber value={value} />
      </p>
    </div>
  </div>
);
