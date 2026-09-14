"use client";

import { useEffect, useRef, useState } from "react";

// El <input type="datetime-local"> nativo muestra mm/dd/aaaa o dd/mm/aaaa
// según el idioma del NAVEGADOR del docente, no algo que la app controle —
// por convención en México debe verse siempre dd/mm/aaaa sin importar eso.
// Este campo arma manualmente el mismo string "YYYY-MM-DDTHH:mm" que ya
// esperan las Edge Functions y la BD, así es un reemplazo directo del input
// nativo sin tocar el resto de la lógica de guardado/validación.

function parseValue(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return { year: "", month: "", day: "", hour: "", minute: "" };
  const [, year, month, day, hour, minute] = m;
  return { year, month, day, hour, minute };
}

function buildValue(f: { year: string; month: string; day: string; hour: string; minute: string }) {
  if (!f.year || f.year.length < 4 || !f.month || !f.day || !f.hour || !f.minute) return "";
  return `${f.year.padStart(4, "0")}-${f.month.padStart(2, "0")}-${f.day.padStart(2, "0")}T${f.hour.padStart(2, "0")}:${f.minute.padStart(2, "0")}`;
}

const clamp = (v: string, max: number) => {
  if (v === "") return v;
  const n = Math.min(Number(v), max);
  return String(n);
};

export default function DateTimeFieldMX({
  value, onChange, disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const parsed = parseValue(value);
  const [day, setDay] = useState(parsed.day);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);

  // Resincroniza si el value externo cambia (ej. reset del formulario).
  useEffect(() => {
    const p = parseValue(value);
    setDay(p.day); setMonth(p.month); setYear(p.year); setHour(p.hour); setMinute(p.minute);
  }, [value]);

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  const emit = (next: Partial<{ day: string; month: string; year: string; hour: string; minute: string }>) => {
    onChange(buildValue({ day, month, year, hour, minute, ...next }));
  };

  const segmentStyle: React.CSSProperties = {
    border: "none", outline: "none", textAlign: "center", fontWeight: 600, fontSize: "1.05rem",
    color: "#334155", background: "transparent", fontFamily: "inherit", padding: 0,
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "3px", width: "100%", padding: "16px",
      borderRadius: "12px", border: "2px solid #e2e8f0", backgroundColor: disabled ? "#f1f5f9" : "white",
    }}>
      <input
        ref={dayRef} disabled={disabled} placeholder="DD" value={day} maxLength={2} inputMode="numeric"
        style={{ ...segmentStyle, width: "24px" }}
        onChange={(e) => {
          const v = clamp(e.target.value.replace(/\D/g, "").slice(0, 2), 31);
          setDay(v); emit({ day: v });
          if (v.length === 2) monthRef.current?.focus();
        }}
      />
      <span style={{ color: "#94a3b8" }}>/</span>
      <input
        ref={monthRef} disabled={disabled} placeholder="MM" value={month} maxLength={2} inputMode="numeric"
        style={{ ...segmentStyle, width: "24px" }}
        onChange={(e) => {
          const v = clamp(e.target.value.replace(/\D/g, "").slice(0, 2), 12);
          setMonth(v); emit({ month: v });
          if (v.length === 2) yearRef.current?.focus();
        }}
      />
      <span style={{ color: "#94a3b8" }}>/</span>
      <input
        ref={yearRef} disabled={disabled} placeholder="AAAA" value={year} maxLength={4} inputMode="numeric"
        style={{ ...segmentStyle, width: "52px" }}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setYear(v); emit({ year: v });
          if (v.length === 4) hourRef.current?.focus();
        }}
      />
      <span style={{ color: "#cbd5e1", margin: "0 6px" }}>·</span>
      <input
        ref={hourRef} disabled={disabled} placeholder="HH" value={hour} maxLength={2} inputMode="numeric"
        style={{ ...segmentStyle, width: "24px" }}
        onChange={(e) => {
          const v = clamp(e.target.value.replace(/\D/g, "").slice(0, 2), 23);
          setHour(v); emit({ hour: v });
          if (v.length === 2) minuteRef.current?.focus();
        }}
      />
      <span style={{ color: "#94a3b8" }}>:</span>
      <input
        ref={minuteRef} disabled={disabled} placeholder="mm" value={minute} maxLength={2} inputMode="numeric"
        style={{ ...segmentStyle, width: "24px" }}
        onChange={(e) => {
          const v = clamp(e.target.value.replace(/\D/g, "").slice(0, 2), 59);
          setMinute(v); emit({ minute: v });
        }}
      />
    </div>
  );
}
