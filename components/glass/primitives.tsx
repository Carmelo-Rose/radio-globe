"use client";

import React, { useMemo } from "react";

// --- Spectrum bars (animated) ------------------------------------------------
export function Spectrum({
  bars = 24,
  height = 28,
  color = "#fff",
  baseHeight = 0.18,
  gap = 2,
  width = "auto" as number | string,
}: {
  bars?: number;
  height?: number;
  color?: string;
  baseHeight?: number;
  gap?: number;
  width?: number | string;
}) {
  const barStyles = useMemo(
    () =>
      Array.from({ length: bars }).map(() => ({
        height: `${(baseHeight + Math.random() * (1 - baseHeight)) * 100}%`,
        animation: `specBar ${0.5 + Math.random() * 0.6}s ease-in-out ${-Math.random() * 1}s infinite alternate`,
      })),
    [bars, baseHeight]
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap, height, width }}>
      {barStyles.map((s, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            background: color,
            borderRadius: 1,
            height: s.height,
            animation: s.animation,
          }}
        />
      ))}
      <style>{`
        @keyframes specBar {
          0%   { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

// --- Radar sweep cursor ------------------------------------------------------
export function RadarCursor({
  size = 220,
  color = "#7CFF8F",
  ringOpacity = 0.55,
  sweepOpacity = 0.95,
  speed = 4.5,
  showRipples = true,
  showCrosshair = false,
  thickness = 1,
  centerDot = true,
}: {
  size?: number;
  color?: string;
  ringOpacity?: number;
  sweepOpacity?: number;
  speed?: number;
  showRipples?: boolean;
  showCrosshair?: boolean;
  thickness?: number;
  centerDot?: boolean;
}) {
  const sweepId = React.useId();
  const half = size / 2;
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        pointerEvents: "none",
        filter: `drop-shadow(0 0 8px ${color}55)`,
      }}
    >
      {showRipples &&
        [0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              border: `${thickness}px solid ${color}`,
              borderRadius: "50%",
              opacity: 0,
              animation: `rcRipple ${speed * 1.2}s linear infinite`,
              animationDelay: `${i * (speed * 0.4)}s`,
            }}
          />
        ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `${thickness}px solid ${color}`,
          borderRadius: "50%",
          opacity: ringOpacity,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.18,
          border: `${thickness}px dashed ${color}`,
          borderRadius: "50%",
          opacity: ringOpacity * 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.34,
          border: `${thickness}px solid ${color}`,
          borderRadius: "50%",
          opacity: ringOpacity * 0.4,
        }}
      />
      {showCrosshair && (
        <React.Fragment>
          <div
            style={{
              position: "absolute",
              left: half - 0.5,
              top: 0,
              width: 1,
              height: size,
              background: color,
              opacity: ringOpacity * 0.35,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: half - 0.5,
              left: 0,
              height: 1,
              width: size,
              background: color,
              opacity: ringOpacity * 0.35,
            }}
          />
        </React.Fragment>
      )}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{
          position: "absolute",
          inset: 0,
          animation: `rcSpin ${speed}s linear infinite`,
          transformOrigin: "50% 50%",
        }}
      >
        <defs>
          <radialGradient id={sweepId} cx={half} cy={half} r={half} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={color} stopOpacity={sweepOpacity * 0.75} />
            <stop offset="55%" stopColor={color} stopOpacity={sweepOpacity * 0.35} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <path
          d={`M ${half} ${half} L ${half} 0 A ${half} ${half} 0 0 1 ${
            half + Math.sin(Math.PI / 3) * half
          } ${half - Math.cos(Math.PI / 3) * half} Z`}
          fill={`url(#${sweepId})`}
        />
        <line x1={half} y1={half} x2={half} y2={0} stroke={color} strokeWidth={thickness * 1.4} opacity={sweepOpacity} />
      </svg>
      {centerDot && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 12px ${color}, 0 0 24px ${color}66`,
          }}
        />
      )}
      <style>{`
        @keyframes rcSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rcRipple {
          0%   { transform: scale(0.5); opacity: 0; }
          15%  { opacity: ${ringOpacity}; }
          100% { transform: scale(1.7); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// --- Shared glass tokens -----------------------------------------------------
export const GLASS = {
  accent: "#7CFFC4",
  ink: "rgba(255,255,255,0.92)",
  dim: "rgba(255,255,255,0.5)",
  faint: "rgba(255,255,255,0.25)",
  bg: "rgba(14,18,22,0.42)",
  border: "1px solid rgba(255,255,255,0.08)",
};

export const glassPanel: React.CSSProperties = {
  background: GLASS.bg,
  backdropFilter: "blur(28px) saturate(140%)",
  WebkitBackdropFilter: "blur(28px) saturate(140%)",
  border: GLASS.border,
  borderRadius: 14,
  boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 60px rgba(0,0,0,0.3)",
};

export function HairlineLabel({
  children,
  color = GLASS.dim,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        font: '300 10px/1 "JetBrains Mono", monospace',
        letterSpacing: "0.28em",
        color,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

export function GlassIcon({ name, size = 20 }: { name: string; size?: number }) {
  const s = size;
  const sw = 1.2;
  const c = "currentColor";
  const common = {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c,
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "globe":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <circle cx="12" cy="9" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "minus":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
        </svg>
      );
    case "heart-f":
      return (
        <svg {...common} fill={c}>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M9 5 3 7v12l6-2 6 2 6-2V5l-6 2-6-2z" />
          <path d="M9 5v12M15 7v12" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.3-4.3" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "play":
      return (
        <svg {...common} fill={c}>
          <path d="M7 5v14l12-7z" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common} fill={c}>
          <rect x="6" y="5" width="4" height="14" />
          <rect x="14" y="5" width="4" height="14" />
        </svg>
      );
    case "prev":
      return (
        <svg {...common} fill={c}>
          <path d="M7 5v14M19 5l-10 7 10 7z" />
        </svg>
      );
    case "next":
      return (
        <svg {...common} fill={c}>
          <path d="M17 5v14M5 5l10 7-10 7z" />
        </svg>
      );
    case "volume":
      return (
        <svg {...common}>
          <path d="M4 10v4h4l5 4V6L8 10H4z" />
          <path d="M16 8a5 5 0 0 1 0 8" />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path d="M9 4v6l-2 4v2h10v-2l-2-4V4" />
          <path d="M7 16h10" />
          <path d="M12 4V2" />
          <line x1="12" y1="16" x2="12" y2="22" />
        </svg>
      );
    case "pin-f":
      return (
        <svg {...common} fill={c}>
          <path d="M9 4v6l-2 4v2h10v-2l-2-4V4" />
          <path d="M7 16h10" />
          <path d="M12 4V2" />
          <line x1="12" y1="16" x2="12" y2="22" />
        </svg>
      );
    default:
      return null;
  }
}
