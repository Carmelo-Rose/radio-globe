"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRadio } from "@/lib/store";
import { nearbyStations } from "@/lib/geo";
import { mapBridge } from "@/lib/mapBridge";
import {
  GLASS,
  glassPanel,
  HairlineLabel,
  GlassIcon,
  Spectrum,
  RadarCursor,
} from "./primitives";
import GlassMobileOverlay from "./GlassMobileOverlay";

// 窄屏（原生 app / 手机浏览器）用竖屏移动版 UI；宽屏保留桌面布局。
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

const FONT_SANS = '"Inter", "Noto Sans SC", sans-serif';
const FONT_MONO = '"JetBrains Mono", monospace';

function transportBtnStyle(): React.CSSProperties {
  return {
    all: "unset",
    cursor: "pointer",
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

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

// ---- Top centre meta --------------------------------------------------------
function GlassTopMeta() {
  const count = useRadio((s) => s.stations.length);
  const hasRealData = useRadio((s) => s.hasRealData);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 18px",
        ...glassPanel,
        borderRadius: 999,
      }}
    >
      <HairlineLabel color={GLASS.accent}>● Earth Radio</HairlineLabel>
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)" }} />
      <HairlineLabel>v 2.6</HairlineLabel>
      <HairlineLabel color={GLASS.dim}>
        {hasRealData ? `· ${count.toLocaleString()} 个电台` : "· 加载中…"}
      </HairlineLabel>
    </div>
  );
}

// ---- Top-left location card -------------------------------------------------
function GlassLocationCard() {
  const station = useRadio((s) => s.stationMap.get(s.currentStationId ?? ""));
  const count = useRadio((s) => s.stations.length);
  const hasRealData = useRadio((s) => s.hasRealData);
  const isPlaying = useRadio((s) => s.isPlaying);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatter = useMemo(
    () =>
      station
        ? new Intl.DateTimeFormat("zh-CN", {
            timeZone: station.timeZone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        : null,
    [station?.timeZone]
  );

  const time = now && formatter ? formatter.format(now) : "--:--:--";

  const coord = station ? formatCoord(station.lng, station.lat) : "--";

  return (
    <div style={{ ...glassPanel, padding: "20px 24px", minWidth: 320 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <HairlineLabel>正在收听</HairlineLabel>
        <HairlineLabel color={GLASS.faint}>{coord}</HairlineLabel>
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 12 }}>
        <div
          style={{
            font: `200 44px/1 ${FONT_SANS}`,
            letterSpacing: "-0.02em",
            color: GLASS.ink,
            maxWidth: 260,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {station?.city ?? "旋转地球"}
        </div>
        <div style={{ font: `300 12px/1 ${FONT_MONO}`, color: GLASS.dim, letterSpacing: "0.1em" }}>
          {station?.country ?? "探索"}
        </div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 18, alignItems: "center" }}>
        <Spectrum bars={28} height={18} color={GLASS.accent} width={140} gap={3} />
        <div style={{ font: `300 11px/1.4 ${FONT_MONO}`, color: GLASS.dim, letterSpacing: "0.08em" }}>
          {hasRealData ? `${count.toLocaleString()} 个电台` : "加载中…"}
          <br />
          <span style={{ color: GLASS.accent }}>
            ● {isPlaying ? "播放中" : "已暂停"} · {time}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- Left nav rail ----------------------------------------------------------
function GlassNav() {
  const openList = useRadio((s) => s.openList);
  const items = [
    { k: "explore", ico: "circle", label: "探索" },
    { k: "favs", ico: "heart", label: "收藏" },
    { k: "browse", ico: "map", label: "浏览" },
    { k: "search", ico: "search", label: "搜索" },
    { k: "settings", ico: "menu", label: "设置" },
  ];
  const [active, setActive] = useState("explore");
  return (
    <div
      style={{
        ...glassPanel,
        padding: "10px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "center",
        borderRadius: 28,
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
            }}
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "12px 10px",
              borderRadius: 18,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              color: on ? GLASS.accent : GLASS.ink,
              opacity: on ? 1 : 0.6,
              transition: "opacity 200ms, color 200ms",
              width: 56,
            }}
            onMouseEnter={(e) => {
              if (!on) e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              if (!on) e.currentTarget.style.opacity = "0.6";
            }}
          >
            <GlassIcon name={it.ico} size={20} />
            <span style={{ font: `300 10px/1 ${FONT_SANS}`, letterSpacing: "0.1em" }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Right nearby list ------------------------------------------------------
function GlassNearbyList() {
  const stations = useRadio((s) => s.stations);
  const station = useRadio((s) => s.stationMap.get(s.currentStationId ?? ""));
  const currentId = useRadio((s) => s.currentStationId);
  const setCurrent = useRadio((s) => s.setCurrent);

  const nearby = useMemo(() => {
    if (!station) return [];
    return nearbyStations(stations, station.lng, station.lat, 6, station.id);
  }, [stations, station]);

  const fmtKm = (km: number) => (km < 10 ? `${km.toFixed(1)} 公里` : `${Math.round(km)} 公里`);

  return (
    <div style={{ ...glassPanel, padding: "18px 20px", width: 270 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <HairlineLabel>附近</HairlineLabel>
        <HairlineLabel color={GLASS.accent}>● {nearby.length}</HairlineLabel>
      </div>
      {nearby.length === 0 && (
        <div style={{ font: `300 12px/1.4 ${FONT_MONO}`, color: GLASS.dim }}>调谐后显示附近电台</div>
      )}
      {nearby.map((s, i) => {
        const on = s.id === currentId;
        return (
          <button
            key={s.id}
            onClick={() => setCurrent(s.id, "select")}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              width: "100%",
              boxSizing: "border-box",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderTop: i ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  font: `400 13px/1.2 ${FONT_SANS}`,
                  color: on ? GLASS.accent : GLASS.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 170,
                }}
              >
                {s.name}
              </div>
              <div
                style={{
                  font: `300 10px/1 ${FONT_MONO}`,
                  color: GLASS.dim,
                  letterSpacing: "0.12em",
                  marginTop: 4,
                }}
              >
                {fmtKm(s.km)}
              </div>
            </div>
            <div
              style={{
                font: `300 11px/1 ${FONT_MONO}`,
                color: on ? GLASS.accent : GLASS.ink,
                opacity: on ? 1 : 0.6,
                letterSpacing: "0.08em",
                flexShrink: 0,
                maxWidth: 70,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.genre || "—"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---- Right zoom + compass ---------------------------------------------------
function GlassZoomControls() {
  return (
    <div
      style={{
        ...glassPanel,
        padding: 4,
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
      }}
    >
      {(["+", "−"] as const).map((s, i) => (
        <button
          key={s}
          onClick={() => (i === 0 ? mapBridge.map?.zoomIn() : mapBridge.map?.zoomOut())}
          style={{
            all: "unset",
            cursor: "pointer",
            width: 36,
            height: 36,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `300 18px/1 ${FONT_SANS}`,
            color: GLASS.ink,
            borderBottom: i === 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function GlassCompass() {
  return (
    <div
      onClick={() => mapBridge.map?.easeTo({ bearing: 0, pitch: 0 })}
      style={{
        ...glassPanel,
        cursor: "pointer",
        width: 56,
        height: 56,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 6,
          left: "50%",
          transform: "translateX(-50%)",
          width: 2,
          height: 14,
          background: GLASS.accent,
          borderRadius: 2,
        }}
      />
      <div style={{ font: `500 13px/1 ${FONT_SANS}`, color: GLASS.ink }}>北</div>
    </div>
  );
}

// ---- Bottom centre player ---------------------------------------------------
function GlassPlayer() {
  const station = useRadio((s) => s.stationMap.get(s.currentStationId ?? ""));
  const isPlaying = useRadio((s) => s.isPlaying);
  const volume = useRadio((s) => s.volume);
  const favorites = useRadio((s) => s.favorites);
  const playbackError = useRadio((s) => s.playbackError);
  const togglePlay = useRadio((s) => s.togglePlay);
  const next = useRadio((s) => s.next);
  const prev = useRadio((s) => s.prev);
  const toggleFavorite = useRadio((s) => s.toggleFavorite);
  const setVolume = useRadio((s) => s.setVolume);
  const isPinned = useRadio((s) => s.isPinned);
  const togglePin = useRadio((s) => s.togglePin);

  const isFav = station ? favorites.has(station.id) : false;

  const status = playbackError
    ? playbackError.message
    : isPlaying
      ? "直播"
      : "已暂停";
  const statusColor = playbackError ? "#ff7a7a" : GLASS.dim;

  return (
    <div
      style={{
        ...glassPanel,
        padding: "14px 22px",
        display: "flex",
        alignItems: "center",
        gap: 22,
        borderRadius: 999,
        minWidth: 640,
        maxWidth: "calc(100vw - 64px)",
      }}
    >
      {/* artwork */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          flexShrink: 0,
          background: `linear-gradient(135deg, ${GLASS.accent}, #6CC3A6)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 24px ${GLASS.accent}33`,
        }}
      >
        <Spectrum bars={4} height={22} color="rgba(14,18,22,0.85)" width={20} gap={2} baseHeight={0.4} />
      </div>
      {/* title + meta */}
      <div style={{ flex: "0 0 auto", minWidth: 0, maxWidth: 220 }}>
        <div
          style={{
            font: `500 15px/1.2 ${FONT_SANS}`,
            color: GLASS.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {station?.name ?? "加载中..."}
        </div>
        <div
          style={{
            font: `300 11px/1 ${FONT_MONO}`,
            color: GLASS.dim,
            marginTop: 5,
            letterSpacing: "0.12em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
          }}
        >
          {station ? `${station.city} · ${station.genre || "电台"}` : "正在获取电台数据"}
        </div>
      </div>
      <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.1)" }} />
      {/* transport */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: GLASS.ink }}>
        <button style={transportBtnStyle()} onClick={prev} aria-label="上一首">
          <GlassIcon name="prev" size={16} />
        </button>
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "暂停" : "播放"}
          style={{
            ...transportBtnStyle(),
            width: 44,
            height: 44,
            color: "#0e1216",
            background: GLASS.accent,
            boxShadow: `0 0 30px ${GLASS.accent}66`,
          }}
        >
          <GlassIcon name={isPlaying ? "pause" : "play"} size={18} />
        </button>
        <button style={transportBtnStyle()} onClick={next} aria-label="下一首">
          <GlassIcon name="next" size={16} />
        </button>
      </div>
      {/* waveform */}
      <Spectrum bars={36} height={28} color={GLASS.ink} width={160} gap={2} />
      {/* status */}
      <div
        style={{
          font: `300 11px/1 ${FONT_MONO}`,
          color: statusColor,
          letterSpacing: "0.12em",
          whiteSpace: "nowrap",
        }}
      >
        {status}
      </div>
      {/* volume */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: GLASS.dim }}>
        <GlassIcon name="volume" size={14} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          aria-label="音量"
          style={{
            width: 70,
            accentColor: GLASS.accent,
            cursor: "pointer",
          }}
        />
      </div>
      <button
        style={{ ...transportBtnStyle(), color: isFav ? GLASS.accent : GLASS.dim }}
        onClick={() => station && toggleFavorite(station.id)}
        aria-label="收藏"
      >
        <GlassIcon name={isFav ? "heart-f" : "heart"} size={16} />
      </button>
      <button
        style={{ ...transportBtnStyle(), color: isPinned ? GLASS.accent : GLASS.dim }}
        onClick={togglePin}
        aria-label={isPinned ? "取消固定" : "固定电台"}
      >
        <GlassIcon name={isPinned ? "pin-f" : "pin"} size={16} />
      </button>
    </div>
  );
}

// ---- Composed overlay -------------------------------------------------------
export default function GlassOverlay() {
  const narrow = useIsNarrow();
  if (narrow) return <GlassMobileOverlay />;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 25, pointerEvents: "none" }}>
      {/* vignette to integrate UI with the globe */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.45) 100%)",
          pointerEvents: "none",
        }}
      />

      <Slot style={{ left: "50%", top: 28, transform: "translateX(-50%)" }}>
        <GlassTopMeta />
      </Slot>
      <Slot style={{ left: 32, top: 28 }}>
        <GlassLocationCard />
      </Slot>
      <Slot style={{ left: 32, top: "50%", transform: "translateY(-50%)" }}>
        <GlassNav />
      </Slot>
      <Slot style={{ right: 32, top: 28 }}>
        <GlassNearbyList />
      </Slot>
      <Slot
        style={{
          right: 32,
          bottom: 150,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        <GlassZoomControls />
        <GlassCompass />
      </Slot>

      {/* centre radar reticle (visual only, over map centre) */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      >
        <RadarCursor
          size={260}
          color={GLASS.accent}
          ringOpacity={0.6}
          sweepOpacity={0.85}
          showCrosshair
          speed={4.5}
          thickness={1}
        />
      </div>

      <Slot style={{ left: "50%", bottom: 28, transform: "translateX(-50%)" }}>
        <GlassPlayer />
      </Slot>
    </div>
  );
}

// Absolutely-positioned interactive slot (re-enables pointer events).
function Slot({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", pointerEvents: "auto", ...style }}>{children}</div>
  );
}
