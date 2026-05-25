"use client";

import { useRadio } from "@/lib/store";
import { GLASS } from "@/components/glass/primitives";

export default function StartOverlay() {
  const hasStarted = useRadio((s) => s.hasStarted);
  const start = useRadio((s) => s.start);

  if (hasStarted) return null;

  return (
    <button
      onClick={start}
      aria-label="开始播放"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        border: 0,
        cursor: "pointer",
        color: "#fff",
        background: "rgba(8,11,14,0.55)",
        backdropFilter: "blur(6px) saturate(120%)",
        WebkitBackdropFilter: "blur(6px) saturate(120%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
        font: "inherit",
        textAlign: "center",
      }}
    >
      <span
        style={{
          width: 90,
          height: 90,
          border: `1px solid ${GLASS.accent}`,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: GLASS.accent,
          boxShadow: `0 0 40px ${GLASS.accent}44, inset 0 0 30px ${GLASS.accent}22`,
        }}
      >
        <svg viewBox="0 0 24 24" width={40} height={40} fill="currentColor" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span style={{ font: '300 22px/1 "Inter", "Noto Sans SC", sans-serif', letterSpacing: "0.04em" }}>
        点击开始
      </span>
      <span
        style={{
          font: '300 11px/1 "JetBrains Mono", monospace',
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          opacity: 0.7,
        }}
      >
        Spin the globe · tune the world
      </span>
    </button>
  );
}
