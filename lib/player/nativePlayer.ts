import { AudioPlayer } from "@mediagrid/capacitor-native-audio";
import { CapacitorHttp } from "@capacitor/core";
import type { PlayerHandlers, PlayerMeta, RadioPlayer } from "./types";

const AUDIO_ID = "radio-globe-stream";
// 直播流缓冲可能较慢；只在确实没在播时才报错，避免误报"播放失败"。
const READY_TIMEOUT = 20000;

/**
 * 预解析 0472 中转地址。
 *
 * radio.0472.org/?id=N 会 302 跳转到真正的 .m3u8（如 ytcast2.radio.cn/.../index_N.m3u8）。
 * ExoPlayer 靠 URI 扩展名推断流类型，无扩展名的 0472 地址会被当成普通文件流(Progressive)，
 * 解不出音频 → 表现为“在播但没声音”(AudioFlinger 无活跃音轨)。
 * 这里先跟随跳转拿到带 .m3u8 的最终地址，ExoPlayer 即可正确识别为 HLS。
 * 非 0472 地址（已带扩展名的直链）原样返回。
 */
async function resolveStreamUrl(url: string): Promise<string> {
  if (!url.includes("radio.0472.org")) return url;
  try {
    // 必须走 CapacitorHttp（原生 HTTP）而非 WebView fetch：0472 从 https 跳到 http，
    // WebView 在 https 上下文里会按 mixed-content 拦截跳转，fetch 拿不到最终地址。
    // disableRedirects 让原生返回 302 本身，从 Location 头读取真实 .m3u8 地址
    // （Java HttpURLConnection 默认也不跟随 https→http 跨协议跳转）。
    const res = await CapacitorHttp.get({ url, disableRedirects: true });
    const headers = res.headers ?? {};
    const loc = headers.Location ?? headers.location;
    return loc || res.url || url;
  } catch {
    return url;
  }
}

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
  private requestSeq = 0;
  private suppressPauseEventsUntil = 0;
  // 串行化原生操作：连续切台时多个 play() 并发会让 changeAudioSource 乱序，
  // 最终 play() 时原生音源可能还停在上一台。用一条 promise 链强制顺序执行。
  private opChain: Promise<void> = Promise.resolve();

  private enqueue(task: () => Promise<void>): Promise<void> {
    const next = this.opChain.then(task, task);
    this.opChain = next.catch(() => {});
    return next;
  }

  private clearReadyTimer() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  }

  private suppressPauseEvents(ms = 1500) {
    this.suppressPauseEventsUntil = Math.max(this.suppressPauseEventsUntil, Date.now() + ms);
  }

  private isCurrentRequest(url: string, seq: number): boolean {
    return this.currentUrl === url && this.requestSeq === seq;
  }

  private async reportFailure(url: string) {
    if (this.currentUrl !== url) return;
    const offline = await checkNativeOffline(url);
    if (this.currentUrl !== url) return;
    this.handlers.onError?.(offline ? "offline" : "error");
  }

  private armReadyTimer(url: string, seq: number) {
    this.clearReadyTimer();
    this.readyTimer = setTimeout(async () => {
      if (!this.isCurrentRequest(url, seq)) return;
      try {
        const { isPlaying } = await AudioPlayer.isPlaying({ audioId: AUDIO_ID });
        if (isPlaying) {
          this.handlers.onPlaying?.();
          return;
        }
      } catch {
        /* fall through to failure */
      }
      if (this.isCurrentRequest(url, seq)) void this.reportFailure(url);
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
        } else if (status === "paused" && Date.now() > this.suppressPauseEventsUntil) {
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
    // 同步占位：后续 play/stop 据此判断自己是否已被更晚的切台抢占。
    const seq = ++this.requestSeq;
    this.currentUrl = url;
    this.clearReadyTimer();
    // create/initialize/changeSource 都会产生内部 paused 状态，不能当成用户暂停。
    this.suppressPauseEvents(2500);
    if (this.created) {
      this.suppressPauseEvents();
      // 先尽快停掉旧声源，再进入串行换源流程，避免快速切台时旧声音继续播。
      void AudioPlayer.stop({ audioId: AUDIO_ID }).catch(() => {});
    }
    return this.enqueue(async () => {
      if (!this.isCurrentRequest(url, seq)) return; // 入队前已被更晚的切台抢占
      // 跟随 0472 跳转拿到带 .m3u8 的真实地址，否则 ExoPlayer 识别不出 HLS 而无声。
      const source = await resolveStreamUrl(url);
      if (!this.isCurrentRequest(url, seq)) return; // 解析期间被抢占
      try {
        if (!this.created) {
          await this.ensureCreated(source, meta);
        } else {
          this.suppressPauseEvents();
          await AudioPlayer.stop({ audioId: AUDIO_ID }).catch(() => {});
          if (!this.isCurrentRequest(url, seq)) return; // stop 期间被抢占
          await AudioPlayer.changeAudioSource({ audioId: AUDIO_ID, source });
          if (!this.isCurrentRequest(url, seq)) return; // 换源期间被抢占
          // changeMetadata 仅更新通知栏标题，是装饰性操作。插件在切台竞态下
          // 偶发 NPE（getCurrentMediaItem() 为 null）；绝不能让它冒泡到外层 catch，
          // 否则会跳过下面的 play() 导致切过去的台没声音。失败时静默忽略。
          await AudioPlayer.changeMetadata({
            audioId: AUDIO_ID,
            friendlyTitle: meta.title,
            artistName: meta.subtitle,
          }).catch(() => {});
        }
        if (!this.isCurrentRequest(url, seq)) return; // 执行期间被抢占
        await AudioPlayer.setVolume({ audioId: AUDIO_ID, volume: this.volume });
        this.armReadyTimer(url, seq);
        await AudioPlayer.play({ audioId: AUDIO_ID });
      } catch {
        this.clearReadyTimer();
        if (this.isCurrentRequest(url, seq)) this.handlers.onError?.("error");
      }
    });
  }

  stop(): void {
    this.requestSeq++;
    this.clearReadyTimer();
    this.currentUrl = null; // 让队列中待执行的 play() 立即作废
    if (this.created) {
      this.suppressPauseEvents();
      void AudioPlayer.stop({ audioId: AUDIO_ID }).catch(() => {});
      void this.enqueue(() => AudioPlayer.stop({ audioId: AUDIO_ID }).catch(() => {}));
    }
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
    this.requestSeq++;
    this.currentUrl = null;
    if (this.created) {
      AudioPlayer.destroy({ audioId: AUDIO_ID }).catch(() => {});
      this.created = false;
    }
  }
}
