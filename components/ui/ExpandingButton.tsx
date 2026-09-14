"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";

// ── ExpandingButton ──────────────────────────────────────────────────────
// Componente único que reemplaza las 16 copias locales de "ExpandingButton"
// que existían repartidas en (dashboard) y (docente)/panel — cada una había
// divergido en alto, radio, peso de fuente, curva de animación y hasta en
// cómo se comportaba una misma variante (ej: "danger" tenía 3 apariencias
// distintas entre archivos). Para no cambiar la apariencia de ninguna
// pantalla al migrarla a este componente, TODO lo que variaba entre
// archivos quedó como prop con un valor por defecto — cada pantalla, al
// migrarse, pasa los valores que ya tenía para no mover un solo píxel.
//
// `colors` es la vía de escape: si la variante con ese nombre no se veía
// igual en el archivo que estás migrando, pásale los colores exactos que
// ya tenía ese archivo en vez de forzar el valor por defecto de la
// variante — así no se pierde ningún matiz visual real al consolidar.

export type ExpandingButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "cancel"
  | "magic"
  | "ai"
  | "notify"
  | "default";

interface ButtonColors {
  bg: string;
  hoverBg: string;
  text: string;
  hoverText: string;
  border: string;
}

// Paleta por defecto — el patrón MÁS COMÚN encontrado para cada variante
// entre las 16 copias (mayoría de archivos, colores idénticos). Donde un
// archivo se veía distinto (ej: "danger" con fondo rosa fijo en
// calificaciones, o "success" tipo outline-hasta-activo en historial),
// ese archivo debe pasar `colors` explícito al migrarse — no forzar este
// default ahí.
const DEFAULT_COLORS: Record<ExpandingButtonVariant, ButtonColors> = {
  primary:   { bg: "#1B396A", hoverBg: "#152c54", text: "white",   hoverText: "white",   border: "transparent" },
  secondary: { bg: "white",   hoverBg: "#f8fafc", text: "#1B396A", hoverText: "#1B396A", border: "#cbd5e1" },
  success:   { bg: "#10b981", hoverBg: "#059669", text: "white",   hoverText: "white",   border: "transparent" },
  warning:   { bg: "#f59e0b", hoverBg: "#d97706", text: "white",   hoverText: "white",   border: "transparent" },
  danger:    { bg: "#ef4444", hoverBg: "#dc2626", text: "white",   hoverText: "white",   border: "transparent" },
  cancel:    { bg: "white",   hoverBg: "#fee2e2", text: "#64748b", hoverText: "#ef4444", border: "#cbd5e1" },
  magic:     { bg: "#8b5cf6", hoverBg: "#7c3aed", text: "white",   hoverText: "white",   border: "transparent" },
  ai:        { bg: "#f0f7ff", hoverBg: "#e0efff", text: "#2563eb", hoverText: "#2563eb", border: "#bfdbfe" },
  notify:    { bg: "#f59e0b", hoverBg: "#d97706", text: "white",   hoverText: "white",   border: "transparent" },
  default:   { bg: "white",   hoverBg: "#f8fafc", text: "#64748b", hoverText: "#1B396A", border: "#cbd5e1" },
};

const DISABLED_COLORS: ButtonColors = {
  bg: "#f1f5f9", hoverBg: "#f1f5f9", text: "#94a3b8", hoverText: "#94a3b8", border: "#e2e8f0",
};

// Las dos curvas de animación que existían en el repo — "bounce" es la que
// usaban auditoria/[submissionId] y revision/[studentId].
const EASE_STANDARD = "cubic-bezier(0.4, 0, 0.2, 1)";
const EASE_BOUNCE = "cubic-bezier(0.175, 0.885, 0.32, 1.275)";

const SHADOW_PRESETS = {
  none: "none",
  hover: "0 4px 6px rgba(0,0,0,0.15)",
  always: "0 8px 15px rgba(0,0,0,0.1)",
} as const;

interface Props {
  icon?: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: ExpandingButtonVariant;
  /** Override total o parcial de colores — usar cuando la variante no se veía igual en el archivo que se está migrando. */
  colors?: Partial<ButtonColors>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  /** Reemplaza el ícono por un spinner y el label por `loadingLabel`. */
  loading?: boolean;
  loadingLabel?: string;
  /** Reemplaza a los antiguos `isActive` / `defaultExpanded`: fuerza el estado expandido sin necesidad de hover. */
  expanded?: boolean;
  small?: boolean;
  /** Alto en px cuando `small` es false. Default 40 (el más común entre las 16 copias). */
  size?: number;
  /** Alto en px cuando `small` es true. Default `size - 4`. */
  smallSize?: number;
  iconSize?: number;
  radius?: number;
  fontWeight?: number;
  fontSize?: string;
  /** Gap en px entre ícono y label cuando está expandido. */
  gap?: number;
  /** Padding horizontal cuando el botón mantiene su ancho fijo (no colapsa). */
  padding?: string;
  /** Si es true, el padding colapsa a "0" cuando no está expandido (patrón de auditoria/revision, botón circular al colapsar). Default false: mantiene `padding` siempre. */
  collapsePadding?: boolean;
  /** Ancho máximo del label expandido. */
  expandedLabelMaxWidth?: string;
  /** Curva de animación con rebote (auditoria/revision) en vez de la estándar. */
  bounce?: boolean;
  durationMs?: number;
  shadow?: keyof typeof SHADOW_PRESETS;
  /** Atenúa el botón (opacity 0.7) cuando disabled/loading — patrón de auditoria/revision. Default false. */
  dimOnDisable?: boolean;
  minWidth?: string;
  /** Estira el botón a 100% del ancho de su contenedor — para pares de CTAs lado a lado envueltos en flex:1. Default false. */
  fullWidth?: boolean;
  title?: string;
}

export default function ExpandingButton({
  icon: Icon,
  label,
  onClick,
  variant = "primary",
  colors,
  type = "button",
  disabled = false,
  loading = false,
  loadingLabel = "Procesando...",
  expanded: forcedExpanded = false,
  small = false,
  size = 40,
  smallSize,
  iconSize,
  radius = 10,
  fontWeight = 700,
  fontSize = "0.9rem",
  gap = 8,
  padding = "0 12px",
  collapsePadding = false,
  expandedLabelMaxWidth = "200px",
  bounce = false,
  durationMs = 300,
  shadow = "none",
  dimOnDisable = false,
  minWidth,
  fullWidth = false,
  title,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);

  const isBlocked = disabled || loading;
  const isExpanded = isHovered || forcedExpanded || loading;

  const base: ButtonColors = isBlocked
    ? DISABLED_COLORS
    : { ...DEFAULT_COLORS[variant], ...colors };

  const bg = isExpanded && !isBlocked ? base.hoverBg : base.bg;
  const text = isExpanded && !isBlocked ? base.hoverText : base.text;

  const ease = bounce ? EASE_BOUNCE : EASE_STANDARD;
  const height = small ? smallSize ?? size - 4 : size;
  const icoSize = iconSize ?? (small ? 16 : 18);

  const appliedPadding = collapsePadding ? (isExpanded ? padding : "0") : padding;
  const boxShadow =
    shadow === "always" ? SHADOW_PRESETS.always : shadow === "hover" && isExpanded && !isBlocked ? SHADOW_PRESETS.hover : "none";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isBlocked}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title ?? label}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: isExpanded ? `${gap}px` : "0px",
        backgroundColor: bg,
        color: text,
        border: `1px solid ${base.border}`,
        borderRadius: `${radius}px`,
        padding: appliedPadding,
        height: `${height}px`,
        minWidth,
        width: fullWidth ? "100%" : undefined,
        fontWeight,
        fontSize,
        cursor: isBlocked ? "not-allowed" : "pointer",
        transition: `all ${durationMs}ms ${ease}`,
        overflow: "hidden",
        whiteSpace: "nowrap",
        boxShadow,
        opacity: dimOnDisable && isBlocked ? 0.7 : 1,
      }}
    >
      {loading ? (
        <Loader2 size={icoSize} className="animate-spin" />
      ) : (
        Icon && <Icon size={icoSize} style={{ flexShrink: 0 }} />
      )}
      <span
        style={{
          maxWidth: isExpanded ? expandedLabelMaxWidth : "0px",
          opacity: isExpanded ? 1 : 0,
          transition: `all ${durationMs}ms ${ease}`,
          display: "inline-block",
        }}
      >
        {loading ? loadingLabel : label}
      </span>
    </button>
  );
}
