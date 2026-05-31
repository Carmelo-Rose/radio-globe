"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRadio } from "@/lib/store";
import { nearbyStations } from "@/lib/geo";
import { mapBridge } from "@/lib/mapBridge";
import { GLASS, glassPanel, HairlineLabel, GlassIcon, Spectrum, RadarCursor } from "./primitives";

const FONT_SANS = '"Inter", "Noto Sans SC", sans-serif';
const FONT_MONO = '"JetBrains Mono", monospace';

function formatCoord(lng: number, lat: number): string {
  const fmt = (v: number, pos: string, neg: string) => {
    const dir = v >= 0 ? pos : neg;
    const abs = Math.abs(v);
    const deg = Math.floor(abs);
    const min = Math.round((abs - deg) * 60);
    return `${deg}°${String(min).padStart(2, "0")}′${dir}`;
  };
  return `${fmt(lat, "N", "S")} · ${fmt(lng, "E", "W")}`;
}

const fmtKm = (km: number) => (km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`);

// ---- Top header: brand pill + search pill -----------------------------------
function MHeader() {
  const openList = useRadio((s) => s.openList);
  return (
    <div
      style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 12px) 18px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        pointerEvents: "auto",
      }}
    >
      <div style={{ ...glassPanel, padding: "7px 12px", borderRadius: 999, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: GLASS.accent, boxShadow: `0 0 8px ${GLASS.accent}` }} />
        <span style={{ font: `300 10px/1 ${FONT_MONO}`, color: GLASS.ink, letterSpacing: "0.22em" }}>EARTH RADIO</span>
      </div>
      <button
        onClick={() => openList("all")}
        aria-label="搜索"
        style={{ all: "unset", cursor: "pointer", ...glassPanel, padding: "9px 11px", borderRadius: 999, display: "flex", alignItems: "center", color: GLASS.ink }}
      >
        <GlassIcon name="search" size={14} />
      </button>
    </div>
  );
}

// ---- Location headline ------------------------------------------------------
function MHeadline() {
  const station = useRadio((s) => s.stationMap.get(s.currentStationId ?? ""));
  const count = useRadio((s) => s.stations.length);
  const hasRealData = useRadio((s) => s.hasRealData);
  const coord = station ? formatCoord(station.lng, station.lat) : "--";
  return (
    <div style={{ padding: "18px 20px 0" }}>
      <HairlineLabel>Now tuning</HairlineLabel>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
        <div
          style={{
            font: `200 52px/1 ${FONT_SANS}`,
            color: GLASS.ink,
            letterSpacing: "-0.02em",
            maxWidth: "70vw",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {station?.city ?? "旋转地球"}
        </div>
        <div style={{ font: `300 11px/1 ${FONT_MONO}`, color: GLASS.dim, letterSpacing: "0.15em" }}>
          {station?.country ?? "EXPLORE"}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 }}>
        <HairlineLabel color={GLASS.faint}>{coord}</HairlineLabel>
        <HairlineLabel color={GLASS.accent}>
          {hasRealData ? `● ${count.toLocaleString()} stations` : "● 加载中…"}
        </HairlineLabel>
      </div>
    </div>
  );
}

// ---- Floating zoom + compass (right edge) -----------------------------------
function MMapControls() {
  return (
    <div
      style={{
        position: "absolute",
        right: 14,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-end",
        pointerEvents: "auto",
      }}
    >
      <div style={{ ...glassPanel, padding: 2, display: "flex", flexDirection: "column", borderRadius: 14 }}>
        {(["plus", "minus"] as const).map((s, i) => (
          <button
            key={s}
            onClick={() => (i === 0 ? mapBridge.map?.zoomIn() : mapBridge.map?.zoomOut())}
            aria-label={i === 0 ? "放大" : "缩小"}
            style={{
              all: "unset",
              cursor: "pointer",
              width: 36,
              height: 36,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: GLASS.ink,
              borderBottom: i === 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <GlassIcon name={s} size={14} />
          </button>
        ))}
      </div>
      <div
        onClick={() => mapBridge.map?.easeTo({ bearing: 0, pitch: 0 })}
        style={{
          ...glassPanel,
          width: 44,
          height: 44,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          color: GLASS.ink,
          cursor: "pointer",
        }}
      >
        <div style={{ position: "absolute", top: 5, left: "50%", transform: "translateX(-50%)", width: 2, height: 10, background: GLASS.accent, borderRadius: 2 }} />
        <div style={{ font: `500 11px/1 ${FONT_SANS}` }}>N</div>
      </div>
    </div>
  );
}

// ---- Nearby chips (horizontal scroll) ---------------------------------------
function MNearbyChips() {
  const stations = useRadio((s) => s.stations);
  const station = useRadio((s) => s.stationMap.get(s.currentStationId ?? ""));
  const currentId = useRadio((s) => s.currentStationId);
  const setCurrent = useRadio((s) => s.setCurrent);

  const nearby = useMemo(() => {
    if (!station) return [];
    return nearbyStations(stations, station.lng, station.lat, 6, station.id);
  }, [stations, station]);

  if (nearby.length === 0) return null;

  return (
    <div style={{ padding: "0 16px", pointerEvents: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "0 4px" }}>
        <HairlineLabel>Nearby · 0–40km</HairlineLabel>
        <HairlineLabel color={GLASS.accent}>● {nearby.length} in range</HairlineLabel>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0", scrollbarWidth: "none" }}>
        {nearby.map((s) => {
          const on = s.id === currentId;
          return (
            <button
              key={s.id}
              onClick={() => setCurrent(s.id, "select")}
              style={{
                all: "unset",
                cursor: "pointer",
                ...glassPanel,
                borderRadius: 14,
                padding: "10px 14px",
                minWidth: 138,
                flexShrink: 0,
                border: on ? `1px solid ${GLASS.accent}66` : "1px solid rgba(255,255,255,0.10)",
                boxShadow: on ? `0 0 0 1px ${GLASS.accent}33, 0 12px 24px rgba(0,0,0,0.35)` : "0 12px 24px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ font: `300 11px/1 ${FONT_MONO}`, color: on ? GLASS.accent : GLASS.dim, letterSpacing: "0.1em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                {s.genre || "RADIO"}
              </div>
              <div style={{ font: `500 13px/1.25 ${FONT_SANS}`, color: GLASS.ink, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
                {s.name}
              </div>
              <div style={{ font: `300 10px/1 ${FONT_MONO}`, color: GLASS.faint, letterSpacing: "0.12em", marginTop: 6 }}>{fmtKm(s.km)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Now playing card -------------------------------------------------------
function MNowPlaying() {
  const station = useRadio((s) => s.stationMap.get(s.currentStationId ?? ""));
  const isPlaying = useRadio((s) => s.isPlaying);
  const playbackError = useRadio((s) => s.playbackError);
  const togglePlay = useRadio((s) => s.togglePlay);
  const next = useRadio((s) => s.next);
  const prev = useRadio((s) => s.prev);
  const favorites = useRadio((s) => s.favorites);
  const toggleFavorite = useRadio((s) => s.toggleFavorite);
  const isPinned = useRadio((s) => s.isPinned);
  const togglePin = useRadio((s) => s.togglePin);

  const isFav = station ? favorites.has(station.id) : false;
  const status = playbackError ? playbackError.message.toUpperCase() : isPlaying ? "LIVE" : "PAUSED";
  const statusColor = playbackError ? "#ff7a7a" : GLASS.dim;

  return (
    <div style={{ ...glassPanel, margin: "14px 16px 0", padding: "14px 16px", borderRadius: 22, pointerEvents: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            flexShrink: 0,
            background: `linear-gradient(135deg, ${GLASS.accent}, #6CC3A6)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 20px ${GLASS.accent}44`,
          }}
        >
          <Spectrum bars={4} height={24} color="rgba(14,18,22,0.85)" width={22} gap={2} baseHeight={0.4} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: `500 15px/1.2 ${FONT_SANS}`, color: GLASS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {station?.name ?? "加载中..."}
          </div>
          <div style={{ font: `300 10px/1 ${FONT_MONO}`, color: statusColor, marginTop: 5, letterSpacing: "0.14em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {station ? `${station.genre || "RADIO"} · ● ${status}` : "正在获取电台数据"}
          </div>
        </div>
        <button
          onClick={togglePin}
          aria-label={isPinned ? "取消固定" : "固定电台"}
          style={{ all: "unset", cursor: "pointer", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: isPinned ? GLASS.accent : GLASS.dim, flexShrink: 0 }}
        >
          <GlassIcon name={isPinned ? "pin-f" : "pin"} size={18} />
        </button>
        <button
          onClick={() => station && toggleFavorite(station.id)}
          aria-label="收藏"
          style={{ all: "unset", cursor: "pointer", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: isFav ? GLASS.accent : GLASS.dim, flexShrink: 0 }}
        >
          <GlassIcon name={isFav ? "heart-f" : "heart"} size={18} />
        </button>
      </div>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={prev} aria-label="上一首" style={{ all: "unset", cursor: "pointer", color: GLASS.ink, display: "flex", flexShrink: 0 }}>
          <GlassIcon name="prev" size={18} />
        </button>
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "暂停" : "播放"}
          style={{
            all: "unset",
            cursor: "pointer",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: GLASS.accent,
            color: "#0e1216",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 24px ${GLASS.accent}66`,
            flexShrink: 0,
          }}
        >
          <GlassIcon name={isPlaying ? "pause" : "play"} size={18} />
        </button>
        <button onClick={next} aria-label="下一首" style={{ all: "unset", cursor: "pointer", color: GLASS.ink, display: "flex", flexShrink: 0 }}>
          <GlassIcon name="next" size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Spectrum bars={32} height={22} color={GLASS.ink} gap={2} width="100%" />
        </div>
      </div>
    </div>
  );
}

// ---- Bottom tab bar (Material 3) --------------------------------------------
function MTabBar() {
  const setShowList = useRadio((s) => s.setShowList);
  const openList = useRadio((s) => s.openList);
  const items = [
    { k: "explore", ico: "globe", label: "探索" },
    { k: "favs", ico: "heart", label: "收藏" },
    { k: "search", ico: "search", label: "搜索" },
    { k: "browse", ico: "map", label: "浏览" },
    { k: "me", ico: "profile", label: "我" },
  ];
  const [active, setActive] = useState("explore");
  return (
    <div
      style={{
        ...glassPanel,
        borderRadius: 0,
        border: "none",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "none",
        padding: "6px 6px calc(env(safe-area-inset-bottom, 0px) + 8px)",
        display: "flex",
        justifyContent: "space-around",
        pointerEvents: "auto",
      }}
    >
      {items.map((it) => {
        const on = active === it.k;
        return (
          <button
            key={it.k}
            onClick={() => {
              setActive(it.k);
              if (it.k === "favs") openList("favorites");
              else if (it.k === "browse" || it.k === "search") openList("all");
              else setShowList(false);
            }}
            style={{
              all: "unset",
              cursor: "pointer",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 4px",
              color: GLASS.ink,
            }}
          >
            <div
              style={{
                padding: "4px 16px",
                borderRadius: 999,
                background: on ? GLASS.accent : "transparent",
                color: on ? "#0e1216" : GLASS.ink,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: on ? `0 0 18px ${GLASS.accent}55` : "none",
              }}
            >
              <GlassIcon name={it.ico} size={20} />
            </div>
            <span style={{ font: `500 10px/1 ${FONT_SANS}`, opacity: on ? 1 : 0.7, letterSpacing: "0.04em" }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Composed mobile overlay ------------------------------------------------
export default function GlassMobileOverlay() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 25, pointerEvents: "none", display: "flex", flexDirection: "column", height: "100%" }}>
      {/* vignette */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, transparent 22%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none" }} />

      {/* centre radar reticle — MUST sit at true viewport centre to match the
          map's magnetic-snap point (RadioMap snaps at canvas centre = 50%/50%). */}
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
        <RadarCursor size={240} color={GLASS.accent} ringOpacity={0.6} sweepOpacity={0.85} showCrosshair speed={4.5} thickness={1} />
      </div>

      <MMapControls />

      {/* top chrome */}
      <div style={{ position: "relative" }}>
        <MHeader />
        <MHeadline />
      </div>

      {/* globe breathes through here */}
      <div style={{ flex: 1 }} />

      {/* bottom chrome */}
      <div style={{ position: "relative" }}>
        <MNearbyChips />
        <MNowPlaying />
        <div style={{ height: 14 }} />
        <MTabBar />
      </div>
    </div>
  );
}
