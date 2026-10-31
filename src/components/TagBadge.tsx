import React from "react";

interface TagBadgeProps {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
  className?: string;
}

export function hexToRgba(hex: string, alpha: number): string {
  let cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (cleanHex.length !== 6) {
    return `rgba(99, 102, 241, ${alpha})`;
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function TagBadge({
  name,
  color = "#3b82f6",
  size = "md",
  style = {},
  className = "",
}: TagBadgeProps) {
  const bg = hexToRgba(color, 0.16);
  const border = hexToRgba(color, 0.35);

  const sizeStyles = {
    sm: {
      fontSize: "0.68rem",
      padding: "0.15rem 0.45rem",
      borderRadius: "4px",
    },
    md: {
      fontSize: "0.75rem",
      padding: "0.22rem 0.55rem",
      borderRadius: "5px",
    },
    lg: {
      fontSize: "0.825rem",
      padding: "0.3rem 0.75rem",
      borderRadius: "6px",
    },
  }[size];

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontWeight: 600,
        lineHeight: 1.2,
        color: color,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
        ...sizeStyles,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

