"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { useRadio } from "@/lib/store";

export default function PlayerCard() {
  const currentStationId = useRadio((s) => s.currentStationId);
  const isPlaying = useRadio((s) => s.isPlaying);
  const volume = useRadio((s) => s.volume);
  const favorites = useRadio((s) => s.favorites);
  const playbackError = useRadio((s) => s.playbackError);
  const togglePlay = useRadio((s) => s.togglePlay);
  const next = useRadio((s) => s.next);
  const prev = useRadio((s) => s.prev);
  const toggleFavorite = useRadio((s) => s.toggleFavorite);
  const setVolume = useRadio((s) => s.setVolume);
  const setPlaybackError = useRadio((s) => s.setPlaybackError);

  const station = useRadio((s) => s.stationMap.get(s.currentStationId ?? ""));
  const isFav = station ? favorites.has(station.id) : false;
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const skipCountRef = useRef(0);
  const MAX_AUTO_SKIP = 5;

  // Reset skip count when station changes
  useEffect(() => {
    skipCountRef.current = 0;
  }, [currentStationId]);

  // Sync volume to audio element (separate from playback lifecycle)
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  // Auto-skip helper
  const autoSkip = () => {
    if (skipCountRef.current < MAX_AUTO_SKIP) {
      skipCountRef.current++;
      setTimeout(() => useRadio.getState().next(), 800);
    }
  };

  // HLS / native playback
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onAudioError = () => {
      setPlaybackError("流媒体连接失败，自动跳转...");
      useRadio.setState({ isPlaying: false });
      autoSkip();
    };
    a.addEventListener("error", onAudioError);

    const destroyHls = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };

    if (isPlaying && station?.streamUrl) {
      const rawUrl = station.streamUrl;
      const url = `/api/stream?url=${encodeURIComponent(rawUrl)}`;
      const isHls = /\.m3u8/i.test(rawUrl);
      destroyHls();

      if (isHls && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(url);
        hls.attachMedia(a);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          a.play().then(
            () => { setPlaybackError(null); skipCountRef.current = 0; },
            () => { setPlaybackError("无法播放，自动跳转..."); useRadio.setState({ isPlaying: false }); autoSkip(); }
          );
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setPlaybackError("流媒体连接失败，自动跳转...");
            useRadio.setState({ isPlaying: false });
            hls.destroy();
            hlsRef.current = null;
            autoSkip();
          }
        });
        hlsRef.current = hls;
      } else {
        a.src = url;
        a.play().then(
          () => { setPlaybackError(null); skipCountRef.current = 0; },
          () => { setPlaybackError("无法播放，自动跳转..."); useRadio.setState({ isPlaying: false }); autoSkip(); }
        );
      }
    } else {
      a.pause();
      a.src = "";
      destroyHls();
    }

    return () => {
      a.removeEventListener("error", onAudioError);
      a.pause();
      a.src = "";
      destroyHls();
    };
  }, [isPlaying, station?.streamUrl, station?.id]);

  if (!station) {
    return (
      <div className="card player">
        <div className="head">
          <div className="cover"><Wave /></div>
          <div className="meta">
            <div className="name">加载中...</div>
            <div className="genre">正在获取电台数据</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card player">
      <div className="head">
        <div className="cover">
          <Wave />
        </div>
        <div className="meta">
          <div className="name" title={station.name}>
            {station.name}
          </div>
          <div className="genre">
            {playbackError ? (
              <span style={{ color: "#e74c3c" }}>{playbackError}</span>
            ) : (
              <>{station.genre} · {isPlaying ? "播放中" : "已暂停"}</>
            )}
          </div>
        </div>
      </div>

      <div className="controls">
        <button className="icon-btn" onClick={prev} title="上一首" aria-label="上一首">
          <Prev />
        </button>
        <button
          className="icon-btn play"
          onClick={togglePlay}
          title={isPlaying ? "暂停" : "播放"}
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <button className="icon-btn" onClick={next} title="下一首" aria-label="下一首">
          <Next />
        </button>
        <button
          className={`icon-btn fav${isFav ? " active" : ""}`}
          onClick={() => toggleFavorite(station.id)}
          title="收藏"
          aria-label="收藏"
        >
          <Heart filled={isFav} />
        </button>
        <div className="vol">
          <Volume />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="音量"
          />
        </div>
      </div>

      <audio ref={audioRef} preload="none" />
    </div>
  );
}

const S = { width: 20, height: 20, fill: "currentColor" } as const;
function Play() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function Pause() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function Prev() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  );
}
function Next() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M16 6h2v12h-2zM6 6v12l8.5-6z" />
    </svg>
  );
}
function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...S} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
      <path d="M12 21s-7.5-4.6-10-9.2C.6 8.4 2.3 5 5.7 5c2 0 3.4 1.1 4.3 2.4C10.9 6.1 12.3 5 14.3 5 17.7 5 19.4 8.4 18 11.8 15.5 16.4 12 21 12 21z" />
    </svg>
  );
}
function Volume() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
    </svg>
  );
}
function Wave() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor">
      <path d="M6 10h2v4H6zm4-4h2v12h-2zm4 2h2v8h-2zm4-1h2v10h-2z" />
    </svg>
  );
}
