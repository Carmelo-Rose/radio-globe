"use client";

import { useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import { useRadio } from "@/lib/store";

function isAutoplayBlocked(err: unknown): boolean {
  return err instanceof DOMException && err.name === "NotAllowedError";
}

/** 尝试播放；被浏览器拦截时静音播放再立即恢复 */
function safePlay(a: HTMLAudioElement): Promise<void> {
  return a.play().catch((err) => {
    if (!isAutoplayBlocked(err)) throw err;
    const vol = a.volume;
    const wasMuted = a.muted;
    a.muted = true;
    return a.play().finally(() => {
      a.muted = wasMuted;
      a.volume = vol;
    });
  });
}

async function checkOffline(streamUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`/api/stream?url=${encodeURIComponent(streamUrl)}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    return text.includes("STREAM_OFFLINE");
  } catch {
    return false;
  }
}

/**
 * 无界面的音频引擎：承载 HLS / 普通流的播放、重试与自动跳过逻辑。
 * 从原 PlayerCard 抽离，UI 层只通过 store 操作（togglePlay/next/...）驱动它。
 */
export default function AudioEngine() {
  const isPlaying = useRadio((s) => s.isPlaying);
  const volume = useRadio((s) => s.volume);
  const setPlaybackError = useRadio((s) => s.setPlaybackError);
  const station = useRadio((s) => s.stationMap.get(s.currentStationId ?? ""));

  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
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

  // Sync volume
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  // Clear auto-skip when station changes
  useEffect(() => {
    clearAutoSkip();
  }, [station?.id, clearAutoSkip]);

  // Playback
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    let retries = 0;
    const MAX_RETRIES = 3;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let markFailedRunning = false;

    const markFailed = async (streamUrl: string) => {
      if (disposed || markFailedRunning) return;
      markFailedRunning = true;
      const offline = await checkOffline(streamUrl);
      if (disposed) return;
      if (offline) {
        setPlaybackError({ type: "offline", message: "已停播" });
        scheduleAutoSkip();
      } else {
        setPlaybackError({ type: "error", message: "播放失败" });
      }
      useRadio.setState({ isPlaying: false });
    };

    const onAudioError = () => {
      if (disposed) return;
      const rawUrl = useRadio
        .getState()
        .stationMap.get(useRadio.getState().currentStationId ?? "")?.streamUrl;
      if (retries < MAX_RETRIES) {
        retries++;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          if (!disposed && a.src) {
            a.load();
            safePlay(a).catch(() => {});
          }
        }, 2000);
      } else if (rawUrl) {
        markFailed(rawUrl);
      }
    };
    a.addEventListener("error", onAudioError);

    const destroyHls = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };

    const createHls = (streamUrl: string): Hls => {
      const hlsUrl = `/api/stream?url=${encodeURIComponent(streamUrl)}`;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 2000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 2000,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(a);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        retries = 0;
        safePlay(a).then(
          () => setPlaybackError(null),
          () => {
            setPlaybackError({ type: "error", message: "播放失败" });
            useRadio.setState({ isPlaying: false });
          }
        );
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (disposed || !data.fatal) return;
        if (retries < MAX_RETRIES) {
          retries++;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else {
            hls.destroy();
            hlsRef.current = null;
            retryTimer = setTimeout(() => {
              if (!disposed && useRadio.getState().isPlaying)
                hlsRef.current = createHls(streamUrl);
            }, 2000);
          }
        } else {
          markFailed(streamUrl);
          hls.destroy();
          hlsRef.current = null;
        }
      });
      return hls;
    };

    if (isPlaying && station?.streamUrl) {
      const rawUrl = station.streamUrl;
      const isHls = /\.m3u8/i.test(rawUrl);
      destroyHls();

      if (isHls && Hls.isSupported()) {
        hlsRef.current = createHls(rawUrl);
      } else {
        const proxied = `/api/stream?url=${encodeURIComponent(rawUrl)}`;
        a.src = proxied;
        safePlay(a).then(
          () => setPlaybackError(null),
          () => {
            setPlaybackError({ type: "error", message: "播放失败" });
            useRadio.setState({ isPlaying: false });
          }
        );
      }
    } else {
      a.pause();
      a.src = "";
      destroyHls();
    }

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      clearAutoSkip();
      a.removeEventListener("error", onAudioError);
      a.pause();
      a.src = "";
      destroyHls();
    };
  }, [isPlaying, station?.streamUrl, station?.id, scheduleAutoSkip, setPlaybackError, clearAutoSkip]);

  return <audio ref={audioRef} preload="none" />;
}
