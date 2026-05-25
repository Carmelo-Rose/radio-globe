import { AudioPlayer } from "@mediagrid/capacitor-native-audio";
import type { PlayerHandlers, PlayerMeta, RadioPlayer } from "./types";

const AUDIO_ID = "radio-globe-stream";
// 直播流缓冲可能较慢；只在确实没在播时才报错，避免误报"播放失败"。
const READY_TIMEOUT = 20000;

/** 原生端无 CORS：直接探测流，返回 HTML 多为停播页。 */
async function checkNativeOffline(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const ct = res.headers.get("content-type") || "";
    void res.body?.cancel?.();
    return ct.includes("text/html");
  } catch {
    return false;
  }
}

/**
 * 原生(Capacitor)播放实现：底层为 ExoPlayer/AVPlayer，支持 HLS/Icecast/HTTP，
 * 自带后台播放与锁屏/通知栏的播放-暂停控制。无 CORS、无需 /api/stream 代理。
 *
 * 插件无 error 回调：以 onAudioReady 表示成功、onAudioEnd 视作直播掉线，
 * 并用 READY_TIMEOUT + isPlaying 兜底判定，避免误报停播。
 */
export class NativePlayer implements RadioPlayer {
  private handlers: PlayerHandlers = {};
  private created = false;
  private creating: Promise<void> | null = null;
  private currentUrl: string | null = null;
  private volume = 1;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;

  private clearReadyTimer() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  }

  private async reportFailure(url: string) {
    if (this.currentUrl !== url) return;
    const offline = await checkNativeOffline(url);
    if (this.currentUrl !== url) return;
    this.handlers.onError?.(offline ? "offline" : "error");
  }

  private armReadyTimer(url: string) {
    this.clearReadyTimer();
    this.readyTimer = setTimeout(async () => {
      if (this.currentUrl !== url) return;
      try {
        const { isPlaying } = await AudioPlayer.isPlaying({ audioId: AUDIO_ID });
        if (isPlaying) {
          this.handlers.onPlaying?.();
          return;
        }
      } catch {
        /* fall through to failure */
      }
      void this.reportFailure(url);
    }, READY_TIMEOUT);
  }

  private ensureCreated(url: string, meta: PlayerMeta): Promise<void> {
    if (this.created) return Promise.resolve();
    if (this.creating) return this.creating;
    this.creating = (async () => {
      await AudioPlayer.create({
        audioId: AUDIO_ID,
        audioSource: url,
        friendlyTitle: meta.title,
        artistName: meta.subtitle,
        useForNotification: true,
        showSeekBackward: false,
        showSeekForward: false,
      });
      await AudioPlayer.onAudioReady({ audioId: AUDIO_ID }, () => {
        this.clearReadyTimer();
        this.handlers.onPlaying?.();
      });
      await AudioPlayer.onAudioEnd({ audioId: AUDIO_ID }, () => {
        if (this.currentUrl) void this.reportFailure(this.currentUrl);
      });
      await AudioPlayer.onPlaybackStatusChange({ audioId: AUDIO_ID }, ({ status }) => {
        // 'playing' 是最可靠的"已开始播放"信号：用它清除任何残留的错误标记
        // （插件无 error 回调，否则音频在播但 UI 仍卡在"播放失败"）。
        if (status === "playing") {
          this.clearReadyTimer();
          this.handlers.onPlaying?.();
        } else if (status === "paused") {
          // 来自通知栏/锁屏的暂停
          this.handlers.onRemotePause?.();
        }
      });
      await AudioPlayer.initialize({ audioId: AUDIO_ID });
      this.created = true;
    })();
    return this.creating;
  }

  async play(url: string, meta: PlayerMeta): Promise<void> {
    this.currentUrl = url;
    try {
      if (!this.created) {
        await this.ensureCreated(url, meta);
      } else {
        await AudioPlayer.changeAudioSource({ audioId: AUDIO_ID, source: url });
        await AudioPlayer.changeMetadata({
          audioId: AUDIO_ID,
          friendlyTitle: meta.title,
          artistName: meta.subtitle,
        });
      }
      if (this.currentUrl !== url) return; // 切台抢占
      await AudioPlayer.setVolume({ audioId: AUDIO_ID, volume: this.volume });
      this.armReadyTimer(url);
      await AudioPlayer.play({ audioId: AUDIO_ID });
    } catch {
      this.clearReadyTimer();
      if (this.currentUrl === url) this.handlers.onError?.("error");
    }
  }

  stop(): void {
    this.clearReadyTimer();
    this.currentUrl = null;
    if (this.created) AudioPlayer.stop({ audioId: AUDIO_ID }).catch(() => {});
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.created) AudioPlayer.setVolume({ audioId: AUDIO_ID, volume: v }).catch(() => {});
  }

  on(handlers: PlayerHandlers): () => void {
    this.handlers = handlers;
    return () => {
      this.handlers = {};
    };
  }

  dispose(): void {
    this.clearReadyTimer();
    this.currentUrl = null;
    if (this.created) {
      AudioPlayer.destroy({ audioId: AUDIO_ID }).catch(() => {});
      this.created = false;
    }
  }
}
