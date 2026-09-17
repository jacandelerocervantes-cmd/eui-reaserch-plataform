"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock } from "lucide-react";

function parseValue(value: string) {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) {
    return { date: "", hour: "07", minute: "00", isEmpty: true };
  }
  const [, year, month, day, hour, minute] = m;
  return { date: `${year}-${month}-${day}`, hour, minute, isEmpty: false };
}

export default function DateTimeFieldMX({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const parsed = parseValue(value);
  const [date, setDate] = useState(parsed.date);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);

  useEffect(() => {
    const p = parseValue(value);
    setDate(p.date);
    setHour(p.hour);
    setMinute(p.minute);
  }, [value]);

  const update = (newDate: string, newHour: string, newMin: string) => {
    if (!newDate) {
      onChange("");
      return;
    }
    const h = (newHour || "07").padStart(2, "0");
    const m = (newMin || "00").padStart(2, "0");
    onChange(`${newDate}T${h}:${m}`);
  };

  const handleQuickDate = (offsetDays: number) => {
    if (disabled) return;
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${mo}-${day}`;
    setDate(dateStr);
    update(dateStr, hour || "07", minute || "00");
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const standardMinutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
  const minutesList = standardMinutes.includes(minute) ? standardMinutes : [...standardMinutes, minute].sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          padding: "8px 12px",
          borderRadius: "12px",
          border: "2px solid #e2e8f0",
          backgroundColor: disabled ? "#f8fafc" : "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
          flexWrap: "wrap",
        }}
      >
        {/* Selector de Fecha */}
        <div
          onClick={(e) => {
            if (disabled) return;
            const input = e.currentTarget.querySelector("input");
            if (input && typeof (input as any).showPicker === "function") {
              try { (input as any).showPicker(); } catch {}
            }
          }}
          style={{ display: "flex", alignItems: "center", gap: "6px", flex: "1 1 140px", cursor: disabled ? "not-allowed" : "pointer" }}
        >
          <Calendar size={16} color="#64748b" style={{ flexShrink: 0 }} />
          <input
            type="date"
            disabled={disabled}
            value={date}
            onClick={(e) => {
              try { (e.target as any).showPicker?.(); } catch {}
            }}
            onChange={(e) => {
              const d = e.target.value;
              setDate(d);
              update(d, hour, minute);
            }}
            style={{
              border: "none",
              outline: "none",
              fontSize: "0.9rem",
              fontWeight: "700",
              color: "#1B396A",
              background: "transparent",
              cursor: disabled ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              width: "100%",
            }}
          />
        </div>

        <div style={{ width: "1px", height: "24px", backgroundColor: "#e2e8f0" }} />

        {/* Selector de Hora y Minuto */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          <Clock size={16} color="#64748b" style={{ marginRight: "2px" }} />
          <select
            disabled={disabled}
            value={hour}
            onChange={(e) => {
              const h = e.target.value;
              setHour(h);
              update(date, h, minute);
            }}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "4px 6px",
              fontSize: "0.85rem",
              fontWeight: "700",
              color: "#1B396A",
              backgroundColor: "white",
              outline: "none",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {hours.map((h) => (
              <option key={h} value={h}>
                {h} hrs
              </option>
            ))}
          </select>

          <span style={{ fontWeight: "800", color: "#64748b" }}>:</span>

          <select
            disabled={disabled}
            value={minute}
            onChange={(e) => {
              const m = e.target.value;
              setMinute(m);
              update(date, hour, m);
            }}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "4px 6px",
              fontSize: "0.85rem",
              fontWeight: "700",
              color: "#1B396A",
              backgroundColor: "white",
              outline: "none",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {minutesList.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Atajos Rápidos */}
      {!disabled && (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => handleQuickDate(0)}
            style={{
              fontSize: "0.72rem",
              fontWeight: "700",
              padding: "2px 8px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => handleQuickDate(1)}
            style={{
              fontSize: "0.72rem",
              fontWeight: "700",
              padding: "2px 8px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            Mañana
          </button>
        </div>
      )}
    </div>
  );
}
