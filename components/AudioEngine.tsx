"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRadio } from "@/lib/store";
import { getPlayer, type RadioPlayer } from "@/lib/player";

/**
 * 无界面的音频引擎：解析当前平台的播放器（Web: hls.js+代理 / 原生: 原生流播放），
 * 订阅 store 状态驱动播放，并把播放器事件（成功 / 失败 / 锁屏控制）映射回 store。
 */
export default function AudioEngine() {
  const isPlaying = useRadio((s) => s.isPlaying);
  const volume = useRadio((s) => s.volume);
  const station = useRadio((s) => s.stationMap.get(s.currentStationId ?? ""));

  const [player, setPlayer] = useState<RadioPlayer | null>(null);
  const autoSkipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoSkip = useCallback(() => {
    if (autoSkipRef.current) {
      clearTimeout(autoSkipRef.current);
      autoSkipRef.current = null;
    }
  }, []);

  const scheduleAutoSkip = useCallback(() => {
    clearAutoSkip();
    autoSkipRef.current = setTimeout(() => {
      autoSkipRef.current = null;
      useRadio.getState().next();
    }, 5000);
  }, [clearAutoSkip]);

  // Resolve the platform player once and wire its events to the store.
  useEffect(() => {
    let disposed = false;
    let unsub: (() => void) | undefined;
    let resolved: RadioPlayer | null = null;

    getPlayer().then((p) => {
      if (disposed) return;
      resolved = p;
      unsub = p.on({
        onPlaying: () => useRadio.getState().setPlaybackError(null),
        onError: (kind) => {
          if (kind === "offline") {
            useRadio.getState().setPlaybackError({ type: "offline", message: "已停播" });
          } else {
            useRadio.getState().setPlaybackError({ type: "error", message: "播放失败" });
          }
          // 死流既可能返回停播页(offline)，也可能直接连接失败(error)。
          // 两种都自动跳台，避免用户卡在无法播放的电台上(尤其是落地默认台)。
          scheduleAutoSkip();
          useRadio.setState({ isPlaying: false });
        },
        onRemoteNext: () => useRadio.getState().next(),
        onRemotePrev: () => useRadio.getState().prev(),
        onRemotePlay: () => {
          if (!useRadio.getState().isPlaying) useRadio.getState().togglePlay();
        },
        onRemotePause: () => {
          if (useRadio.getState().isPlaying) useRadio.getState().togglePlay();
        },
      });
      setPlayer(p);
    });

    return () => {
      disposed = true;
      unsub?.();
      resolved?.stop();
    };
  }, [scheduleAutoSkip]);

  // Sync volume
  useEffect(() => {
    player?.setVolume(volume);
  }, [player, volume]);

  // Clear pending auto-skip whenever the station changes
  useEffect(() => {
    clearAutoSkip();
  }, [station?.id, clearAutoSkip]);

  // Drive playback from store state
  useEffect(() => {
    if (!player) return;
    if (isPlaying && station?.streamUrl) {
      void player.play(station.streamUrl, {
        title: station.name,
        subtitle: [station.city, station.country].filter(Boolean).join(" · "),
      });
    } else {
      player.stop();
    }
  }, [player, isPlaying, station?.streamUrl, station?.id, station?.name, station?.city, station?.country]);

  return null;
}
