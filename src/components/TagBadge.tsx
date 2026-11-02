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
  // CloudNexus style: subtle background tint (0.12 - 0.15) and light border (0.25 - 0.30)
  const bg = hexToRgba(color, 0.12);
  const border = hexToRgba(color, 0.28);

  const sizeStyles = {
    sm: {
      fontSize: "0.68rem",
      padding: "0.15rem 0.5rem",
      gap: "0.3rem",
      dotSize: "0.375rem", // 6px (w-1.5 h-1.5)
    },
    md: {
      fontSize: "0.75rem",
      padding: "0.2rem 0.625rem",
      gap: "0.375rem",
      dotSize: "0.375rem", // 6px (w-1.5 h-1.5)
    },
    lg: {
      fontSize: "0.825rem",
      padding: "0.28rem 0.75rem",
      gap: "0.45rem",
      dotSize: "0.45rem",
    },
  }[size];

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: sizeStyles.gap,
        fontWeight: 600,
        lineHeight: 1.2,
        color: color,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: "9999px",
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
        fontSize: sizeStyles.fontSize,
        padding: sizeStyles.padding,
        ...style,
      }}
    >
      <span
        style={{
          width: sizeStyles.dotSize,
          height: sizeStyles.dotSize,
          borderRadius: "9999px",
          backgroundColor: color,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      {name}
    </span>
  );
}
