import Hls from "hls.js";
import type { PlayerHandlers, PlayerMeta, RadioPlayer } from "./types";

const MAX_RETRIES = 3;

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
 * 浏览器 / dev 环境的播放实现：hls.js + <audio>，流经 /api/stream 代理。
 * 内置重试与停播检测，失败时通过 onError(kind) 上报，由调用方决定 UI/跳台策略。
 */
export class WebPlayer implements RadioPlayer {
  private audio: HTMLAudioElement;
  private hls: Hls | null = null;
  private handlers: PlayerHandlers = {};
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private currentUrl: string | null = null;
  private markFailedRunning = false;
  private volume = 1;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "none";
    this.audio.addEventListener("error", this.onAudioError);
  }

  private onAudioError = () => {
    if (!this.currentUrl) return;
    // HLS 错误走 hls 事件；此处只处理普通流。
    if (this.hls) return;
    if (this.retries < MAX_RETRIES) {
      this.retries++;
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        if (this.audio.src) {
          this.audio.load();
          safePlay(this.audio).catch(() => {});
        }
      }, 2000);
    } else {
      void this.markFailed(this.currentUrl);
    }
  };

  private async markFailed(streamUrl: string) {
    if (this.markFailedRunning) return;
    this.markFailedRunning = true;
    const offline = await checkOffline(streamUrl);
    this.markFailedRunning = false;
    if (this.currentUrl !== streamUrl) return;
    this.handlers.onError?.(offline ? "offline" : "error");
  }

  private destroyHls() {
    this.hls?.destroy();
    this.hls = null;
  }

  private startHls(url: string) {
    const hlsUrl = `/api/stream?url=${encodeURIComponent(url)}`;
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
    this.hls = hls;
    hls.loadSource(hlsUrl);
    hls.attachMedia(this.audio);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      this.retries = 0;
      safePlay(this.audio).then(
        () => this.handlers.onPlaying?.(),
        () => this.handlers.onError?.("error")
      );
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal || this.currentUrl !== url) return;
      if (this.retries < MAX_RETRIES) {
        this.retries++;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else {
          this.destroyHls();
          this.retryTimer = setTimeout(() => {
            if (this.currentUrl === url) this.startHls(url);
          }, 2000);
        }
      } else {
        void this.markFailed(url);
        this.destroyHls();
      }
    });
  }

  async play(url: string, _meta: PlayerMeta): Promise<void> {
    this.stop();
    this.currentUrl = url;
    this.retries = 0;
    this.markFailedRunning = false;
    this.audio.volume = this.volume;

    // 0472 中转地址（radio.0472.org/?id=N）无 .m3u8 扩展名，但 302 跳转后是 HLS。
    // 代理(/api/stream)会跟随跳转并把它当 HLS 重写，这里也据此走 hls.js 路径，
    // 否则会被当普通流喂给 <audio>（非 Safari 浏览器无法原生播 HLS）而无声。
    const isHls = /\.m3u8/i.test(url) || url.includes("radio.0472.org");
    if (isHls && Hls.isSupported()) {
      this.startHls(url);
      return;
    }
    this.audio.src = `/api/stream?url=${encodeURIComponent(url)}`;
    try {
      await safePlay(this.audio);
      this.handlers.onPlaying?.();
    } catch {
      this.handlers.onError?.("error");
    }
  }

  stop(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.currentUrl = null;
    this.audio.pause();
    this.audio.src = "";
    this.destroyHls();
  }

  setVolume(v: number): void {
    this.volume = v;
    this.audio.volume = v;
  }

  on(handlers: PlayerHandlers): () => void {
    this.handlers = handlers;
    return () => {
      this.handlers = {};
    };
  }

  dispose(): void {
    this.stop();
    this.audio.removeEventListener("error", this.onAudioError);
  }
}
